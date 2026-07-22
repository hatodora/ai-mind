import { httpsCallable } from "firebase/functions";
import { firebaseFunctions } from "./firebase";

/**
 * 共同編集の招待（NF-01a）。
 * invites/{token} はルールでクライアント直アクセス禁止のため、
 * 発行・受諾は必ず Cloud Functions を通す（Groq は使わない軽量呼び出し）。
 */

export async function createMapInvite(mapId: string): Promise<string> {
  const fn = httpsCallable(firebaseFunctions(), "createMapInvite");
  const res = await fn({ mapId });
  return (res.data as { token: string }).token;
}

export async function acceptMapInvite(token: string): Promise<string> {
  const fn = httpsCallable(firebaseFunctions(), "acceptMapInvite");
  const res = await fn({ token });
  return (res.data as { mapId: string }).mapId;
}

/** 招待リンクのURLを組み立てる */
export function inviteUrl(token: string): string {
  return `${window.location.origin}/join/${token}`;
}
