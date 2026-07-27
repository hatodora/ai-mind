import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions, isSentryEnabled } from "@/lib/observability";

/**
 * クライアント側の計測（REL-09）。
 * このファイルはアプリが操作可能になる前に実行される。
 *
 * DSN 未設定なら init を呼ばない。Sentry SDK は init されない限り
 * 送信もフックもしないため、実質的に無効化される。
 *
 * 計測の失敗でアプリを壊さないよう、全体を try/catch で囲う
 * （Next.js のドキュメントが推奨している防御）。
 */
try {
  if (isSentryEnabled()) {
    Sentry.init({
      ...baseSentryOptions(),
      // セッションリプレイは思考内容が映り込むため使わない（REL-03 と整合）
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
    });
  }
} catch {
  // 計測の初期化失敗は握りつぶす（アプリ本体の動作を優先）
}

/** App Router のナビゲーション計測。無効時は Sentry 側が何もしない */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
