"use client";

import { useEffect, useRef } from "react";

/** 紙吹雪の配色（デザイントークンに合わせる） */
const COLORS = ["#0abab5", "#81d8d0", "#fbbf24", "#f5f5f5"];

const PIECES = 22;

/** インデックスから 0..1 の擬似乱数を作る（純関数・再レンダーでも安定） */
function scatter(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** 紙吹雪の散らばり（決定的に生成するのでレンダー中でも安全） */
const CONFETTI = Array.from({ length: PIECES }, (_, i) => ({
  left: `${(i * 100) / PIECES + scatter(i, 1) * (100 / PIECES)}%`,
  delay: `${scatter(i, 2) * 0.5}s`,
  color: COLORS[i % COLORS.length],
  rotate: `${scatter(i, 3) * 60 - 30}deg`,
}));

/**
 * 達成演出（UP-01）。マイルストーン到達・マップ完成時に一度だけ表示する。
 * pointer-events を切ってあるので操作は邪魔しない。約2.4秒で自動終了。
 */
export function Celebration({
  title,
  subtitle,
  onDone,
}: {
  title: string;
  subtitle?: string;
  onDone: () => void;
}) {
  // onDone はインラインで渡されることが多く、依存に入れると
  // 親の再レンダーのたびにタイマーが引き直されて演出が終わらなくなる。
  // ref 経由で常に最新のコールバックを呼びつつ、タイマーは1回だけ張る。
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);
  useEffect(() => {
    const t = setTimeout(() => onDoneRef.current(), 2400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
      role="status"
      aria-live="polite"
    >
      {CONFETTI.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: p.left,
            animationDelay: p.delay,
            backgroundColor: p.color,
            rotate: p.rotate,
          }}
        />
      ))}
      <div className="flex h-full items-center justify-center px-6">
        <div className="celebration-card card-soft px-8 py-6 text-center">
          <div className="mb-1 flex items-center justify-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="font-display text-[22px] font-bold tracking-tight">
              {title}
            </span>
          </div>
          {subtitle && (
            <p className="text-xs leading-relaxed text-muted">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
