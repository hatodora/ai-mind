/**
 * テーマの選択と解決（THM-02）。
 *
 * 利用者が選べるのは3つ。
 *  - system: OS の設定に従う（既定）
 *  - light / dark: 明示的に選ぶ。OS の設定より優先する
 *
 * 実際に画面へ適用するのは light / dark のどちらかだけで、
 * その値を <html data-theme="..."> に書き込む。
 * CSS 側はこの属性だけを見ればよく、メディアクエリを持たなくて済む。
 *
 * このファイルは副作用のない判定と、DOM/localStorage への薄い出入口だけを持つ。
 * 状態の保持は theme-store が受け持つ。
 */

/** 利用者が選べる値 */
export type ThemeChoice = "system" | "light" | "dark";
/** 実際に画面へ当てる値 */
export type ResolvedTheme = "light" | "dark";

/** 端末に選択を残す鍵。ログイン不要の設定なのでプロフィールには入れない */
export const THEME_KEY = "mindmap-app:theme";

/** 既定。初回訪問者は OS の設定どおりの見た目になる */
export const DEFAULT_CHOICE: ThemeChoice = "system";

export const THEME_CHOICES: readonly ThemeChoice[] = [
  "system",
  "light",
  "dark",
] as const;

/** 画面に出す名前 */
export const THEME_LABEL: Record<ThemeChoice, string> = {
  system: "端末に合わせる",
  light: "ライト",
  dark: "ダーク",
};

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return (
    value === "system" ||
    value === "light" ||
    value === "dark"
  );
}

/**
 * 選択と OS の設定から、実際に当てるテーマを決める。
 * 純粋な関数なので、ここだけを単体テストすれば判定の正しさは保証できる。
 */
export function resolveTheme(
  choice: ThemeChoice,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (choice === "light") return "light";
  if (choice === "dark") return "dark";
  return systemPrefersDark ? "dark" : "light";
}

/** OS がダークを求めているか。サーバ側では判断できないので false 扱い */
export function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** 端末に残した選択を読む。壊れた値や未設定なら既定へ倒す */
export function loadThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") return DEFAULT_CHOICE;
  try {
    const raw = window.localStorage.getItem(THEME_KEY);
    return isThemeChoice(raw) ? raw : DEFAULT_CHOICE;
  } catch {
    // プライベートモード等で localStorage が使えないことがある
    return DEFAULT_CHOICE;
  }
}

export function saveThemeChoice(choice: ThemeChoice): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    // 保存できなくても、その場の表示は効いているので黙って続ける
  }
}

/** 解決済みのテーマを <html> に反映する */
export function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolved;
}

/**
 * 最初の描画より前に data-theme を確定させる同期スクリプト。
 * これが無いと、既定のライトで一瞬描かれてからダークへ切り替わる。
 *
 * 文字列で持っているのは <head> にそのまま流し込むため。
 * 鍵の名前がずれないよう THEME_KEY から組み立てている。
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{
var c=localStorage.getItem(${JSON.stringify(THEME_KEY)});
if(c!=="light"&&c!=="dark")c="system";
var d=c==="dark"||(c==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.dataset.theme=d?"dark":"light";
}catch(e){document.documentElement.dataset.theme="light";}})();`;
