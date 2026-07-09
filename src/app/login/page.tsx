"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isFirebaseConfigured } from "@/lib/firebase";

type Mode = "signin" | "signup";

/** Firebase Auth のエラーコードを日本語メッセージへ */
function errorMessage(e: unknown): string {
  const code =
    typeof e === "object" && e && "code" in e ? String(e.code) : "";
  switch (code) {
    case "auth/invalid-email":
      return "メールアドレスの形式が正しくありません";
    case "auth/email-already-in-use":
      return "このメールアドレスは既に登録されています";
    case "auth/weak-password":
      return "パスワードは8文字以上にしてください";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "メールアドレスまたはパスワードが正しくありません";
    case "auth/too-many-requests":
      return "試行回数が多すぎます。しばらく待ってから再度お試しください";
    case "auth/popup-closed-by-user":
      return "ログインがキャンセルされました";
    default:
      return e instanceof Error ? e.message : "エラーが発生しました";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const {
    user,
    initializing,
    needsVerification,
    needsProfile,
    signInGoogle,
    signUpEmail,
    signInEmail,
    signOut,
    resendVerification,
    refreshUser,
  } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  // ログイン完了後の行き先: プロフィール未登録なら /setup、それ以外はホーム
  useEffect(() => {
    if (initializing || !user || needsVerification) return;
    router.replace(needsProfile ? "/setup" : "/");
  }, [initializing, user, needsVerification, needsProfile, router]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = () =>
    run(async () => {
      if (mode === "signup") {
        if (password.length < 8) {
          throw new Error("パスワードは8文字以上にしてください");
        }
        await signUpEmail(email.trim(), password);
      } else {
        await signInEmail(email.trim(), password);
      }
    });

  if (!isFirebaseConfigured()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page px-5">
        <div className="card-soft max-w-md px-6 py-8 text-sm leading-relaxed text-muted">
          Firebase が設定されていないため、ログイン機能は利用できません。
          <Link href="/" className="mt-4 block text-accent-soft underline">
            ホームへ戻る
          </Link>
        </div>
      </main>
    );
  }

  // ---- メール確認待ち画面（2段階目） ----
  if (user && needsVerification) {
    return (
      <main className="min-h-screen bg-page px-5 py-10 sm:py-16">
        <div className="mx-auto max-w-md">
          <div className="anim-float-up card-soft p-6">
            <div className="micro-label mb-2">Verify Email</div>
            <h1 className="mb-3 font-display text-[24px] font-bold">
              メールを確認してください
            </h1>
            <p className="mb-5 text-sm leading-[1.9] text-muted">
              <span className="text-ink">{user.email}</span>{" "}
              宛に確認メールを送信しました。メール内のリンクをクリックして、
              登録を完了してください。完了するまでログインは有効になりません。
            </p>
            <button
              onClick={() => run(refreshUser)}
              disabled={busy}
              className="btn-lift btn-primary w-full py-3.5 text-[14px] disabled:opacity-40"
            >
              確認しました（再チェック）
            </button>
            <button
              onClick={() =>
                run(async () => {
                  await resendVerification();
                  setResent(true);
                })
              }
              disabled={busy}
              className="btn-lift btn-secondary mt-2 w-full py-3 text-[13px] disabled:opacity-40"
            >
              {resent ? "再送しました ✓" : "確認メールを再送する"}
            </button>
            <button
              onClick={() => run(signOut)}
              className="mt-4 w-full text-center text-xs text-muted underline underline-offset-4 hover:text-ink"
            >
              別のアカウントでやり直す
            </button>
            {error && (
              <div className="mt-4 rounded-[12px] bg-tint-danger px-4 py-3 text-[13px] text-danger">
                {error}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ---- ログイン / 新規登録 ----
  return (
    <main className="min-h-screen bg-page px-5 py-10 sm:py-16">
      <div className="mx-auto max-w-md">
        <Link href="/" className="icon-circle anim-float-up mb-10" aria-label="ホームへ戻る">
          <span className="font-display text-lg leading-none">←</span>
        </Link>

        <div className="anim-float-up" style={{ animationDelay: "0.06s" }}>
          <div className="micro-label mb-2">Account</div>
          <h1 className="mb-2.5 font-display text-[30px] font-bold leading-snug tracking-tight">
            {mode === "signin" ? "おかえりなさい" : "アカウントを作る"}
          </h1>
          <p className="mb-8 text-sm leading-relaxed text-muted">
            ログインすると、マップがクラウドに保存され
            どの端末からでも続きを考えられます
          </p>

          {/* モード切替 */}
          <div className="mb-6 flex rounded-[12px] border border-line bg-card p-1">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 rounded-[9px] py-2.5 text-[13px] font-bold transition-colors ${
                  mode === m
                    ? "bg-accent text-on-accent"
                    : "text-muted hover:text-ink"
                }`}
              >
                {m === "signin" ? "ログイン" : "新規登録"}
              </button>
            ))}
          </div>

          {/* Google */}
          <button
            onClick={() => run(signInGoogle)}
            disabled={busy}
            className="btn-lift btn-secondary flex w-full items-center justify-center gap-3 py-3.5 text-[14px] font-bold disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 18.9 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41 35.4 44 30.2 44 24c0-1.3-.1-2.6-.4-3.9z"/>
            </svg>
            Google でつづける
          </button>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[11px] tracking-widest text-muted">
              またはメールで
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>

          {/* メール / パスワード */}
          <div className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="メールアドレス"
              autoComplete="email"
              className="w-full rounded-[12px] border border-line bg-card px-5 py-3.5 text-[15px] text-ink outline-none ring-accent/40 transition-shadow placeholder:text-placeholder focus:border-accent/60 focus:ring-2"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
              placeholder={
                mode === "signup" ? "パスワード（8文字以上）" : "パスワード"
              }
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              className="w-full rounded-[12px] border border-line bg-card px-5 py-3.5 text-[15px] text-ink outline-none ring-accent/40 transition-shadow placeholder:text-placeholder focus:border-accent/60 focus:ring-2"
            />
          </div>

          {mode === "signup" && (
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              登録後、確認メールを送信します。メール内のリンクをクリックすると
              登録が完了します（2段階確認・必須）。
            </p>
          )}

          <button
            onClick={handleEmailSubmit}
            disabled={busy || !email.trim() || !password}
            className="btn-lift btn-primary mt-6 w-full py-4 text-[15px] disabled:opacity-40"
          >
            {busy
              ? "処理中…"
              : mode === "signin"
                ? "ログイン"
                : "登録してメールを確認する"}
          </button>

          {error && (
            <div className="mt-4 rounded-[12px] bg-tint-danger px-4 py-3 text-[13px] text-danger">
              {error}
            </div>
          )}

          <p className="mt-8 text-center text-xs leading-relaxed text-muted">
            ログインせずに使うこともできます（この端末のみ・
            <span className="text-ink">30日間</span>保存）
            <br />
            <Link href="/" className="text-accent-soft underline underline-offset-4">
              ログインせずに続ける
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
