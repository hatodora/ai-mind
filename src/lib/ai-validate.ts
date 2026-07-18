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

/** トピック分類（NF-05）のカテゴリ数上限 */
export const MAX_CATEGORIES = 8;
/** トピック分類（NF-05）のカテゴリ名の最大文字数 */
export const MAX_CATEGORY_NAME_LEN = 40;

/** マップ全体を分類したトピック（NF-05） */
export interface ReviewCategory {
  name: string;
  nodes: string[];
}

/**
 * s の最初の '[' から対応する ']' までを取り出す。
 * ラベルに [ ] が含まれても壊れないよう、文字列リテラルを考慮して走査する。
 */
function extractJsonArray(s: string): string | null {
  const start = s.indexOf("[");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/** USED_NODES 配列（NF-03）をパースして検証する。壊れていれば空配列 */
function parseUsedNodes(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(
        parsed
          .filter(
            (s): s is string => typeof s === "string" && s.trim().length > 0,
          )
          .map((s) => s.trim().slice(0, MAX_LABEL_LEN)),
      ),
    ).slice(0, 50);
  } catch {
    return [];
  }
}

/** CATEGORIES 配列（NF-05）をパースして検証する。壊れていれば空配列 */
function parseCategories(raw: string | null): ReviewCategory[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: ReviewCategory[] = [];
    for (const item of parsed) {
      if (out.length >= MAX_CATEGORIES) break;
      const o = (item ?? {}) as { name?: unknown; nodes?: unknown };
      if (typeof o.name !== "string" || !Array.isArray(o.nodes)) continue;
      const name = o.name.trim().slice(0, MAX_CATEGORY_NAME_LEN);
      if (name.length === 0 || seen.has(name)) continue;
      const nodes = Array.from(
        new Set(
          o.nodes
            .filter(
              (s): s is string => typeof s === "string" && s.trim().length > 0,
            )
            .map((s) => s.trim().slice(0, MAX_LABEL_LEN)),
        ),
      ).slice(0, 200);
      if (nodes.length === 0) continue;
      seen.add(name);
      out.push({ name, nodes });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * レビュー応答から根拠ノード行（NF-03）とトピック分類行（NF-05）を分離する。
 * 末尾の `USED_NODES: [...]` と `CATEGORIES: [...]` をパースして本文から取り除く。
 * 行が無い・壊れている場合はその項目を空で返す（機能劣化に留める）。
 * Cloud Functions 側にも同じロジックの複製がある（別パッケージのため）。
 */
export function splitReviewResponse(text: string): {
  review: string;
  usedNodeLabels: string[];
  categories: ReviewCategory[];
} {
  const unIdx = text.lastIndexOf("USED_NODES");
  const catIdx = text.lastIndexOf("CATEGORIES");
  // 本文は、最初に現れるマーカーの手前まで（出力順が入れ替わっても壊れない）
  const cuts = [unIdx, catIdx].filter((i) => i !== -1);
  const cut = cuts.length === 0 ? text.length : Math.min(...cuts);
  const review = text.slice(0, cut).replace(/[`\s]+$/, "").trim();
  const usedNodeLabels =
    unIdx === -1 ? [] : parseUsedNodes(extractJsonArray(text.slice(unIdx)));
  const categories =
    catIdx === -1 ? [] : parseCategories(extractJsonArray(text.slice(catIdx)));
  return { review, usedNodeLabels, categories };
}
