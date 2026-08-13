"use client";

import { create } from "zustand";
import type { MascotPose } from "@/components/character/Mascot";

/**
 * キャラクターに「いまの画面の状況」を伝えるための小さなストア（CHR-02）。
 *
 * エディタでは、AIの応答待ちなら本を読み、入力中はPCに向かう…というふうに
 * 状況に合わせてポーズを変える。ControlPanel と MascotDock は
 * 離れた場所にあるので、props ではなくここを経由して渡す。
 * null のあいだは待機モーション（ポーズの巡回）にまかせる。
 */
interface MascotState {
  contextPose: MascotPose | null;
  setContextPose: (pose: MascotPose | null) => void;
}

export const useMascotStore = create<MascotState>((set) => ({
  contextPose: null,
  setContextPose: (pose) => set({ contextPose: pose }),
}));
