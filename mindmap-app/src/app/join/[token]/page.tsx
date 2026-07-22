"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { acceptMapInvite } from "@/lib/share";
import { isFirebaseConfigured } from "@/lib/firebase";

/**
 * 共同編集への参加ページ（NF-01a）。
 * 招待リンク /join/{token} を開くと、ログイン済みなら自動で参加してマップへ移動。
 * 未ログイン・プロフィール未登録なら案内を出す。
 */
export default function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const { user, initializing, needsVerification, needsProfile } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const ready =
    !initializing &&
    !!user &&
    user.emailVerified &&
    !needsVerification &&
    !needsProfile;

  useEffect(() => {
    if (!ready || error) return;
    // setState を effect 内で直接呼ばない（次のティックで参加処理を開始）。
    // acceptMapInvite は冪等なので、StrictMode の二重実行でも問題ない
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      acceptMapInvite(token)
        .then((mapId) => {
          if (!cancelled) router.replace(`/map/${mapId}`);
        })
        .catch((e) => {
          console.error("招待の受諾に失敗しました", e);
          if (!cancelled) {
            setError(
              e instanceof Error && e.message.includes("期限")
                ? "この招待リンクは無効か、期限切れです"
                : "参加できませんでした。リンクが正しいか確認してください",
            );
          }
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // error を依存に含めるのは再試行ループ防止のため（error 発生後は再実行しない）
  }, [ready, token, router, error]);

  const body = () => {
    if (!isFirebaseConfigured()) {
      return (
        <p className="text-sm text-muted">
          この環境では共同編集を利用できません
        </p>
      );
    }
    if (initializing || (ready && !error)) {
      return <p className="text-sm text-muted">マップに参加しています…</p>;
    }
    if (error) {
      return (
        <>
          <p className="mb-5 text-sm text-danger">{error}</p>
          <Link
            href="/"
            className="text-sm text-accent-soft underline underline-offset-4"
          >
            ホームへ戻る
          </Link>
        </>
      );
    }
    if (!user) {
      return (
        <>
          <p className="mb-5 text-sm leading-relaxed text-muted">
            共同編集に参加するにはログインが必要です。
            <br />
            ログイン後、もう一度この招待リンクを開いてください。
          </p>
          <Link href="/login" className="btn-lift btn-primary px-6 py-3 text-[13px]">
            ログインする
          </Link>
        </>
      );
    }
    if (needsVerification) {
      return (
        <p className="text-sm leading-relaxed text-muted">
          メールアドレスの確認が完了していません。
          確認メールのリンクを開いてから、もう一度この招待リンクを開いてください。
        </p>
      );
    }
    // needsProfile
    return (
      <>
        <p className="mb-5 text-sm leading-relaxed text-muted">
          参加にはプロフィール登録が必要です。
          <br />
          登録後、もう一度この招待リンクを開いてください。
        </p>
        <Link href="/setup" className="btn-lift btn-primary px-6 py-3 text-[13px]">
          プロフィールを登録する
        </Link>
      </>
    );
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-5">
      <div className="anim-float-up w-full max-w-sm rounded-[16px] border border-line bg-card p-8 text-center">
        <div className="mb-2 font-display text-lg font-bold">
          共同編集への招待
        </div>
        {body()}
      </div>
    </main>
  );
}
