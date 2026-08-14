"use client";

import { useThemeSetup } from "@/store/theme-store";

/**
 * テーマの読み込みと OS 追従を仕掛けるだけの部品（THM-02）。
 * 何も描かない。レイアウトに1つ置く。
 *
 * 「端末に合わせる」を選んでいる人は、アプリを開いたまま OS を
 * ダークへ切り替えても、そのまま追従する。
 */
export function ThemeSync() {
  useThemeSetup();
  return null;
}
