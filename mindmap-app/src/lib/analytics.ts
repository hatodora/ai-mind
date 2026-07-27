import { firebaseAppForAnalytics, isAnalyticsConfigured } from "./firebase";

/**
 * 利用状況モニタリング（REL-10）。
 *
 * 方針は REL-06 / REL-09 と同じ「既定は完全に無効」:
 * NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID が未設定なら
 * Analytics SDK を読み込まず、送信も発生しない。
 *
 * 何を測るか（RELEASE_ROADMAP.md の REL-10）:
 *  - マップ作成数 / AI利用数 / 完成率 / コミュニティ投稿数
 *
 * 何を測らないか（重要）:
 *  テーマ名・ノード本文・結論などの「利用者が考えた内容」は一切送らない。
 *  送るのは件数や種別のような、本人に紐づかない数値・列挙値だけに限る。
 *  この線引きはプライバシーポリシー（/privacy）と揃えること。
 */

/** 計測するイベント名（GA4 の慣習に合わせて snake_case） */
export type AnalyticsEvent =
  | "map_created"
  | "map_completed"
  | "ai_suggest_used"
  | "ai_review_used"
  | "ai_explain_used"
  | "helper_used"
  | "community_post_created";

/**
 * イベントに添えてよいパラメータ。
 * 自由文字列を受け取らないことで、本文の誤送信を型で防ぐ。
 */
export interface AnalyticsParams {
  /** そのときのノード数 */
  node_count?: number;
  /** AI が作ったノードの割合（0〜1 を小数第2位に丸めたもの） */
  ai_ratio?: number;
  /** アシストレベル（level1 / level2 / level3 / off） */
  assist_level?: string;
  /** AIパーソナリティ（advisor / boss / analyst） */
  personality?: string;
  /** 年齢帯（essential / education / teenager / worker） */
  age_band?: string;
}

type AnalyticsModule = typeof import("firebase/analytics");

let analyticsPromise: Promise<{
  mod: AnalyticsModule;
  instance: ReturnType<AnalyticsModule["getAnalytics"]>;
} | null> | null = null;

/**
 * Analytics を1度だけ初期化する。
 * SSR・非対応ブラウザ・トラッキング防止拡張などで失敗しうるので、
 * どのケースでも null を返してアプリ本体には影響させない。
 */
function getAnalytics() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!isAnalyticsConfigured()) return Promise.resolve(null);

  if (!analyticsPromise) {
    analyticsPromise = (async () => {
      try {
        const app = firebaseAppForAnalytics();
        if (!app) return null;
        const mod = await import("firebase/analytics");
        // 非対応環境（一部のブラウザ・埋め込み等）ではここで false になる
        if (!(await mod.isSupported())) return null;
        return { mod, instance: mod.getAnalytics(app) };
      } catch {
        // 計測の初期化失敗は無視する（アプリ本体の動作を優先）
        return null;
      }
    })();
  }
  return analyticsPromise;
}

/**
 * イベントを記録する。計測が無効・失敗しても呼び出し側は気にしなくてよい
 * （await 不要。戻り値の Promise は常に解決する）。
 */
export async function track(
  event: AnalyticsEvent,
  params?: AnalyticsParams,
): Promise<void> {
  try {
    const analytics = await getAnalytics();
    if (!analytics) return;
    analytics.mod.logEvent(analytics.instance, event, params);
  } catch {
    // 計測の失敗で利用者の操作を止めない
  }
}

/** AI使用率を計測用に丸める（生の割合をそのまま送らず粒度を落とす） */
export function roundRatio(ratio: number): number {
  return Math.round(ratio * 100) / 100;
}
