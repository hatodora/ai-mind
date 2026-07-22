"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMindMapStore } from "@/store/mindmap-store";
import { getRepo } from "@/lib/repo";
import { MindMapCanvas } from "@/components/mindmap/MindMapCanvas";
import { ControlPanel } from "@/components/mindmap/ControlPanel";
import { ShareModal } from "@/components/mindmap/ShareModal";

export default function MapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, initializing } = useAuth();
  const load = useMindMapStore((s) => s.load);
  const map = useMindMapStore((s) => s.map);
  const loading = useMindMapStore((s) => s.loading);
  const [panelOpen, setPanelOpen] = useState(true);
  const [started, setStarted] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // 認証初期化が終わってから読み込む
  // （ログイン済みなら Firestore リポジトリへの切替を待つ必要がある）
  useEffect(() => {
    if (initializing) return;
    // setState を effect 内で直接呼ばない（次のティックで読み込み開始）
    const t = setTimeout(() => {
      setStarted(true);
      void load(id);
    }, 0);
    return () => clearTimeout(t);
  }, [id, load, initializing]);

  // リアルタイム共同編集（NF-01a）: 相手の変更を購読して取り込む。
  // ローカル（匿名）リポジトリは watch 未対応なので何もしない
  useEffect(() => {
    if (initializing || !started) return;
    const unsub = getRepo().watch?.(id, (remote) => {
      useMindMapStore.getState().applyRemote(remote);
    });
    return () => unsub?.();
  }, [id, initializing, started]);

  // 共有ボタンは所有者のみ（共有設定の変更は所有者だけ、ルールでも強制）
  const isOwner = !!user && !!map?.ownerId && map.ownerId === user.uid;
  const isSharedToMe =
    !!user && !!map?.ownerId && map.ownerId !== user.uid;

  if (initializing || !started || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page">
        <div className="text-sm text-muted">読み込み中…</div>
      </main>
    );
  }

  if (!map) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page">
        <div className="text-center">
          <div className="mb-4 text-sm text-muted">マップが見つかりません</div>
          <Link
            href="/"
            className="text-sm text-accent-soft underline underline-offset-4"
          >
            ホームへ戻る
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-page sm:flex-row">
      {/* モバイルヘッダー */}
      <header className="flex items-center justify-between gap-3 bg-page px-4 py-3 sm:hidden">
        <Link
          href="/"
          className="icon-circle !h-9 !w-9 shrink-0"
          aria-label="ホームへ戻る"
        >
          <span className="font-display leading-none">←</span>
        </Link>
        <div className="min-w-0 truncate font-display text-[15px] font-bold">
          {map.theme}
        </div>
        {isOwner && (
          <button
            onClick={() => setShareOpen(true)}
            className="shrink-0 rounded-full border border-line bg-card px-3.5 py-2 text-[11px] font-bold tracking-wider text-accent-soft"
          >
            共有
          </button>
        )}
        <button
          onClick={() => setPanelOpen((v) => !v)}
          className="shrink-0 rounded-full border border-line bg-card px-4 py-2 text-[11px] font-bold tracking-wider text-ink"
        >
          {panelOpen ? "マップ" : "操作"}
        </button>
      </header>

      {/* パネル: モバイルではボトムシート、デスクトップではサイドバー。
          状態が分裂しないよう ControlPanel は1インスタンスのみマウントする */}
      <div
        className={`order-3 rounded-t-[24px] bg-page shadow-[0_-8px_30px_-8px_rgba(0,0,0,0.6)] max-sm:h-[60vh] sm:order-1 sm:block sm:h-screen sm:w-[310px] sm:shrink-0 sm:rounded-none sm:border-r sm:border-line sm:shadow-none ${
          panelOpen ? "block" : "hidden"
        }`}
      >
        {/* モバイル: シートのつまみ */}
        <div className="flex justify-center pt-2.5 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-line" />
        </div>
        <div className="hidden h-14 items-center justify-between px-5 sm:flex">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-full py-1.5 pl-2 pr-4 text-xs tracking-wide text-muted transition-colors hover:bg-card hover:text-ink"
          >
            <span className="font-display">←</span> ホーム
          </Link>
          {isOwner && (
            <button
              onClick={() => setShareOpen(true)}
              className="rounded-full border border-line bg-card px-3.5 py-1.5 text-[11px] font-bold tracking-wider text-accent-soft transition-colors hover:border-accent/50"
            >
              共有
              {Object.keys(map.sharedWith ?? {}).length > 0 &&
                ` · ${Object.keys(map.sharedWith ?? {}).length}人`}
            </button>
          )}
          {isSharedToMe && (
            <span className="rounded-full bg-tint-accent-strong px-3 py-1.5 text-[10px] font-bold tracking-wider text-accent-soft">
              共同編集
            </span>
          )}
        </div>
        <div className="h-[calc(100%-1.25rem)] sm:h-[calc(100vh-3.5rem)]">
          <ControlPanel />
        </div>
      </div>

      {/* キャンバス（モバイルでも常時表示し、パネルはボトムシートとして重ねる） */}
      <div className="order-2 min-h-0 flex-1">
        <MindMapCanvas />
      </div>

      {/* 共同編集の共有モーダル（NF-01a） */}
      {shareOpen && <ShareModal onClose={() => setShareOpen(false)} />}
    </main>
  );
}
