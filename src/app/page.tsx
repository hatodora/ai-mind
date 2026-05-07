"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { storage } from "@/lib/storage";
import type { MindMap } from "@/types";

export default function HomePage() {
  const [maps, setMaps] = useState<MindMap[]>([]);

  useEffect(() => {
    setMaps(storage.list());
  }, []);

  const handleDelete = (id: string) => {
    if (!confirm("このマップを削除しますか？")) return;
    storage.remove(id);
    setMaps(storage.list());
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 text-center">
          <h1 className="bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-3xl font-extrabold text-transparent sm:text-4xl">
            🧠 AIマインドマップ
          </h1>
          <p className="mt-3 text-sm text-slate-600 sm:text-base">
            人間の脳で考えよう。
            <br />
            行き詰まったらAIと対話して想像を膨らませよう。
          </p>
        </header>

        <Link
          href="/new"
          className="mb-6 block w-full rounded-2xl bg-gradient-to-r from-orange-400 to-pink-500 px-6 py-4 text-center text-lg font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-95"
        >
          ＋ 新しいマップを作る
        </Link>

        <section>
          <h2 className="mb-3 text-sm font-bold text-slate-700">
            これまでのマップ
          </h2>
          {maps.length === 0 ? (
            <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
              まだマップがありません
            </div>
          ) : (
            <ul className="space-y-2">
              {maps.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-2 rounded-2xl bg-white p-4 shadow-sm"
                >
                  <Link
                    href={`/map/${m.id}`}
                    className="flex-1 truncate text-sm font-medium text-slate-800"
                  >
                    {m.theme}
                    <span className="ml-2 text-xs text-slate-400">
                      ({m.nodes.length}ノード)
                    </span>
                  </Link>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="rounded-lg px-2 py-1 text-xs text-rose-500 hover:bg-rose-50"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
