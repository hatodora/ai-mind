/**
 * Cloud Functions のエラー収集（REL-09）。
 *
 * Web 側（src/lib/observability.ts）と同じ方針:
 * SENTRY_DSN が未設定なら SDK を読み込まず、送信も発生しない。
 *
 * サーバーレス特有の注意:
 *  - SDK は動的 import にする。無効時はコールドスタートに一切影響させない
 *  - 関数が終了するとプロセスが凍結されうるので、送信後は必ず flush する
 *  - 送信できなくても本来の処理は止めない（計測はベストエフォート）
 */
import { logger } from "firebase-functions";

const SENTRY_DSN = process.env.SENTRY_DSN?.trim();

/** DSN が設定されているときだけ有効 */
export function isSentryEnabled(): boolean {
  return Boolean(SENTRY_DSN);
}

type SentryModule = typeof import("@sentry/node");

let sentryPromise: Promise<SentryModule | null> | null = null;

/** SDK を1度だけ読み込んで初期化する */
function getSentry(): Promise<SentryModule | null> {
  if (!isSentryEnabled()) return Promise.resolve(null);
  if (!sentryPromise) {
    sentryPromise = import("@sentry/node")
      .then((Sentry) => {
        Sentry.init({
          dsn: SENTRY_DSN,
          environment: process.env.SENTRY_ENVIRONMENT ?? "production",
          release: process.env.SENTRY_RELEASE,
          // 扱う情報の性質上、PII は送らない（REL-03 のポリシーと整合）
          sendDefaultPii: false,
          // トレースは使わない（Functions のコストと無料枠を優先）
          tracesSampleRate: 0,
        });
        return Sentry;
      })
      .catch((e) => {
        logger.warn("Sentry の初期化に失敗しました", e);
        return null;
      });
  }
  return sentryPromise;
}

/** Sentry へ送りきってから戻る。失敗しても投げない */
async function flush(Sentry: SentryModule): Promise<void> {
  try {
    await Sentry.flush(2000);
  } catch {
    // 送信できなくても本来の処理は続ける
  }
}

/**
 * 想定外の例外を記録する。
 * uid は「同じ人に繰り返し起きているか」の判断に使うので残すが、
 * マップ本文などの入力データは決して渡さないこと。
 */
export async function reportError(
  err: unknown,
  context: { fn: string; uid?: string; extra?: Record<string, unknown> },
): Promise<void> {
  logger.error(`[${context.fn}] ${String(err)}`, context.extra ?? {});
  const Sentry = await getSentry();
  if (!Sentry) return;
  try {
    Sentry.withScope((scope) => {
      scope.setTag("function", context.fn);
      if (context.uid) scope.setUser({ id: context.uid });
      if (context.extra) scope.setContext("details", context.extra);
      Sentry.captureException(err);
    });
    await flush(Sentry);
  } catch {
    // 計測の失敗で本来の処理を巻き込まない
  }
}

/**
 * 例外ではないが検知したい事象を記録する。
 * 主用途は REL-06 の全体サーキットブレーカー到達（＝全利用者のAIが止まる）。
 */
export async function reportEvent(
  message: string,
  context: { fn: string; level?: "warning" | "error"; extra?: Record<string, unknown> },
): Promise<void> {
  const level = context.level ?? "warning";
  logger.warn(`[${context.fn}] ${message}`, context.extra ?? {});
  const Sentry = await getSentry();
  if (!Sentry) return;
  try {
    Sentry.withScope((scope) => {
      scope.setTag("function", context.fn);
      scope.setLevel(level);
      if (context.extra) scope.setContext("details", context.extra);
      Sentry.captureMessage(message, level);
    });
    await flush(Sentry);
  } catch {
    // 同上
  }
}
