"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMindMapStore } from "@/store/mindmap-store";

const EXAMPLES = [
  "転職について考えたい",
  "夏休みの旅行プラン",
  "新しい趣味を探す",
  "週末をもっと楽しむ",
];

export default function NewMapPage() {
  const router = useRouter();
  const create = useMindMapStore((s) => s.create);
  const [theme, setTheme] = useState("");

  const handleCreate = () => {
    if (!theme.trim()) return;
    const map = create(theme.trim());
    router.push(`/map/${map.id}`);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <button
          onClick={() => router.back()}
          className="mb-6 text-sm text-slate-600 hover:text-slate-900"
        >
          ← 戻る
        </button>

        <h1 className="mb-2 text-2xl font-bold text-slate-800">
          何について考えたい？
        </h1>
        <p className="mb-6 text-sm text-slate-600">
          中心に置くテーマを1つ決めよう
        </p>

        <input
          type="text"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="例: 転職について考えたい"
          className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-base focus:border-orange-400 focus:outline-none"
          autoFocus
        />

        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setTheme(ex)}
              className="rounded-full bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm hover:bg-orange-50"
            >
              {ex}
            </button>
          ))}
        </div>

        <button
          onClick={handleCreate}
          disabled={!theme.trim()}
          className="mt-8 w-full rounded-2xl bg-gradient-to-r from-orange-400 to-pink-500 px-6 py-4 text-lg font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40"
        >
          マインドマップを始める
        </button>
      </div>
    </main>
  );
}
