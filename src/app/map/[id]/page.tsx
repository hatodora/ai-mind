"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useMindMapStore } from "@/store/mindmap-store";
import { MindMapCanvas } from "@/components/mindmap/MindMapCanvas";
import { ControlPanel } from "@/components/mindmap/ControlPanel";

export default function MapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const load = useMindMapStore((s) => s.load);
  const map = useMindMapStore((s) => s.map);
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    load(id);
  }, [id, load]);

  if (!map) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-4 text-slate-500">マップが見つかりません</div>
          <Link href="/" className="text-sm text-sky-600 underline">
            ホームへ戻る
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-slate-100 sm:flex-row">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 sm:hidden">
        <Link href="/" className="text-sm text-slate-600">
          ←
        </Link>
        <div className="truncate text-sm font-bold text-slate-800">
          {map.theme}
        </div>
        <button
          onClick={() => setPanelOpen((v) => !v)}
          className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
        >
          {panelOpen ? "マップ" : "操作"}
        </button>
      </header>

      <div className="hidden h-screen w-80 shrink-0 border-r border-slate-200 sm:block">
        <div className="flex h-12 items-center border-b border-slate-200 px-4">
          <Link
            href="/"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            ← ホーム
          </Link>
        </div>
        <div className="h-[calc(100vh-3rem)]">
          <ControlPanel />
        </div>
      </div>

      <div
        className={`flex-1 ${panelOpen ? "hidden sm:block" : "block"}`}
        style={{ height: "calc(100vh - 49px)" }}
      >
        <MindMapCanvas />
      </div>

      <div
        className={`h-[60vh] border-t border-slate-200 sm:hidden ${
          panelOpen ? "block" : "hidden"
        }`}
      >
        <ControlPanel />
      </div>
    </main>
  );
}
