/**
 * お問い合わせ（REL-04）の共通定義。
 * inquiries/{id} に保存され、管理者（Firebase カスタムクレーム admin: true）のみ閲覧できる。
 */

export type InquiryCategory =
  | "bug"
  | "deletion"
  | "birthdate"
  | "account"
  | "other";

export const CATEGORY_LABEL: Record<InquiryCategory, string> = {
  bug: "不具合の報告",
  deletion: "アカウント・データ削除の依頼",
  birthdate: "誕生日の変更依頼（回数上限後）",
  account: "アカウントに関する相談",
  other: "その他",
};

const CATEGORIES: readonly InquiryCategory[] = [
  "bug",
  "deletion",
  "birthdate",
  "account",
  "other",
];

/** メールアドレスの上限（Firestore rules と揃える） */
export const EMAIL_MAX = 320;
/** 本文の上限（Firestore rules と揃える） */
export const MESSAGE_MAX = 4000;

export function isValidCategory(v: unknown): v is InquiryCategory {
  return CATEGORIES.includes(v as InquiryCategory);
}

/** ざっくりとしたメール形式チェック（サーバー側は rules で長さのみ検証） */
export function isValidEmail(v: string): boolean {
  if (v.length === 0 || v.length > EMAIL_MAX) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export interface Inquiry {
  id: string;
  category: InquiryCategory;
  email: string;
  message: string;
  /** 送信者のUID。ログインユーザーのみ送信可能なので必須 */
  submittedByUid: string;
  /** 対応状況。作成時は "new"。以降は管理側でのみ更新 */
  status: "new" | "in_progress" | "done";
  createdAt: number;
  updatedAt: number;
}
