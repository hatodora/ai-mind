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

const H_GAP = 40; // 葉ノード同士の水平間隔
const V_GAP = 130; // 階層間の垂直間隔
const NODE_WIDTH = 180; // レイアウト計算上のノード幅

/**
 * ツリー整列レイアウト（UP-05）。
 * ルートを頂点に、各サブツリーの葉数に応じて幅を割り当てて
 * 重なりのない階層ツリーとして再配置する。
 * ルートに繋がらない孤立ノードは現在位置を維持する。
 */
export function tidyLayout(
  nodes: MindMapNode[],
  edges: MindMapEdge[],
): MindMapNode[] {
  const root = nodes.find((n) => n.data.role === "root") ?? nodes[0];
  if (!root) return nodes;

  const children = new Map<string, string[]>();
  for (const e of edges) {
    const list = children.get(e.source) ?? [];
    list.push(e.target);
    children.set(e.source, list);
  }

  // サブツリーの葉数（＝必要な幅の単位）
  const leafCount = new Map<string, number>();
  const countLeaves = (id: string, visited: Set<string>): number => {
    if (visited.has(id)) return 0;
    visited.add(id);
    const kids = children.get(id) ?? [];
    if (kids.length === 0) {
      leafCount.set(id, 1);
      return 1;
    }
    let sum = 0;
    for (const kid of kids) sum += countLeaves(kid, visited);
    const count = Math.max(sum, 1);
    leafCount.set(id, count);
    return count;
  };
  countLeaves(root.id, new Set());

  const positions = new Map<string, { x: number; y: number }>();
  const place = (
    id: string,
    depth: number,
    left: number,
    visited: Set<string>,
  ) => {
    if (visited.has(id)) return;
    visited.add(id);
    const width = (leafCount.get(id) ?? 1) * (NODE_WIDTH + H_GAP);
    positions.set(id, {
      x: left + width / 2 - NODE_WIDTH / 2,
      y: depth * V_GAP,
    });
    let childLeft = left;
    for (const kid of children.get(id) ?? []) {
      const childWidth = (leafCount.get(kid) ?? 1) * (NODE_WIDTH + H_GAP);
      place(kid, depth + 1, childLeft, visited);
      childLeft += childWidth;
    }
  };
  place(root.id, 0, 0, new Set());

  return nodes.map((n) => {
    const pos = positions.get(n.id);
    return pos ? { ...n, position: pos } : n;
  });
}
