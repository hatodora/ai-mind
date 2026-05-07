import type { MindMapEdge, MindMapNode } from "@/types";

export function autoPosition(
  parentId: string,
  nodes: MindMapNode[],
  edges: MindMapEdge[],
  index: number,
  total: number,
): { x: number; y: number } {
  const parent = nodes.find((n) => n.id === parentId);
  if (!parent) return { x: 0, y: 0 };

  const siblings = edges.filter((e) => e.source === parentId).length;
  const radius = 220 + siblings * 30;
  const angleSpread = Math.PI * 1.4;
  const startAngle = -angleSpread / 2;
  const angle =
    total <= 1 ? 0 : startAngle + (angleSpread * index) / Math.max(total - 1, 1);

  return {
    x: parent.position.x + Math.cos(angle) * radius,
    y: parent.position.y + Math.sin(angle) * radius + (siblings * 20 - 40),
  };
}
