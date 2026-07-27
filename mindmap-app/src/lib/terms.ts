/**
 * 利用規約・プライバシーポリシーのバージョン管理（REL-03）。
 *
 * termsVersion を上げると、既存ユーザーは次回ログイン時に
 * /terms/accept へ誘導され、再合意しないと機能が使えなくなる。
 * 内容の実質的な変更（削除方針・データの扱い・年齢制限等）があるときのみ上げる。
 */
/**
 * 変更履歴:
 *  v1 (2026-07-24) 初版
 *  v2 (2026-07-28) REL-10/REL-09 に伴い、利用状況の計測（Google Analytics）と
 *                  エラー情報の収集（Sentry）をプライバシーポリシーに追記。
 *                  外部委託先も実態に合わせて更新（Netlify を追加）。
 *                  データの取り扱いが変わるため再合意を求める。
 */
export const TERMS_VERSION = 2;

/** 表示に使う最終改定日（`YYYY年M月D日`） */
export const TERMS_EFFECTIVE_DATE = "2026年7月28日";

/** 運営者名（利用規約・プライバシーポリシー冒頭に表示） */
export const OPERATOR_NAME = "思索 / Mindmap 運営";

/** サービスの対象年齢（下限） */
export const MIN_SERVICE_AGE = 5;

/** プロフィールが現行の利用規約に合意済みか */
export function hasAcceptedCurrentTerms(profile: {
  termsVersion?: number;
} | null | undefined): boolean {
  if (!profile) return false;
  return (profile.termsVersion ?? 0) >= TERMS_VERSION;
}
