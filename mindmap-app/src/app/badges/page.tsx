"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getRepo } from "@/lib/repo";
import {
  BADGE_CATEGORIES,
  computeStats,
  countEarned,
  isEarned,
  type ThinkStats,
} from "@/lib/badges";

/**
 * バッジ一覧（UP-01）。獲得済み・未獲得をまとめて確認できる。
 * 将来はお気に入りバッジをホーム画面へ掲載できるようにする予定。
 */
export default function BadgesPage() {
  const { initializing } = useAuth();
  const [stats, setStats] = useState<ThinkStats | null>(null);

  useEffect(() => {
    if (initializing) return;
    const t = setTimeout(async () => {
      try {
        setStats(computeStats(await getRepo().list()));
      } catch (e) {
        console.error("バッジの集計に失敗しました", e);
        setStats(computeStats([]));
      }
    }, 0);
    return () => clearTimeout(t);
  }, [initializing]);

  if (initializing || !stats) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page">
        <div className="text-sm text-muted">読み込み中…</div>
      </main>
    );
  }

  const { earned, total } = countEarned(stats);

  return (
    <main className="min-h-screen bg-page px-5 py-10 sm:py-16">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="icon-circle anim-float-up mb-10" aria-label="戻る">
          <span className="font-display text-lg leading-none">←</span>
        </Link>

        <div className="anim-float-up" style={{ animationDelay: "0.06s" }}>
          <div className="micro-label mb-2">Badges</div>
          <h1 className="mb-2.5 font-display text-[30px] font-bold leading-snug tracking-tight">
            バッジ
          </h1>
          <p className="mb-10 text-sm leading-relaxed text-muted">
            思索のあしあと。{" "}
            <span className="font-display font-bold text-accent-soft">
              {earned}
            </span>
            <span className="font-display"> / {total}</span> 獲得
          </p>
        </div>

        <div className="flex flex-col gap-10">
          {BADGE_CATEGORIES.map((cat, ci) => (
            <section
              key={cat.id}
              className="anim-float-up"
              style={{ animationDelay: `${0.1 + ci * 0.05}s` }}
            >
              <div className="micro-label mb-3.5">{cat.label}</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {cat.badges.map((b) => {
                  const got = isEarned(b, stats);
                  const now = Math.min(b.value(stats), b.goal);
                  return (
                    <div
                      key={b.id}
                      className={`card-soft flex flex-col items-center px-4 py-5 text-center transition-opacity ${
                        got ? "" : "opacity-55"
                      }`}
                    >
                      <span
                        className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full font-display text-[17px] font-bold ${
                          got
                            ? "bg-accent text-on-accent"
                            : "border border-dashed border-line bg-card-raised text-placeholder"
                        }`}
                      >
                        {b.name.charAt(0)}
                      </span>
                      <span
                        className={`text-[13px] font-bold ${
                          got ? "text-ink" : "text-muted"
                        }`}
                      >
                        {b.name}
                      </span>
                      <span className="mt-1 text-[10px] leading-relaxed text-muted">
                        {b.description}
                      </span>
                      {!got && (
                        <span className="mt-2 font-display text-[10px] tracking-wide text-placeholder">
                          {now} / {b.goal}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
