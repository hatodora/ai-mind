"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PageSkeleton } from "@/components/Skeleton";
import {
  MFA_CODE_LENGTH,
  isCompleteCode,
  normalizeCode,
  resendWaitSeconds,
} from "@/lib/two-factor";
import {
  sendTwoFactorCode,
  twoFactorErrorMessage,
  verifyTwoFactorCode,
} from "@/lib/two-factor-client";

/**
 * 6桁コードの入力（MFA-03）。
 *
 * 2要素認証を有効にしている人が、直近の検証を切らしたときにここへ来る。
 * ここを通るまで Firestore はルール側ですべて拒否されるので、
 * 画面を閉じて先へ進むことはできない。
 */
export default function TwoFactorVerifyPage() {
  const router = useRouter();
  const { user, initializing, needsTwoFactor, refreshClaims, signOut } =
    useAuth();

  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [waitSec, setWaitSec] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 画面を開いたら自動で1通送る。ただし再描画のたびに送らないよう1回だけ
  const autoSentRef = useRef(false);

  const send = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      const res = await sendTwoFactorCode();
      setSentTo(res.sentTo);
      setLastSentAt(Date.now());
    } catch (e) {
      setError(twoFactorErrorMessage(e));
    } finally {
      setSending(false);
    }
  }, []);

  useEffect(() => {
    if (initializing || !user || !needsTwoFactor || autoSentRef.current) return;
    autoSentRef.current = true;
    void send();
  }, [initializing, user, needsTwoFactor, send]);

  // 用が済んだら元の画面へ戻す
  useEffect(() => {
    if (initializing) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!needsTwoFactor) router.replace("/");
  }, [initializing, user, needsTwoFactor, router]);

  // 再送までの残り秒。1秒ごとに数え直す
  useEffect(() => {
    if (lastSentAt === null) return;
    const tick = () => setWaitSec(resendWaitSeconds(lastSentAt, Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [lastSentAt]);

  const submit = async () => {
    if (!isCompleteCode(code) || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyTwoFactorCode(code);
      // クレームを読み直す。ここで読まないと、通ったのに
      // この画面へ戻され続ける
      await refreshClaims();
      router.replace("/");
    } catch (e) {
      setError(twoFactorErrorMessage(e));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  if (initializing || !user) return <PageSkeleton lines={1} />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-5 py-10">
      <div className="anim-float-up w-full max-w-sm">
        <div className="micro-label mb-2">Verification</div>
        <h1 className="mb-2.5 font-display text-[26px] font-bold leading-snug tracking-tight">
          確認コードを入力
        </h1>
        <p className="mb-7 text-sm leading-relaxed text-muted">
          {sentTo
            ? `${sentTo} に${MFA_CODE_LENGTH}桁のコードを送りました`
            : "メールに届いた6桁のコードを入力してください"}
        </p>

        <label htmlFor="mfa-code" className="mb-1.5 block text-[13px] font-bold">
          確認コード
        </label>
        <input
          id="mfa-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          value={code}
          onChange={(e) => setCode(normalizeCode(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder="000000"
          aria-invalid={error !== null}
          aria-describedby={error ? "mfa-error" : undefined}
          className="w-full rounded-[12px] border border-line bg-card px-5 py-4 text-center font-display text-[26px] font-bold tracking-[0.4em] text-ink outline-none ring-accent/40 transition-shadow placeholder:text-placeholder placeholder:tracking-[0.4em] focus:border-accent/60 focus:ring-2"
        />

        {error && (
          <p id="mfa-error" role="alert" className="mt-2.5 text-[12px] text-danger">
            {error}
          </p>
        )}

        <button
          onClick={() => void submit()}
          disabled={!isCompleteCode(code) || busy}
          className="btn-lift btn-primary mt-5 w-full py-3.5 text-[14px] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "確認しています…" : "確認する"}
        </button>

        <div className="mt-6 flex items-center justify-between gap-3 text-[12px]">
          <button
            onClick={() => void send()}
            disabled={sending || waitSec > 0}
            className="text-accent-soft underline-offset-4 hover:underline disabled:text-placeholder disabled:no-underline"
          >
            {waitSec > 0
              ? `再送できます（あと${waitSec}秒）`
              : sending
                ? "送信しています…"
                : "コードを再送する"}
          </button>
          <button
            onClick={() => void signOut()}
            className="text-muted hover:text-ink"
          >
            別のアカウントでログイン
          </button>
        </div>

        <p className="mt-8 text-[11px] leading-relaxed text-placeholder">
          コードが届かないときは迷惑メールをご確認ください。
          それでも届かない場合は、時間をおいて再送してください
        </p>
      </div>
    </main>
  );
}
