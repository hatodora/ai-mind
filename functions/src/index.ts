/**
 * 思索 / Mindmap — Cloud Functions (SEC-02 / SEC-04 / SEC-05)
 *
 * AI API（Groq）呼び出しをサーバーサイドに集約する。
 *  - APIキーは Secret Manager に保存（クライアントに一切露出しない）
 *  - onCall: Firebase IDトークンを自動検証 ＋ メール確認済みを必須化
 *  - レートリミット: ユーザーごとに 1時間あたりの呼び出し回数を制限
 *  - キャッシュ: 同一リクエストは Firestore キャッシュから返し、
 *    Groq への実呼び出しをできる限り節約する
 */
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import Groq from "groq-sdk";

initializeApp();
const db = getFirestore();

const GROQ_API_KEY = defineSecret("GROQ_API_KEY");
const MODEL_NAME = "llama-3.3-70b-versatile";
const REGION = "asia-northeast1";

/** レートリミット: 1ユーザーあたり1時間の最大AI呼び出し回数 */
const HOURLY_LIMIT = 30;

/** キャッシュTTL（ミリ秒） */
const TTL = {
  explain: 30 * 24 * 60 * 60 * 1000, // 用語説明は安定しているので30日
  suggest: 24 * 60 * 60 * 1000, // 提案は文脈依存なので1日
  review: 24 * 60 * 60 * 1000,
} as const;

// ---------- 共通ガード ----------

function requireVerifiedUser(request: CallableRequest): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "ログインが必要です");
  }
  if (request.auth.token.email_verified !== true) {
    throw new HttpsError(
      "permission-denied",
      "メールアドレスの確認が完了していません",
    );
  }
  return request.auth.uid;
}

/** ユーザーごとの時間窓レートリミット（SEC-04）。超過時はエラー */
async function enforceRateLimit(uid: string): Promise<void> {
  const ref = db.doc(`users/${uid}/private/usage`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const hourStart = snap.exists ? (snap.data()!.hourStart as number) : 0;
    const count = snap.exists ? (snap.data()!.count as number) : 0;
    if (now - hourStart < 60 * 60 * 1000) {
      if (count >= HOURLY_LIMIT) {
        throw new HttpsError(
          "resource-exhausted",
          "AIの利用回数が上限に達しました。1時間ほど待ってからお試しください",
        );
      }
      tx.set(ref, { hourStart, count: count + 1 }, { merge: true });
    } else {
      tx.set(ref, { hourStart: now, count: 1 });
    }
  });
}

// ---------- キャッシュ（API呼び出しの節約） ----------

function cacheKey(kind: string, payload: unknown): string {
  const hash = createHash("sha256")
    .update(kind + JSON.stringify(payload))
    .digest("hex");
  return `${kind}_${hash}`;
}

async function withCache(
  kind: keyof typeof TTL,
  payload: unknown,
  compute: () => Promise<string>,
): Promise<{ text: string; cached: boolean }> {
  const key = cacheKey(kind, payload);
  const ref = db.doc(`aiCache/${key}`);
  const snap = await ref.get();
  if (snap.exists) {
    const data = snap.data()!;
    if (Date.now() < (data.expiresAt as number)) {
      return { text: data.value as string, cached: true };
    }
  }
  const text = await compute();
  await ref.set({
    value: text,
    kind,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Date.now() + TTL[kind],
  });
  return { text, cached: false };
}

// ---------- Groq 呼び出し ----------

async function generate(prompt: string): Promise<string> {
  const client = new Groq({ apiKey: GROQ_API_KEY.value() });
  const completion = await client.chat.completions.create({
    model: MODEL_NAME,
    messages: [{ role: "user", content: prompt }],
  });
  return (completion.choices[0]?.message?.content ?? "").trim();
}

// ---------- 入力検証ヘルパー ----------

function asString(v: unknown, name: string, maxLen: number): string {
  if (typeof v !== "string" || v.length === 0 || v.length > maxLen) {
    throw new HttpsError("invalid-argument", `${name} が不正です`);
  }
  return v;
}

// ---------- aiSuggest ----------

const SUGGEST_SYSTEM = `あなたはユーザーの思考をサポートするマインドマップの相棒です。

ルール:
- ユーザーが主役。あなたはサポート役に徹する
- 提案は必ず日本語、日常語を使う（カタカナ語・専門用語は避ける）
- 1ターンで提案するノードは2〜3個
- 提案は短いフレーズ（10〜20文字程度）
- ユーザーがすでに書いたアイデアと重複しない
- 「意識高い系コンサル」のような抽象論や横文字を使わない
- 中学生でも理解できる具体的な言葉を選ぶ

出力は必ず以下のJSON配列のみ。前後に説明文を書かないこと:
["提案1", "提案2", "提案3"]`;

