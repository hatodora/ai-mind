import type { Instrumentation } from "next";
import { baseSentryOptions, isSentryEnabled } from "@/lib/observability";

/**
 * サーバー側の計測（REL-09）。
 * Next.js がサーバー起動時に register() を1回だけ呼び、
 * サーバーで捕捉した例外を onRequestError に渡してくる。
 *
 * DSN 未設定なら Sentry を読み込まずに何もしない（既定は完全無効）。
 */

export async function register() {
  if (!isSentryEnabled()) return;

  // 動的 import にして、無効時は SDK 自体をロードしない
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init(baseSentryOptions());
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init(baseSentryOptions());
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  if (!isSentryEnabled()) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(err, request, context);
};
