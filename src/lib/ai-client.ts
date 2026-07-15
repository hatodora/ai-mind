import { httpsCallable } from "firebase/functions";
import {
  firebaseAuth,
  firebaseFunctions,
  isFirebaseConfigured,
} from "./firebase";

/**
 * AI呼び出しの入り口を一本化する。
 *
 * - NEXT_PUBLIC_AI_BACKEND=functions かつログイン（メール確認）済み
 *   → Cloud Functions（IDトークン検証・レートリミット・キャッシュ付き。SEC-02）
 * - それ以外（未ログイン・未デプロイ環境）
 *   → 従来の Next.js API Routes にフォールバック
 *
 * Functions デプロイ後に .env.local へ NEXT_PUBLIC_AI_BACKEND=functions を
 * 追加すると切り替わる。
 */
function shouldUseFunctions(): boolean {
  if (process.env.NEXT_PUBLIC_AI_BACKEND !== "functions") return false;
  if (!isFirebaseConfigured()) return false;
  const user = firebaseAuth().currentUser;
  return !!user && user.emailVerified;
}

async function callFunction<T>(name: string, payload: unknown): Promise<T> {
  const fn = httpsCallable(firebaseFunctions(), name);
  const res = await fn(payload);
  return res.data as T;
}

async function callRoute<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "AI request failed");
  return json as T;
}

/**
 * 年齢帯（UP-06）とパーソナリティ（UP-04）。
 * サーバー側で許可リスト検証され、不正値・未指定は既定に落ちる。
 */
interface PersonaOptions {
  ageBand?: string;
  personality?: string;
}

export async function aiSuggest(
  payload: {
    theme: string;
    selectedNodeLabel: string;
    contextNodes: { id: string; label: string; role: string }[];
  } & PersonaOptions,
): Promise<{ suggestions: string[] }> {
  return shouldUseFunctions()
    ? callFunction("aiSuggest", payload)
    : callRoute("/api/ai/suggest", payload);
}

export async function aiExplain(
  payload: {
    label: string;
    theme: string;
  } & PersonaOptions,
): Promise<{ explanation: string }> {
  return shouldUseFunctions()
    ? callFunction("aiExplain", payload)
    : callRoute("/api/ai/explain", payload);
}

export async function aiReview(
  payload: {
    theme: string;
    nodes: { label: string; role: string }[];
  } & PersonaOptions,
): Promise<{ review: string }> {
  return shouldUseFunctions()
    ? callFunction("aiReview", payload)
    : callRoute("/api/ai/review", payload);
}
