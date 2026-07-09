"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import ReactFlow, {
  Controls,
  type Edge,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
  applyNodeChanges,
} from "reactflow";
import "reactflow/dist/style.css";
import { useMindMapStore } from "@/store/mindmap-store";
import { CustomNode } from "./CustomNode";

const nodeTypes = { mindNode: CustomNode };

const edgeOptions = {
  type: "default", // ベジェ曲線
  className: "edge-draw",
  style: { stroke: "rgba(129, 216, 208, 0.4)", strokeWidth: 1.5 },
};

export function MindMapCanvas() {
  const map = useMindMapStore((s) => s.map);
  const selectedNodeId = useMindMapStore((s) => s.selectedNodeId);
  const setSelected = useMindMapStore((s) => s.setSelected);
  const updatePos = useMindMapStore((s) => s.updateNodePosition);
  const persist = useMindMapStore((s) => s.persist);
  const layoutVersion = useMindMapStore((s) => s.layoutVersion);
  const instanceRef = useRef<ReactFlowInstance | null>(null);

  // 「整える」実行後、整列結果が画面に収まるようにフィットする
  useEffect(() => {
    if (layoutVersion === 0) return;
    const t = setTimeout(() => {
      instanceRef.current?.fitView({ padding: 0.4, duration: 400 });
    }, 50);
    return () => clearTimeout(t);
  }, [layoutVersion]);

  const nodes: Node[] = useMemo(
    () =>
      map?.nodes.map((n) => ({
        id: n.id,
        type: "mindNode",
        position: n.position,
        data: n.data,
        selected: n.id === selectedNodeId,
      })) ?? [],
    [map?.nodes, selectedNodeId],
  );

  const edges: Edge[] = useMemo(
    () =>
      map?.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        ...edgeOptions,
      })) ?? [],
    [map?.edges],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const next = applyNodeChanges(changes, nodes);
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          updatePos(change.id, change.position.x, change.position.y);
        }
        if (change.type === "position" && change.dragging === false) {
          persist();
        }
      }
      void next;
    },
    [nodes, updatePos, persist],
  );

  return (
    <div className="canvas-paper h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onInit={(instance) => {
          instanceRef.current = instance;
        }}
        onNodeClick={(_, node) => setSelected(node.id)}
        onPaneClick={() => setSelected(null)}
        fitView
        fitViewOptions={{ padding: 0.4 }}
        minZoom={0.2}
        maxZoom={2}
        style={{ background: "transparent" }}
      >
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
