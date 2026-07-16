"use client";

import { useMemo } from "react";
import ReactFlow, { type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";
import type { CommunityPost } from "@/types";
import { CustomNode } from "@/components/mindmap/CustomNode";

const nodeTypes = { mindNode: CustomNode };

/**
 * 投稿された部分ツリーの読み取り専用表示（NF-01b）。
 * 公開時点のスナップショットをそのまま描画する（編集不可・閲覧のみ）。
 */
export function PostMapView({ post }: { post: CommunityPost }) {
  const nodes: Node[] = useMemo(
    () =>
      post.nodes.map((n) => ({
        id: n.id,
        type: "mindNode",
        position: n.position,
        data: n.data,
        draggable: false,
        connectable: false,
        selectable: false,
      })),
    [post.nodes],
  );
  const edges: Edge[] = useMemo(
    () =>
      post.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: "default",
        style: { stroke: "rgba(129, 216, 208, 0.4)", strokeWidth: 1.5 },
      })),
    [post.edges],
  );

  return (
    <div className="canvas-paper h-full w-full overflow-hidden rounded-[12px] border border-line">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        style={{ background: "transparent" }}
      />
    </div>
  );
}
