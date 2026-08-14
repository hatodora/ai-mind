"use client";

import { httpsCallable } from "firebase/functions";
import { firebaseAuth, firebaseFunctions } from "@/lib/firebase";

/**
 * 2要素認証の呼び出し口（MFA-03）。
 *
 * 判定と整形は two-factor.ts、実際の発行と照合はサーバー（Cloud Functions）。
 * ここはその間をつなぐだけ。
 */

/** コードを送った先（伏せ字）と期限 */
export interface CodeSent {
  sentTo: string;
  expiresAt: number;
}

/** 6桁コードをメールで送る */
export async function sendTwoFactorCode(): Promise<CodeSent> {
  const fn = httpsCallable<void, CodeSent>(
    firebaseFunctions(),
    "startTwoFactor",
  );
  const res = await fn();
  return res.data;
}

/**
 * 6桁コードを照合する。
 *
 * 通ったらサーバーがカスタムクレームを書き換えるが、
 * 手元のIDトークンは古いままなので取り直す。
 * これを忘れると、検証したのに Firestore がずっと拒否し続ける。
 */
export async function verifyTwoFactorCode(code: string): Promise<void> {
  const fn = httpsCallable<{ code: string }, { verifiedAt: number }>(
    firebaseFunctions(),
    "verifyTwoFactor",
  );
  await fn({ code });
  await firebaseAuth().currentUser?.getIdToken(true);
}

/**
 * 2要素認証の有効／無効を切り替える。
 *
 * サーバー側で「直前に6桁コードを通していること」を必須にしている。
 * こちらでも、切り替えたあとトークンを取り直す。
 */
export async function setTwoFactorEnabled(enabled: boolean): Promise<void> {
  const fn = httpsCallable<{ enabled: boolean }, { enabled: boolean }>(
    firebaseFunctions(),
    "setTwoFactorEnabled",
  );
  await fn({ enabled });
  await firebaseAuth().currentUser?.getIdToken(true);
}

/**
 * Cloud Functions のエラーを、画面に出せる日本語にする。
 *
 * HttpsError の message はこちらで書いた文言がそのまま入るので基本は使えるが、
 * 通信断などでは英語の内部メッセージが出るため、そこだけ差し替える。
 */
export function twoFactorErrorMessage(e: unknown): string {
  const message = e instanceof Error ? e.message : "";
  // Firebase SDK は "FirebaseError: functions/xxx message" の形で投げてくる
  const cleaned = message.replace(/^.*?:\s*/, "").trim();
  if (!cleaned || /internal|network|unavailable|deadline/i.test(cleaned)) {
    return "通信に失敗しました。電波の良い場所で、もう一度お試しください";
  }
  return cleaned;
}
