"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  MFA_CODE_LENGTH,
  isCompleteCode,
  normalizeCode,
  resendWaitSeconds,
} from "@/lib/two-factor";
import {
  sendTwoFactorCode,
  setTwoFactorEnabled,
  twoFactorErrorMessage,
  verifyTwoFactorCode,
} from "@/lib/two-factor-client";

/**
 * 2要素認証の有効化・無効化（MFA-04）。設定画面に置く。
 *
 * 有効化も無効化も、その場で6桁コードを通してもらう。
 * 無効化を素通りさせると、パスワードを盗んだ相手が自分で
 * 締め出しを解除できてしまい、機能そのものが意味を失う。
 * サーバー側（setTwoFactorEnabled）でも同じ条件を必須にしている。
 */

type Step = "idle" | "code";

export function TwoFactorSetting() {
  const { twoFactorEnabled, refreshClaims } = useAuth();

  const [step, setStep] = useState<Step>("idle");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [waitSec, setWaitSec] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  /**
    * これから切り替えようとしている先。コード確認のあいだ覚えておく。
    * 案内文にも出すので ref ではなく state で持つ（描画中に ref は読めない）
    */
  const [target, setTarget] = useState(false);

  useEffect(() => {
    if (lastSentAt === null) return;
    const tick = () => setWaitSec(resendWaitSeconds(lastSentAt, Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [lastSentAt]);

  const send = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await sendTwoFactorCode();
      setSentTo(res.sentTo);
      setLastSentAt(Date.now());
      setStep("code");
    } catch (e) {
      setError(twoFactorErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const begin = (enable: boolean) => {
    setTarget(enable);
    setCode("");
    setDone(null);
    void send();
  };

  const cancel = () => {
    setStep("idle");
    setCode("");
    setError(null);
  };

  const confirm = async () => {
    if (!isCompleteCode(code) || busy) return;
    setBusy(true);
    setError(null);
    try {
      // ①コードを通してクレームを新しくする
      await verifyTwoFactorCode(code);
      // ②その «直後» だけ切り替えが通る（サーバー側が10分で切っている）
      await setTwoFactorEnabled(target);
      await refreshClaims();
      setStep("idle");
      setCode("");
      setDone(
        target ? "2要素認証を有効にしました" : "2要素認証を無効にしました",
      );
    } catch (e) {
      setError(twoFactorErrorMessage(e));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6">
      <label className="mb-1.5 block text-[13px] font-bold">2要素認証</label>
      <p className="mb-2.5 text-xs leading-relaxed text-muted">
        ログイン時に、メールで届く{MFA_CODE_LENGTH}桁のコードを追加で確認します。
        パスワードだけでは入れなくなります
      </p>

      <div className="rounded-[12px] border border-line bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <span className="min-w-0">
            <span className="block text-[14px] font-bold text-ink">
              {twoFactorEnabled ? "有効" : "無効"}
            </span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
              {twoFactorEnabled
                ? "30日ごとにコードの入力をお願いします"
                : "パスワードだけでログインできる状態です"}
            </span>
          </span>
          {step === "idle" && (
            <button
              type="button"
              onClick={() => begin(!twoFactorEnabled)}
              disabled={busy}
              className={`shrink-0 rounded-full px-4 py-2 text-[12px] font-bold transition-colors disabled:opacity-50 ${
                twoFactorEnabled
                  ? "border border-line text-muted hover:text-ink"
                  : "bg-accent text-on-accent"
              }`}
            >
              {busy ? "送信中…" : twoFactorEnabled ? "無効にする" : "有効にする"}
            </button>
          )}
        </div>

        {step === "code" && (
          <div className="anim-float-up mt-4 border-t border-line pt-4">
            <p className="mb-2.5 text-[12px] leading-relaxed text-muted">
              {sentTo
                ? `${sentTo} にコードを送りました。`
                : "コードを送りました。"}
              {target ? "入力すると有効になります" : "入力すると無効になります"}
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(normalizeCode(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") void confirm();
              }}
              placeholder="000000"
              aria-label="確認コード"
              className="w-full rounded-[12px] border border-line bg-page px-4 py-3 text-center font-display text-[20px] font-bold tracking-[0.35em] text-ink outline-none ring-accent/40 transition-shadow placeholder:text-placeholder focus:border-accent/60 focus:ring-2"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={!isCompleteCode(code) || busy}
                className="btn-lift btn-primary flex-1 py-2.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "確認しています…" : "確認する"}
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={busy}
                className="btn-secondary px-4 py-2.5 text-[13px] !text-muted"
              >
                やめる
              </button>
            </div>
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || waitSec > 0}
              className="mt-3 text-[11px] text-accent-soft underline-offset-4 hover:underline disabled:text-placeholder disabled:no-underline"
            >
              {waitSec > 0 ? `再送できます（あと${waitSec}秒）` : "コードを再送する"}
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-[12px] text-danger">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="mt-3 text-[12px] text-accent-soft">
            {done}
          </p>
        )}
      </div>
    </div>
  );
}