export const aiSuggest = onCall(
  { region: REGION, secrets: [GROQ_API_KEY], enforceAppCheck: false },
  async (request) => {
    const uid = requireVerifiedUser(request);
    const theme = asString(request.data?.theme, "theme", 200);
    const selectedNodeLabel = asString(
      request.data?.selectedNodeLabel,
      "selectedNodeLabel",
      300,
    );
    const contextNodes = Array.isArray(request.data?.contextNodes)
      ? (request.data.contextNodes as { label?: unknown; role?: unknown }[])
          .slice(0, 500)
          .map((n) => ({
            label: String(n.label ?? "").slice(0, 300),
            role: String(n.role ?? ""),
          }))
      : [];

    await enforceRateLimit(uid);

    const userNodes = contextNodes
      .filter((n) => n.role !== "root")
      .map((n) => `- ${n.label}（${n.role === "user" ? "ユーザー" : "AI"}）`)
      .sort()
      .join("\n");

    const prompt = `${SUGGEST_SYSTEM}

中心テーマ: ${theme}
今ユーザーが選択しているノード: ${selectedNodeLabel}

これまでのマップ全体:
${userNodes || "（まだ何もない）"}

選択ノード「${selectedNodeLabel}」から派生する次のアイデアを2〜3個、JSON配列で返してください。`;

    const { text } = await withCache(
      "suggest",
      { theme, selectedNodeLabel, userNodes },
      () => generate(prompt),
    );

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new HttpsError("internal", "AI応答の解析に失敗しました");
    }
    let suggestions: unknown;
    try {
      suggestions = JSON.parse(jsonMatch[0]);
    } catch {
      throw new HttpsError("internal", "AI応答の解析に失敗しました");
    }
    if (
      !Array.isArray(suggestions) ||
      !suggestions.every((s) => typeof s === "string")
    ) {
      throw new HttpsError("internal", "AI応答の形式が不正です");
    }
    return { suggestions };
  },
);

// ---------- aiExplain ----------

export const aiExplain = onCall(
  { region: REGION, secrets: [GROQ_API_KEY], enforceAppCheck: false },
  async (request) => {
    const uid = requireVerifiedUser(request);
    const theme = asString(request.data?.theme, "theme", 200);
    const label = asString(request.data?.label, "label", 300);

    await enforceRateLimit(uid);

    const prompt = `マインドマップで「${theme}」というテーマについて考えています。
そのなかの「${label}」というキーワードについて、小学校高学年でもわかるように2〜3文で説明してください。
難しい言葉は使わず、身近な例えを入れてください。出力は説明文のみ。前置きは不要です。`;

    const { text } = await withCache("explain", { theme, label }, () =>
      generate(prompt),
    );
    return { explanation: text };
  },
);

// ---------- aiReview ----------

export const aiReview = onCall(
  { region: REGION, secrets: [GROQ_API_KEY], enforceAppCheck: false },
  async (request) => {
    const uid = requireVerifiedUser(request);
    const theme = asString(request.data?.theme, "theme", 200);
    const nodes = Array.isArray(request.data?.nodes)
      ? (request.data.nodes as { label?: unknown; role?: unknown }[])
          .slice(0, 500)
          .map((n) => ({
            label: String(n.label ?? "").slice(0, 300),
            role: String(n.role ?? ""),
          }))
      : [];
    if (nodes.length === 0) {
      throw new HttpsError("invalid-argument", "nodes が空です");
    }

    await enforceRateLimit(uid);

    const nodeList = nodes
      .filter((n) => n.role !== "root")
      .map((n) => `- ${n.label}`)
      .join("\n");

    const prompt = `あなたはユーザーの問題解決を支援するパートナーです。
以下はユーザーが「${theme}」について作ったマインドマップです。

${nodeList}

このマップを見て、以下の3つを日常語で答えてください:

1. 良いところ（具体的に1〜2点）
2. もう少し深掘りすると面白そうなところ（1〜2点）
3. 次のアクション（具体的に2〜3個、明日からできること）

意識高い系の横文字や抽象論は禁止。中学生でもわかる具体的な言葉で、優しいトーンで答えてください。`;

    const { text } = await withCache("review", { theme, nodeList }, () =>
      generate(prompt),
    );
    return { review: text };
  },
);
