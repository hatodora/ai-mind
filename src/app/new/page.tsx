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
  const [creating, setCreating] = useState(false);

  const handleCreate = () => {
    // 二重クリック・Enter連打によるマップ重複作成を防ぐ
    if (creating || !theme.trim()) return;
    setCreating(true);
    const map = create(theme.trim());
    router.push(`/map/${map.id}`);
  };

  return (
    <main className="min-h-screen bg-page px-5 py-10 sm:py-16">
      <div className="mx-auto max-w-md">
        <button
          onClick={() => router.back()}
          className="icon-circle anim-float-up mb-10"
          aria-label="戻る"
        >
          <span className="font-display text-lg leading-none">←</span>
        </button>

        <div className="anim-float-up" style={{ animationDelay: "0.06s" }}>
          <div className="micro-label mb-2">テーマ</div>
          <h1 className="mb-2.5 font-display text-[30px] font-bold leading-snug tracking-tight">
            何について考えたい？
          </h1>
          <p className="mb-8 text-sm leading-relaxed text-muted">
            中心に置くテーマを1つ決めよう
          </p>

          <input
            type="text"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="例: 転職について考えたい"
            className="w-full rounded-[12px] border border-line bg-card px-5 py-4 text-[15px] text-ink outline-none ring-accent/40 transition-shadow placeholder:text-placeholder focus:border-accent/60 focus:ring-2"
            autoFocus
          />

          <div className="mt-5 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setTheme(ex)}
                className={`rounded-full px-4 py-2 text-xs transition-all ${
                  theme === ex
                    ? "bg-accent font-bold text-on-accent"
                    : "border border-line bg-card text-muted hover:border-accent/50 hover:text-accent-soft"
                }`}
              >
                {ex}
              </button>
            ))}
          </div>

          <button
            onClick={handleCreate}
            disabled={!theme.trim() || creating}
            className="btn-lift btn-primary mt-10 w-full py-4 text-[15px] disabled:opacity-40"
          >
            マインドマップを始める
          </button>
        </div>
      </div>
    </main>
  );
}
