/**
 * 2要素認証の取り決め（MFA-01）。
 *
 * Firebase Authentication の多要素認証は Identity Platform（有料）が要るうえ、
 * SMS と TOTP しか無く、メールの6桁コードは提供されていない。
 * そこでアプリ側で実装している。
 *
 * 画面を隠すだけでは意味がない（IDトークンを直接使えば Firestore を叩ける）ので、
 * 実際の境界はカスタムクレームとセキュリティルールで作る。
 *
 *   ①ログイン → ②コード送信 → ③6桁入力 → ④Functions が検証
 *     → ⑤クレーム mfa=<時刻> を付与 → ⑥クライアントがトークンを取り直す
 *     → ⑦ルールが mfa の鮮度を見て許可
 *
 * クレームは2つとも IDトークンに載るので、ルール側で追加の読み取りが要らない。
 *   mfaRequired: この利用者は2要素認証を有効にしている
 *   mfa:         最後に6桁コードを通した時刻（ミリ秒）
 *
 * ここに置くのは判定と整形だけ。コードの発行と照合はサーバー側にしかない。
 * 同じ値を functions/src/two-factor.ts でも持っている（別ビルドのため）。
 * 変えるときは両方を直すこと。
 */

/** コードの桁数 */
export const MFA_CODE_LENGTH = 6;

/**
 * 一度通したら、この期間は聞き直さない。
 * 日常的に使うアプリで毎回聞くのは重すぎる一方、
 * 端末を失くしたときに無期限で通り続けるのも困る。
 */
export const MFA_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

/** 発行したコードの有効期限 */
export const MFA_CODE_TTL_MS = 10 * 60 * 1000;

/** 間違えられる回数。超えたら再送してもらう */
export const MFA_MAX_ATTEMPTS = 5;

/** 再送できるようになるまでの間隔 */
export const MFA_RESEND_COOLDOWN_MS = 60 * 1000;

/** IDトークンのカスタムクレーム。中身は信用できないので unknown で受ける */
export interface MfaClaims {
  mfaRequired?: unknown;
  mfa?: unknown;
}

/** この利用者は2要素認証を有効にしているか */
export function isTwoFactorEnabled(claims: MfaClaims): boolean {
  return claims.mfaRequired === true;
}

/**
 * 直近の検証がまだ生きているか。
 *
 * クレームは他人が書き換えられない（Admin SDK でしか付けられない）が、
 * 型は保証されないので、数値でなければ «通っていない» 扱いにする。
 */
export function hasFreshVerification(
  claims: MfaClaims,
  nowMs: number,
  sessionMs = MFA_SESSION_MS,
): boolean {
  const at = claims.mfa;
  if (typeof at !== "number" || !Number.isFinite(at)) return false;
  // 未来の時刻は壊れた値。通してしまうと期限が効かなくなる
  if (at > nowMs) return false;
  return nowMs - at < sessionMs;
}

/**
 * いま6桁コードを求めるべきか。
 *
 * 有効にしていない人には求めない。有効な人でも、
 * 直近に通していれば求めない。
 */
export function needsTwoFactor(
  claims: MfaClaims,
  nowMs: number,
  sessionMs = MFA_SESSION_MS,
): boolean {
  if (!isTwoFactorEnabled(claims)) return false;
  return !hasFreshVerification(claims, nowMs, sessionMs);
}

/**
 * 入力を6桁の数字だけに整える。
 *
 * メールから貼り付けると空白やハイフンが混ざることがあるので、
 * 数字以外は落として桁数で切る。
 */
export function normalizeCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, MFA_CODE_LENGTH);
}

/** 送信できる形になっているか */
export function isCompleteCode(code: string): boolean {
  return new RegExp(`^\\d{${MFA_CODE_LENGTH}}$`).test(code);
}

/** 再送できるまでの残り秒。0 なら送れる */
export function resendWaitSeconds(
  lastSentAtMs: number | null,
  nowMs: number,
  cooldownMs = MFA_RESEND_COOLDOWN_MS,
): number {
  if (lastSentAtMs === null) return 0;
  const remain = cooldownMs - (nowMs - lastSentAtMs);
  return remain > 0 ? Math.ceil(remain / 1000) : 0;
}
