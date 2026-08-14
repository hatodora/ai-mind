import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHOICE,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_CHOICES,
  THEME_KEY,
  THEME_LABEL,
  isThemeChoice,
  resolveTheme,
} from "./theme";

describe("resolveTheme", () => {
  it("明示的に選んだテーマは OS の設定より優先する", () => {
    // 明示選択の意味は「OS がどうであれこれにする」なので、
    // どちらの OS 設定でも選んだ側が残らないといけない
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("light", false)).toBe("light");
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("system は OS の設定に従う", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("解決結果は必ず light か dark のどちらかになる", () => {
    // CSS は data-theme のこの2値しか見ていない。
    // system がそのまま漏れると、どの配色も当たらなくなる
    for (const choice of THEME_CHOICES) {
      for (const prefersDark of [true, false]) {
        expect(["light", "dark"]).toContain(
          resolveTheme(choice, prefersDark),
        );
      }
    }
  });
});

describe("isThemeChoice", () => {
  it("選べる3つだけを通す", () => {
    expect(isThemeChoice("system")).toBe(true);
    expect(isThemeChoice("light")).toBe(true);
    expect(isThemeChoice("dark")).toBe(true);
  });

  it("壊れた値は弾く", () => {
    // localStorage には古い値や手で書かれた値が入りうる
    for (const bad of ["", "Dark", "auto", null, undefined, 1, {}]) {
      expect(isThemeChoice(bad)).toBe(false);
    }
  });
});

describe("設定の見た目", () => {
  it("選べる値すべてに表示名がある", () => {
    for (const choice of THEME_CHOICES) {
      expect(THEME_LABEL[choice]).toBeTruthy();
    }
  });

  it("既定は端末に合わせる", () => {
    expect(DEFAULT_CHOICE).toBe("system");
  });
});

describe("ちらつき防止スクリプト", () => {
  it("保存に使う鍵と同じ鍵を読んでいる", () => {
    // 鍵がずれると、選択が «保存はされるが復元されない» という
    // 気づきにくい壊れ方をする
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(JSON.stringify(THEME_KEY));
  });

  it("data-theme を書き込む", () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("dataset.theme");
  });

  it("localStorage が使えなくても既定を当てる", () => {
    // プライベートモードでは getItem が例外を投げることがある。
    // 捕まえ損ねると <head> で止まり、真っ白な画面になる
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("catch");
  });
});
