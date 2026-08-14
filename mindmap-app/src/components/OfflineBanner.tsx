"use client";

import { useEffect, useState } from "react";
import { waitForPendingWrites } from "firebase/firestore";
import {
  OFFLINE_MESSAGE,
  SYNCING_MESSAGE,
  useOnline,
} from "@/lib/offline";
import { firebaseDb, isFirebaseConfigured } from "@/lib/firebase";

/**
 * オフラインの帯（OFL-03）。画面のいちばん上に出す。
 *
 * いちばんの困りごとは「編集が消えるのでは」という不安なので、
 * 保存されていること・あとで同期されることを先に言う。
 *
 * 実際の保存と再送は Firestore の persistentLocalCache が受け持つ（OFL-01）。
 * ここは «いま何が起きているか» を伝えるだけ。
 */
export function OfflineBanner() {
  const online = useOnline();
  const [syncing, setSyncing] = useState(false);

  // つながった «瞬間» だけ、保留していた書き込みが片付くのを待つ。
  // online の変化を見るのではなくイベントを直接拾っているのは、
  // 初回描画のときに «同期中» が一瞬出るのを避けるため
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const onOnline = () => {
      setSyncing(true);
      // 失敗しても帯を出しっぱなしにはしない。
      // 送れていなければ、次にオフラインへ落ちたときにまた案内される
      void waitForPendingWrites(firebaseDb())
        .catch(() => undefined)
        .finally(() => setSyncing(false));
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  if (online && !syncing) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`shrink-0 px-4 py-2 text-center text-[12px] ${
        online
          ? "bg-tint-accent text-accent-soft"
          : "bg-tint-warm text-warm"
      }`}
    >
      {online ? SYNCING_MESSAGE : OFFLINE_MESSAGE}
    </div>
  );
}
