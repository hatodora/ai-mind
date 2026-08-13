"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { MISSIONS, nextMission } from "@/lib/tutorial";
import { useTutorialStore, useTutorialHydrate } from "@/store/tutorial-store";
import { Celebration } from "@/components/mindmap/Celebration";

/**
 * チュートリアルの進捗バー（TUT-02）。画面の上部に出す。
 *
 * 表示だけでなく、チュートリアル全体の面倒も見る:
 *  - 端末の記録の読み込み
 *  - 初回起動時の自動開始（autoStart を渡した画面でのみ）
 *  - 完走演出
 *  - 完走のプロフィールへの反映（TUT-03。バッジを別端末でも残すため）
 *
 * レイアウトに割り込まないよう position は素のまま。
 * 画面側で「いちばん上の子」として置くこと。
 */
export function TutorialBar({
  /** 初回だけ自動でチュートリアルを始める。ホーム画面にだけ渡す */
  autoStart = false,
}: {
  autoStart?: boolean;
}) {
  const hydrated = useTutorialHydrate();
  const active = useTutorialStore((s) => s.active);
  const done = useTutorialStore((s) => s.done);
  const seen = useTutorialStore((s) => s.seen);
  const clearedAt = useTutorialStore((s) => s.clearedAt);
  const justCleared = useTutorialStore((s) => s.justCleared);
  const start = useTutorialStore((s) => s.start);
  const stop = useTutorialStore((s) => s.stop);
  const clearJustCleared = useTutorialStore((s) => s.clearJustCleared);

  const { profile, markTutorialCleared } = useAuth();
  const [celebrating, setCelebrating] = useState(false);

  // 初回だけ自動で始める。2回目以降は自分で起動してもらう
  useEffect(() => {
    if (!hydrated || !autoStart || seen) return;
    const t = setTimeout(start, 600);
    return () => clearTimeout(t);
  }, [hydrated, autoStart, seen, start]);

  // 完走演出。ストア側のフラグは受け取ったらすぐ下ろす
  useEffect(() => {
    if (!justCleared) return;
    const t = setTimeout(() => {
      setCelebrating(true);
      clearJustCleared();
    }, 0);
    return () => clearTimeout(t);
  }, [justCleared, clearJustCleared]);

  // 完走をプロフィールへ記録する（TUT-03）。
  // 端末で完走したあとにログインした場合もここで拾える。
  // 失敗しても端末側の記録は残るので、バッジが消えることはない
  const syncingRef = useRef(false);
  useEffect(() => {
    if (!hydrated || clearedAt === null || !profile) return;
    if (profile.tutorialCompletedAt !== undefined || syncingRef.current) return;
    syncingRef.current = true;
    void markTutorialCleared()
      .catch((e) => console.error("チュートリアル完走の記録に失敗しました", e))
      .finally(() => {
        syncingRef.current = false;
      });
  }, [hydrated, clearedAt, profile, markTutorialCleared]);

  if (!hydrated || !active) {
    return celebrating ? (
      <Celebration
        title="チュートリアル完走"
        subtitle="バッジ「はじめの一歩」を獲得しました"
        onDone={() => setCelebrating(false)}
      />
    ) : null;
  }

  const current = nextMission(done);
  const pct = Math.round((done.length / MISSIONS.length) * 100);

  return (
    <>
      {celebrating && (
        <Celebration
          title="チュートリアル完走"
          subtitle="バッジ「はじめの一歩」を獲得しました"
          onDone={() => setCelebrating(false)}
        />
      )}
      <div
        className="shrink-0 border-b border-line bg-card px-4 py-2.5 sm:px-5"
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-baseline gap-2">
              <span className="micro-label shrink-0 !text-accent-soft">
                Tutorial
              </span>
              <span className="min-w-0 truncate text-[12.5px] text-ink">
                {current ? current.hint : "全ミッション達成！"}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              {/* ミッション1つ＝1目盛り。どこまで来たかを一目で */}
              <div className="flex min-w-0 flex-1 gap-1">
                {MISSIONS.map((m) => (
                  <span
                    key={m.id}
                    title={m.title}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      done.includes(m.id) ? "bg-accent" : "bg-card-raised"
                    }`}
                  />
                ))}
              </div>
              <span className="shrink-0 font-display text-[11px] tracking-wide text-muted">
                {done.length}/{MISSIONS.length}
              </span>
            </div>
          </div>
          <button
            onClick={stop}
            className="shrink-0 rounded-full border border-line bg-page px-3 py-1.5 text-[11px] text-muted transition-colors hover:text-ink"
          >
            やめる
          </button>
        </div>
        <span className="sr-only">
          チュートリアル進捗 {pct} パーセント
        </span>
      </div>
    </>
  );
}
