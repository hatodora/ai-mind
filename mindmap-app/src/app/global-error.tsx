"use client"; // エラー境界は Client Component である必要がある

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { isSentryEnabled } from "@/lib/observability";
import "./globals.css";

/**
 * ルートレイアウトごと落ちたときの最終防衛線（REL-09）。
 * このファイルはルートレイアウトを置き換えるため、html/body と
 * グローバルCSSを自前で持つ必要がある。
 *
 * ここに来た時点で表示は失敗しているので、
 * 「何が起きたか」より「次にどうすればいいか」を出すことを優先する。
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    if (isSentryEnabled()) {
      Sentry.captureException(error);
    } else {
      console.error(error);
    }
  }, [error]);

  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full">
        <title>エラーが発生しました — 思索 / Mindmap</title>
        <main className="flex min-h-screen items-center justify-center bg-page px-5">
          <div className="w-full max-w-sm text-center">
            <h1 className="mb-3 font-display text-2xl font-bold text-ink">
              うまく表示できませんでした
            </h1>
            <p className="mb-8 text-sm leading-relaxed text-muted">
              一時的な問題の可能性があります。
              作成中のマップは保存されているので、
              もう一度読み込んでみてください。
            </p>

            <button
              onClick={() => unstable_retry()}
              className="btn-lift btn-primary w-full py-3.5 text-[15px]"
            >
              もう一度読み込む
            </button>

            {/*
              ここはルートレイアウトごと落ちた後なので、クライアント側の
              ルーターが壊れている可能性がある。next/link のソフト遷移では
              復帰できないことがあるため、あえて素の <a> でハードリロードする。
            */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="mt-4 block text-sm text-accent-soft underline underline-offset-4"
            >
              ホームへ戻る
            </a>

            {error.digest && (
              <p className="mt-8 text-xs text-muted">
                お問い合わせの際はこの番号をお知らせください: {error.digest}
              </p>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
