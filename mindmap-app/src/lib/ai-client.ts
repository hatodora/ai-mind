import { httpsCallable } from "firebase/functions";
import {
  firebaseAuth,
  firebaseFunctions,
  isFirebaseConfigured,
} from "./firebase";
import { track } from "./analytics";

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
  // ゲートウェイ由来の 502 等は JSON でないことがある。
  // 生のパースエラーではなく読める日本語エラーにする
  let json: { error?: string } | null = null;
  try {
    json = (await res.json()) as { error?: string };
  } catch {
    json = null;
  }
  if (!res.ok) {
    throw new Error(json?.error || `AIリクエストに失敗しました (${res.status})`);
  }
  if (json === null) throw new Error("AI応答の解析に失敗しました");
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

/**
 * 計測（REL-10）。成功した呼び出しだけを数える
 * （失敗まで数えると「AI利用数」がコストと噛み合わなくなるため）。
 * 送るのは種別と設定値だけで、テーマ・ノード本文は一切含めない。
 */
function trackAiUse(
  event: "ai_suggest_used" | "ai_explain_used" | "ai_review_used",
  persona: PersonaOptions,
): void {
  void track(event, {
    age_band: persona.ageBand,
    personality: persona.personality,
  });
}

export async function aiSuggest(
  payload: {
    theme: string;
    selectedNodeLabel: string;
    contextNodes: { id: string; label: string; role: string }[];
  } & PersonaOptions,
): Promise<{ suggestions: string[] }> {
  const result = await (shouldUseFunctions()
    ? callFunction<{ suggestions: string[] }>("aiSuggest", payload)
    : callRoute<{ suggestions: string[] }>("/api/ai/suggest", payload));
  trackAiUse("ai_suggest_used", payload);
  return result;
}

export async function aiExplain(
  payload: {
    label: string;
    theme: string;
  } & PersonaOptions,
): Promise<{ explanation: string }> {
  const result = await (shouldUseFunctions()
    ? callFunction<{ explanation: string }>("aiExplain", payload)
    : callRoute<{ explanation: string }>("/api/ai/explain", payload));
  trackAiUse("ai_explain_used", payload);
  return result;
}

export async function aiReview(
  payload: {
    theme: string;
    nodes: { label: string; role: string }[];
  } & PersonaOptions,
): Promise<{
  review: string;
  usedNodeLabels?: string[];
  /** マップ全体のトピック分類（NF-05）。パース失敗時は無い */
  categories?: { name: string; nodes: string[] }[];
}> {
  type ReviewResult = {
    review: string;
    usedNodeLabels?: string[];
    categories?: { name: string; nodes: string[] }[];
  };
  const result = await (shouldUseFunctions()
    ? callFunction<ReviewResult>("aiReview", payload)
    : callRoute<ReviewResult>("/api/ai/review", payload));
  trackAiUse("ai_review_used", payload);
  return result;
}
