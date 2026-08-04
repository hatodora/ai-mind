import { FirebaseError } from "firebase/app";
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
 * - ログイン済み
 *   → Cloud Functions（IDトークン検証・レートリミット・キャッシュ付き。SEC-02）
 * - 未ログイン・Firebase 未設定
 *   → Next.js API Routes（認証なし。本番では REL-06 により閉じている）
 *
 * 既定を Functions 側にしているのは、環境変数の設定漏れが
 * 「ログイン済みなのに未認証経路へ流れて 403」という形で表面化したため。
 * 旧経路を強制したいとき（Functions 未デプロイの検証環境など）だけ
 * NEXT_PUBLIC_AI_BACKEND=routes を設定する。
 */
function isRoutesForced(): boolean {
  return process.env.NEXT_PUBLIC_AI_BACKEND === "routes";
}

async function shouldUseFunctions(): Promise<boolean> {
  if (isRoutesForced()) return false;
  if (!isFirebaseConfigured()) return false;
  const auth = firebaseAuth();
  // 復元中は currentUser が一時的に null になる。ここで待たないと
  // リロード直後の AI 実行だけ未認証経路へ落ちてしまう
  await auth.authStateReady();
  return auth.currentUser !== null;
}

/**
 * Functions のエラーコードを、次に何をすればいいか分かる日本語にする。
 * HttpsError で投げたメッセージ（メール未確認・上限超過など）は
 * そのまま見せたほうが正確なので温存する。
 */
function describeFunctionError(e: unknown): Error {
  if (!(e instanceof FirebaseError)) {
    return e instanceof Error ? e : new Error("AIリクエストに失敗しました");
  }
  switch (e.code.replace(/^functions\//, "")) {
    case "unauthenticated":
      return new Error(
        "ログインの有効期限が切れています。一度ログアウトして再度ログインしてください",
      );
    case "unavailable":
    case "deadline-exceeded":
      return new Error(
        "AIサーバーに接続できませんでした。通信環境を確認して、もう一度お試しください",
      );
    case "not-found":
    case "unimplemented":
      return new Error(
        "AI機能がまだ有効になっていません（Cloud Functions が未デプロイです）",
      );
    default:
      // permission-denied（メール未確認・App Check 不通過）や
      // resource-exhausted（上限超過）はサーバー側の文言が最も具体的
      return new Error(e.message || "AIリクエストに失敗しました");
  }
}

/**
 * Functions 未デプロイのローカル開発だけ旧経路に落とす。
 * 本番で落とすと未認証経路の 403 に化けて原因が見えなくなるため落とさない。
 */
function canFallBackToRoute(e: unknown): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (!(e instanceof FirebaseError)) return false;
  return /(not-found|unimplemented|unavailable)$/.test(e.code);
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

/** 経路選択・フォールバック・エラー整形をまとめた共通の呼び出し口 */
async function callAi<T>(
  fnName: string,
  routePath: string,
  payload: unknown,
): Promise<T> {
  if (!(await shouldUseFunctions())) {
    return callRoute<T>(routePath, payload);
  }
  try {
    return await callFunction<T>(fnName, payload);
  } catch (e) {
    if (canFallBackToRoute(e)) return callRoute<T>(routePath, payload);
    throw describeFunctionError(e);
  }
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
  const result = await callAi<{ suggestions: string[] }>(
    "aiSuggest",
    "/api/ai/suggest",
    payload,
  );
  trackAiUse("ai_suggest_used", payload);
  return result;
}

export async function aiExplain(
  payload: {
    label: string;
    theme: string;
  } & PersonaOptions,
): Promise<{ explanation: string }> {
  const result = await callAi<{ explanation: string }>(
    "aiExplain",
    "/api/ai/explain",
    payload,
  );
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
  const result = await callAi<ReviewResult>(
    "aiReview",
    "/api/ai/review",
    payload,
  );
  trackAiUse("ai_review_used", payload);
  return result;
}
