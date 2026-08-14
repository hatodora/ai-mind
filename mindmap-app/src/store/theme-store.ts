"use client";

import { useEffect } from "react";
import { create } from "zustand";
import {
  DEFAULT_CHOICE,
  type ResolvedTheme,
  type ThemeChoice,
  applyTheme,
  loadThemeChoice,
  resolveTheme,
  saveThemeChoice,
  systemPrefersDark,
} from "@/lib/theme";

/**
 * テーマの保持（THM-02）。
 *
 * 画面へ当てる作業は <head> の同期スクリプトが済ませているので、
 * ここは「利用者が切り替えたとき」と「OS の設定が変わったとき」に
 * 属性を書き直す役だけを担う。
 */

interface State {
  /** 利用者の選択 */
  choice: ThemeChoice;
  /** 実際に当たっているテーマ */
  resolved: ResolvedTheme;
  /** localStorage を読み終えたか。読む前に切替UIを描くとちらつく */
  hydrated: boolean;
  hydrate: () => void;
  setChoice: (choice: ThemeChoice) => void;
  /** OS の設定が変わったときに呼ぶ。system を選んでいる人だけ見た目が動く */
  syncSystem: () => void;
}

export const useThemeStore = create<State>((set, get) => ({
  choice: DEFAULT_CHOICE,
  resolved: "light",
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    const choice = loadThemeChoice();
    const resolved = resolveTheme(choice, systemPrefersDark());
    // 同期スクリプトが同じ値を書いているはずだが、
    // 走らなかった場合に備えてここでも当てておく
    applyTheme(resolved);
    set({ choice, resolved, hydrated: true });
  },

  setChoice: (choice) => {
    const resolved = resolveTheme(choice, systemPrefersDark());
    saveThemeChoice(choice);
    applyTheme(resolved);
    set({ choice, resolved });
  },

  syncSystem: () => {
    const { choice } = get();
    if (choice !== "system") return;
    const resolved = resolveTheme(choice, systemPrefersDark());
    applyTheme(resolved);
    set({ resolved });
  },
}));

/**
 * 読み込みと OS 追従をまとめて仕掛ける。
 * アプリ全体で1回だけ動けばよいので ThemeSync から呼ぶ。
 */
export function useThemeSetup(): void {
  const hydrate = useThemeStore((s) => s.hydrate);
  const syncSystem = useThemeStore((s) => s.syncSystem);

  useEffect(() => {
    hydrate();
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", syncSystem);
    return () => mq.removeEventListener("change", syncSystem);
  }, [hydrate, syncSystem]);
}
