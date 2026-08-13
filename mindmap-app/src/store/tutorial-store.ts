"use client";

import { useEffect } from "react";
import { create } from "zustand";
import {
  type MissionId,
  type TutorialState,
  defaultTutorial,
  loadTutorial,
  saveTutorial,
  withMissionDone,
} from "@/lib/tutorial";

/**
 * チュートリアルの進行状態（TUT-01）。
 *
 * ミッションの達成は画面のあちこちから記録するので、
 * React のツリーに縛られないストアに置く。
 * 画面の外からは completeMission("...") で呼べる。
 */

interface Actions {
  /** localStorage から読み込む。ブラウザでしか動かないので描画後に呼ぶ */
  hydrate: () => void;
  /** チュートリアルを開始する（進捗は最初から） */
  start: () => void;
  /** 中断する。以降の操作では達成を記録しない */
  stop: () => void;
  /** 自動起動の判定に使う「もう見た」印を付ける */
  markSeen: () => void;
  /** ミッション達成。進行中でなければ何もしない */
  complete: (id: MissionId) => void;
  /** 完走演出を出し終えたら下ろす */
  clearJustCleared: () => void;
}

interface State extends TutorialState {
  /** localStorage を読み終えたか。読み込み前は何も出さない */
  hydrated: boolean;
  /** いま完走したところか。完走演出のきっかけに使う */
  justCleared: boolean;
}

/** 端末へ保存しつつ次の状態を返す。保存するのは TutorialState の分だけ */
function persist(next: State): State {
  saveTutorial({
    active: next.active,
    done: next.done,
    seen: next.seen,
    clearedAt: next.clearedAt,
  });
  return next;
}

export const useTutorialStore = create<State & Actions>((set, get) => ({
  ...defaultTutorial(),
  hydrated: false,
  justCleared: false,

  hydrate: () => {
    if (get().hydrated) return;
    set({ ...loadTutorial(), hydrated: true, justCleared: false });
  },

  // やり直しでも clearedAt（初回クリアの記録）はそのまま引き継ぐ
  start: () =>
    set((s) =>
      persist({ ...s, active: true, done: [], seen: true, justCleared: false }),
    ),

  stop: () => set((s) => persist({ ...s, active: false, seen: true })),

  markSeen: () => {
    if (get().seen) return;
    set((s) => persist({ ...s, seen: true }));
  },

  complete: (id) => {
    const s = get();
    const next = withMissionDone(s, id);
    // 変化なし（進行中でない・達成済み）なら保存もしない
    if (next === s) return;
    set(persist({ ...s, ...next, justCleared: !next.active }));
  },

  clearJustCleared: () => set({ justCleared: false }),
}));

/**
 * 画面の外（イベントハンドラ等）からミッションを達成させる近道。
 * 進行中でなければ何も起きないので、呼び出し側で条件分岐しなくてよい。
 */
export function completeMission(id: MissionId): void {
  useTutorialStore.getState().complete(id);
}

/**
 * 描画後に localStorage から読み込む。読み終えたら true。
 * 複数の画面から呼んでも読み込みは1回しか走らない。
 *
 * 初回描画では必ず false を返すので、サーバー描画との食い違いも起きない
 * （localStorage はブラウザにしか無い）。
 */
export function useTutorialHydrate(): boolean {
  const hydrate = useTutorialStore((s) => s.hydrate);
  const hydrated = useTutorialStore((s) => s.hydrated);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  return hydrated;
}
