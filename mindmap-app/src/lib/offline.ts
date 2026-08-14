"use client";

import { useSyncExternalStore } from "react";

/**
 * オフライン状態の把握（OFL-03）。
 *
 * データそのものは Firestore の persistentLocalCache に任せてある（OFL-01）。
 * ここが受け持つのは «いま繋がっているか» を画面へ伝えることだけ。
 */

/** navigator.onLine の購読。online / offline の両方を拾う */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

/**
 * サーバー描画では判断できない。
 * «繋がっている» 側に倒しておくと、一瞬オフラインの帯が出る事故が起きない。
 */
function getServerSnapshot(): boolean {
  return true;
}

/**
 * いまオンラインか。
 *
 * useSyncExternalStore を使うのは、これがまさに «外側の状態の購読» だから。
 * useEffect と useState で書くと、初回描画とイベントの間に食い違いが出る。
 *
 * なお navigator.onLine は «ネットワークに繋がっているか» までしか見ない。
 * 繋がっているのに通信できない（機内Wi-Fi・captive portal 等）は検知できないので、
 * これはあくまで目安として扱い、守りの判断には使わない。
 */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * オフラインで押せない操作に添える理由。
 *
 * 単に無効にするだけだと «壊れている» ように見えるので、
 * なぜ押せないのかを必ず一緒に出す。
 */
export function offlineReason(online: boolean): string | null {
  return online
    ? null
    : "オフラインのため AI に相談できません。ノードの追加と編集は続けられます";
}

/**
 * オフラインでもできることの案内。
 *
 * 「編集が消えるのでは」という不安がいちばんの困りごとなので、
 * 保存されていること・あとで同期されることを先に言う。
 */
export const OFFLINE_MESSAGE =
  "オフラインです。編集はこの端末に保存され、つながると自動で同期されます";

/** 復帰直後、保留していた書き込みを送っているあいだの案内 */
export const SYNCING_MESSAGE = "同期しています…";
