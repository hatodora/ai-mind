/**
 * AI API Routes（匿名・フォールバック経路）の入力検証。
 * Cloud Functions 側（functions/src/index.ts）と同じ上限に揃える。
 * この経路は認証なしで叩けるため、不正型・巨大ペイロードを
 * ここで確実に弾いて Groq への無駄な呼び出しを防ぐ。
 */

export const MAX_THEME_LEN = 200;
export const MAX_LABEL_LEN = 300;
export const MAX_NODES = 500;
export const MAX_SUGGESTIONS = 3;

/** 空でない・上限以下の文字列のみ通す。それ以外は null */
export function asBoundedString(v: unknown, maxLen: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (s.length === 0 || s.length > maxLen) return null;
  return s;
}

/** ノード配列を安全な形（件数・ラベル長を制限）に正規化する */
export function asNodeList(v: unknown): { label: string; role: string }[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, MAX_NODES).map((n) => {
    const o = (n ?? {}) as { label?: unknown; role?: unknown };
    return {
      label: String(o.label ?? "").slice(0, MAX_LABEL_LEN),
      role: String(o.role ?? ""),
    };
  });
}

/** AI応答の提案配列を検証する。文字列のみ・空要素除去・件数上限 */
export function asSuggestions(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .slice(0, MAX_SUGGESTIONS);
}

/**
 * レビュー応答から根拠ノード行（NF-03）を分離する。
 * 末尾の `USED_NODES: ["ラベル", ...]` をパースして本文から取り除く。
 * 行が無い・壊れている場合はラベル無しで本文をそのまま返す（機能劣化に留める）。
 * Cloud Functions 側にも同じロジックの複製がある（別パッケージのため）。
 */
export function splitReviewResponse(text: string): {
  review: string;
  usedNodeLabels: string[];
} {
  const idx = text.lastIndexOf("USED_NODES");
  if (idx === -1) return { review: text.trim(), usedNodeLabels: [] };
  const tail = text.slice(idx);
  const arrayMatch = tail.match(/\[[\s\S]*?\]/);
  const review = text.slice(0, idx).replace(/[`\s]+$/, "").trim();
  if (!arrayMatch) return { review, usedNodeLabels: [] };
  try {
    const parsed: unknown = JSON.parse(arrayMatch[0]);
    if (!Array.isArray(parsed)) return { review, usedNodeLabels: [] };
    const labels = Array.from(
      new Set(
        parsed
          .filter(
            (s): s is string => typeof s === "string" && s.trim().length > 0,
          )
          .map((s) => s.trim().slice(0, MAX_LABEL_LEN)),
      ),
    ).slice(0, 50);
    return { review, usedNodeLabels: labels };
  } catch {
    return { review, usedNodeLabels: [] };
  }
}
