"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import type { NodeRole } from "@/types";

interface Data {
  label: string;
  role: NodeRole;
}

/**
 * ノードの3状態:
 * - root: ティファニーブルー地 × ダーク文字（Satoshi 見出し）
 * - user: ダークカード地 × 明るい文字
 * - ai:   アクセントティント地 × 破線＝「仮」の提案
 */
const styleByRole: Record<NodeRole, string> = {
  root: "bg-accent text-on-accent font-display font-bold shadow-[0_10px_24px_-8px_rgba(10,186,181,0.6)]",
  user: "bg-card text-ink border border-line shadow-[0_6px_18px_-8px_rgba(0,0,0,0.6)]",
  ai: "bg-tint-accent text-accent-soft border border-dashed border-ai-line",
};

export function CustomNode({ data, selected }: NodeProps<Data>) {
  return (
    <div
      className={`anim-float-up min-w-[80px] max-w-[200px] rounded-[12px] px-4.5 py-3 text-center text-[13.5px] leading-[1.5] ${
        styleByRole[data.role]
      } ${selected ? "anim-ring-pulse" : ""}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-1.5 !w-1.5 !border-0 !bg-ai-line"
      />
      <div className="break-words">{data.label}</div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-1.5 !w-1.5 !border-0 !bg-ai-line"
      />
    </div>
  );
}
