"use client";

import { useEffect } from "react";

/**
 * Service Worker の登録（OFL-02）。何も描かない。
 *
 * 開発中は登録しない。ホットリロードとキャッシュが噛み合わず、
 * 直したはずの画面が古いまま出る事故のもとになるため。
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    // 画面の表示を邪魔しないよう、読み込みが落ち着いてから登録する
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((e) => {
        // 登録に失敗してもアプリは動く（オフラインで開けなくなるだけ）
        console.error("Service Worker の登録に失敗しました", e);
      });
    };
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
