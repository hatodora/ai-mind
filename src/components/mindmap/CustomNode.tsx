"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import type { NodeRole } from "@/types";

interface Data {
  label: string;
  role: NodeRole;
}

const styleByRole: Record<NodeRole, string> = {
  root: "bg-gradient-to-br from-orange-400 to-pink-500 text-white border-orange-500 shadow-lg",
  user: "bg-white text-slate-800 border-sky-400",
  ai: "bg-purple-50 text-purple-900 border-purple-400 border-dashed",
};

export function CustomNode({ data, selected }: NodeProps<Data>) {
  return (
    <div
      className={`px-4 py-2 rounded-2xl border-2 min-w-[80px] max-w-[200px] text-center text-sm font-medium transition-all ${
        styleByRole[data.role]
      } ${selected ? "ring-4 ring-amber-300 scale-105" : ""}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-300" />
      <div className="break-words">{data.label}</div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-300"
      />
    </div>
  );
}
