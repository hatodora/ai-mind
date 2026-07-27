/**
 * エラートラッキング（REL-09）の共通設定。
 *
 * 設計方針は REL-06 と同じ「既定は完全に無効」:
 * NEXT_PUBLIC_SENTRY_DSN が未設定なら Sentry は一切初期化されず、
 * ネットワーク送信も発生しない。設定して初めて有効になる。
 *
 * プライバシー上の注意（REL-03 のプライバシーポリシーと整合させること）:
 * このアプリが扱うのは「利用者が考えていることそのもの」であり、
 * マップのテーマ・ノード本文は極めてセンシティブ。したがって
 * エラーレポートには本文を一切載せない。scrubEvent() で
 * リクエストボディ・Cookie・メールアドレスを送信前に落とす。
 */

/**
 * 環境変数を「未設定」として扱う判定。
 * .env テンプレートは `KEY=` の形で空文字を置くことがあり、
 * `??` では素通りしてしまうため、空文字も未設定とみなす。
 */
function firstSet(...values: (string | undefined)[]): string | undefined {
  for (const v of values) {
    if (v !== undefined && v.trim() !== "") return v;
  }
  return undefined;
}

/** Sentry の DSN。公開前提の値（プロジェクトの宛先を示すだけで書き込み権限は持たない） */
export const SENTRY_DSN = firstSet(process.env.NEXT_PUBLIC_SENTRY_DSN);

/** DSN が設定されているときだけ Sentry を有効化する */
export function isSentryEnabled(): boolean {
  return Boolean(SENTRY_DSN);
}

/**
 * 環境名。Sentry 上で本番とプレビューを混ぜないために使う。
 * Vercel は VERCEL_ENV（production / preview / development）、
 * Netlify は CONTEXT（production / deploy-preview / branch-deploy）を渡してくる。
 */
export function sentryEnvironment(): string {
  return (
    firstSet(
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      process.env.VERCEL_ENV,
      process.env.CONTEXT,
      process.env.NODE_ENV,
    ) ?? "development"
  );
}

/**
 * リリース識別子。どのデプロイで出たエラーかを追えるようにする。
 * Vercel / Netlify がそれぞれコミットSHAを環境変数で渡してくる。
 */
export function sentryRelease(): string | undefined {
  return firstSet(
    process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.COMMIT_REF,
  );
}

/**
 * パフォーマンストレースのサンプリング率。
 * 無料枠を食い潰さないよう本番でも低めに保つ（必要なら環境変数で上げる）。
 */
export function tracesSampleRate(): number {
  const raw = firstSet(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE);
  const parsed = raw === undefined ? NaN : Number(raw);
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
  return sentryEnvironment() === "production" ? 0.1 : 0;
}

/**
 * 送信前にセンシティブな値を落とす対象の形。
 * SDK に依存しないよう、実際に触るプロパティだけを緩く宣言する
 * （Sentry の ErrorEvent がそのまま代入できる範囲に留めること）。
 */
type ScrubbableEvent = {
  request?: {
    data?: unknown;
    cookies?: unknown;
    headers?: Record<string, string>;
    query_string?: unknown;
  };
  user?: Record<string, unknown>;
  breadcrumbs?: { data?: Record<string, unknown> }[];
};

/** ヘッダのうち、残しても害がなくデバッグに役立つものだけを通す */
const SAFE_HEADERS = new Set(["user-agent", "referer", "content-type"]);

/**
 * リクエスト本文・Cookie・メールアドレス等を送信前に除去する。
 *
 * 特に /api/ai/* のボディにはマップのテーマとノード本文（＝利用者の思考）が
 * そのまま入るため、ここで必ず落とす。uid は残す（本人特定ではなく
 * 「同じ人に繰り返し起きているか」の判断に必要で、問い合わせ対応にも使う）。
 */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    if (event.request.headers) {
      for (const key of Object.keys(event.request.headers)) {
        if (!SAFE_HEADERS.has(key.toLowerCase())) {
          delete event.request.headers[key];
        }
      }
    }
  }

  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
  }

  // パンくずにも fetch のボディが載りうるので同様に落とす
  if (Array.isArray(event.breadcrumbs)) {
    for (const crumb of event.breadcrumbs) {
      if (crumb.data) {
        delete crumb.data.body;
        delete crumb.data.input;
      }
    }
  }

  return event;
}

/**
 * 共通の初期化オプション。クライアント／サーバーの両方から使う。
 * DSN が無い場合はそもそも init を呼ばない前提。
 */
export function baseSentryOptions() {
  return {
    dsn: SENTRY_DSN,
    environment: sentryEnvironment(),
    release: sentryRelease(),
    tracesSampleRate: tracesSampleRate(),
    // 既定でもfalseだが、扱う情報の性質上あえて明示する
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  };
}
