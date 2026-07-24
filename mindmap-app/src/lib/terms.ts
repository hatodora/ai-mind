/**
 * 利用規約・プライバシーポリシーのバージョン管理（REL-03）。
 *
 * termsVersion を上げると、既存ユーザーは次回ログイン時に
 * /terms/accept へ誘導され、再合意しないと機能が使えなくなる。
 * 内容の実質的な変更（削除方針・データの扱い・年齢制限等）があるときのみ上げる。
 */
export const TERMS_VERSION = 1;

/** 表示に使う最終改定日（`YYYY年M月D日`） */
export const TERMS_EFFECTIVE_DATE = "2026年7月24日";

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
