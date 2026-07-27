import { describe, expect, it } from "vitest";
import {
  MAX_CATEGORIES,
  MAX_CATEGORY_NAME_LEN,
  MAX_LABEL_LEN,
  MAX_NODES,
  MAX_SUGGESTIONS,
  MAX_THEME_LEN,
  asBoundedString,
  asNodeList,
  asSuggestions,
  splitReviewResponse,
} from "./ai-validate";

describe("asBoundedString", () => {
  it("文字列以外はnull", () => {
    expect(asBoundedString(123, MAX_THEME_LEN)).toBeNull();
    expect(asBoundedString(undefined, MAX_THEME_LEN)).toBeNull();
    expect(asBoundedString(null, MAX_THEME_LEN)).toBeNull();
  });
  it("空文字・空白のみはnull", () => {
    expect(asBoundedString("", MAX_THEME_LEN)).toBeNull();
    expect(asBoundedString("   ", MAX_THEME_LEN)).toBeNull();
  });
  it("上限超過はnull", () => {
    expect(asBoundedString("a".repeat(MAX_THEME_LEN + 1), MAX_THEME_LEN)).toBeNull();
  });
  it("正常な文字列はtrimして返す", () => {
    expect(asBoundedString("  hello  ", MAX_THEME_LEN)).toBe("hello");
  });
  it("上限ちょうどは通る", () => {
    const s = "a".repeat(MAX_THEME_LEN);
    expect(asBoundedString(s, MAX_THEME_LEN)).toBe(s);
  });
});

describe("asNodeList", () => {
  it("配列以外は空配列", () => {
    expect(asNodeList("not an array")).toEqual([]);
    expect(asNodeList(null)).toEqual([]);
  });
  it("件数上限で切り詰める", () => {
    const input = Array.from({ length: MAX_NODES + 10 }, (_, i) => ({
      label: `n${i}`,
      role: "user",
    }));
    expect(asNodeList(input)).toHaveLength(MAX_NODES);
  });
  it("ラベル長を制限する", () => {
    const input = [{ label: "a".repeat(MAX_LABEL_LEN + 50), role: "user" }];
    const result = asNodeList(input);
    expect(result[0].label.length).toBe(MAX_LABEL_LEN);
  });
  it("不正な要素も安全な形に正規化する", () => {
    const input = [null, {}, { label: 123, role: null }];
    const result = asNodeList(input);
    expect(result).toEqual([
      { label: "", role: "" },
      { label: "", role: "" },
      { label: "123", role: "" },
    ]);
  });
});

describe("asSuggestions", () => {
  it("配列以外は空配列", () => {
    expect(asSuggestions("x")).toEqual([]);
  });
  it("文字列以外・空文字を除外する", () => {
    const input = ["a", "", "  ", 123, null, "b"];
    expect(asSuggestions(input)).toEqual(["a", "b"]);
  });
  it("件数上限で切り詰める", () => {
    const input = Array.from({ length: MAX_SUGGESTIONS + 5 }, (_, i) => `s${i}`);
    expect(asSuggestions(input)).toHaveLength(MAX_SUGGESTIONS);
  });
});

describe("splitReviewResponse", () => {
  it("マーカーが無ければ本文全体をreviewとして返す", () => {
    const result = splitReviewResponse("これはレビュー本文です。");
    expect(result.review).toBe("これはレビュー本文です。");
    expect(result.usedNodeLabels).toEqual([]);
    expect(result.categories).toEqual([]);
  });

  it("USED_NODESを本文から分離してパースする", () => {
    const text = `本文だよ\nUSED_NODES: ["ノードA", "ノードB"]`;
    const result = splitReviewResponse(text);
    expect(result.review).toBe("本文だよ");
    expect(result.usedNodeLabels).toEqual(["ノードA", "ノードB"]);
  });

  it("CATEGORIESを本文から分離してパースする", () => {
    const text = `本文だよ\nCATEGORIES: [{"name":"分類1","nodes":["A","B"]}]`;
    const result = splitReviewResponse(text);
    expect(result.review).toBe("本文だよ");
    expect(result.categories).toEqual([{ name: "分類1", nodes: ["A", "B"] }]);
  });

  it("USED_NODESとCATEGORIESの両方を、出力順に関わらず正しく分離する", () => {
    const text = `本文\nCATEGORIES: [{"name":"c1","nodes":["x"]}]\nUSED_NODES: ["A"]`;
    const result = splitReviewResponse(text);
    expect(result.review).toBe("本文");
    expect(result.usedNodeLabels).toEqual(["A"]);
    expect(result.categories).toEqual([{ name: "c1", nodes: ["x"] }]);
  });

  it("ラベルに角括弧が含まれても壊れない", () => {
    const text = `本文\nUSED_NODES: ["A[1]", "B"]`;
    const result = splitReviewResponse(text);
    expect(result.usedNodeLabels).toEqual(["A[1]", "B"]);
  });

  it("壊れたJSONは空配列にフォールバックする", () => {
    const text = `本文\nUSED_NODES: [broken json`;
    const result = splitReviewResponse(text);
    expect(result.usedNodeLabels).toEqual([]);
  });

  it("USED_NODESは重複を除去し件数上限50で切り詰める", () => {
    const arr = JSON.stringify(
      Array.from({ length: 60 }, (_, i) => `n${i % 10}`),
    );
    const text = `本文\nUSED_NODES: ${arr}`;
    const result = splitReviewResponse(text);
    expect(result.usedNodeLabels.length).toBeLessThanOrEqual(50);
    expect(new Set(result.usedNodeLabels).size).toBe(result.usedNodeLabels.length);
  });

  it("CATEGORIESはカテゴリ数上限で切り詰める", () => {
    const cats = Array.from({ length: MAX_CATEGORIES + 5 }, (_, i) => ({
      name: `cat${i}`,
      nodes: ["x"],
    }));
    const text = `本文\nCATEGORIES: ${JSON.stringify(cats)}`;
    const result = splitReviewResponse(text);
    expect(result.categories.length).toBe(MAX_CATEGORIES);
  });

  it("CATEGORIESのnameは長さ上限で切り詰める", () => {
    const cats = [{ name: "a".repeat(MAX_CATEGORY_NAME_LEN + 20), nodes: ["x"] }];
    const text = `本文\nCATEGORIES: ${JSON.stringify(cats)}`;
    const result = splitReviewResponse(text);
    expect(result.categories[0].name.length).toBe(MAX_CATEGORY_NAME_LEN);
  });

  it("nodesが空のカテゴリは除外する", () => {
    const cats = [{ name: "empty", nodes: [] }, { name: "ok", nodes: ["a"] }];
    const text = `本文\nCATEGORIES: ${JSON.stringify(cats)}`;
    const result = splitReviewResponse(text);
    expect(result.categories).toEqual([{ name: "ok", nodes: ["a"] }]);
  });

  it("同名カテゴリの重複は最初の1つだけ残す", () => {
    const cats = [
      { name: "dup", nodes: ["a"] },
      { name: "dup", nodes: ["b"] },
    ];
    const text = `本文\nCATEGORIES: ${JSON.stringify(cats)}`;
    const result = splitReviewResponse(text);
    expect(result.categories).toEqual([{ name: "dup", nodes: ["a"] }]);
  });
});
