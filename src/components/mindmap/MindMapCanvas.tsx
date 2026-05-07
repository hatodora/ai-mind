"use client";

import { useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
  type NodeChange,
  applyNodeChanges,
} from "reactflow";
import "reactflow/dist/style.css";
import { useMindMapStore } from "@/store/mindmap-store";
import { CustomNode } from "./CustomNode";

const nodeTypes = { mindNode: CustomNode };

export function MindMapCanvas() {
  const map = useMindMapStore((s) => s.map);
  const selectedNodeId = useMindMapStore((s) => s.selectedNodeId);
  const setSelected = useMindMapStore((s) => s.setSelected);
  const updatePos = useMindMapStore((s) => s.updateNodePosition);
  const persist = useMindMapStore((s) => s.persist);

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
        animated: false,
        style: { stroke: "#94a3b8", strokeWidth: 2 },
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
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={(_, node) => setSelected(node.id)}
      onPaneClick={() => setSelected(null)}
      fitView
      fitViewOptions={{ padding: 0.4 }}
      minZoom={0.2}
      maxZoom={2}
    >
      <Background gap={20} color="#e2e8f0" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
