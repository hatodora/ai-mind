"use client";

import {
  HELPER_MAX_AI_RATIO,
  HELPER_MIN_NODES,
  aiUsageRatio,
  countAINodes,
  countUserNodes,
} from "@/lib/gauge";
import type { MindMapNode } from "@/types";

/**
 * AI使用率のミニ円グラフ（NF-04改）。キャンバス右上に置く。
 * お助け機能の前提（総ノード30以上）を満たすマップでのみ表示し、
 * AI使用率が5割を超えている（＝お助け対象外）ときは警告色で示す。
 * 配色はホームのバランスリング（UP-03）に合わせる: 自分=accent / AI=warm。
 */
export function AIRatioChart({ nodes }: { nodes: MindMapNode[] }) {
  if (nodes.length < HELPER_MIN_NODES) return null;
  const userNodes = countUserNodes(nodes);
  const aiNodes = countAINodes(nodes);
  if (userNodes + aiNodes === 0) return null;

  const ratio = aiUsageRatio(nodes);
  const pct = Math.round(ratio * 100);
  const over = ratio > HELPER_MAX_AI_RATIO;
  const R = 20;
  const C = 2 * Math.PI * R;

  return (
    <div
      className="anim-float-up pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-2.5 rounded-full border border-line bg-card/90 py-1.5 pl-2 pr-4 backdrop-blur-sm"
      title={`自分 ${userNodes} ノード / AI ${aiNodes} ノード`}
      role="img"
      aria-label={`AI使用率 ${pct}%`}
    >
      <svg viewBox="0 0 48 48" className="h-9 w-9 shrink-0">
        {/* 下地 */}
        <circle
          cx="24"
          cy="24"
          r={R}
          fill="none"
          stroke="var(--card-raised)"
          strokeWidth="6"
        />
        {/* 自分（残り） */}
        <circle
          cx="24"
          cy="24"
          r={R}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="6"
          strokeDasharray={`${C * (1 - ratio)} ${C}`}
          strokeDashoffset={-C * ratio}
          transform="rotate(-90 24 24)"
        />
        {/* AI */}
        <circle
          cx="24"
          cy="24"
          r={R}
          fill="none"
          stroke={over ? "var(--danger)" : "var(--warm)"}
          strokeWidth="6"
          strokeLinecap={ratio > 0 && ratio < 1 ? "round" : "butt"}
          strokeDasharray={`${C * ratio} ${C}`}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <div className="leading-tight">
        <div
          className={`font-display text-[13px] font-bold ${
            over ? "text-danger" : "text-ink"
          }`}
        >
          AI {pct}%
        </div>
        <div className="text-[9px] tracking-wide text-muted">使用率</div>
      </div>
    </div>
  );
}
