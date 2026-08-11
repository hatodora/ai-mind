import { describe, expect, it } from "vitest";
import { autoPosition, tidyLayout } from "./layout";
import type { MindMapEdge, MindMapNode } from "@/types";

/**
 * ノード配置（UP-05 と手動追加時の自動配置）。
 *
 * 「1つずつ追加した兄弟ノードが同じ場所に積み重なって読めない」不具合の
 * 再発防止。ノードの見かけの大きさより広く離れていることを検査する。
 */

/** 画面上のノードのおおよその大きさ。この範囲が重なったら読めない */
const NODE_W = 180;
const NODE_H = 56;

function root(): MindMapNode {
  return {
    id: "root",
    data: { label: "テーマ", role: "root" },
    position: { x: 0, y: 0 },
    type: "mindNode",
  };
}

/** 親に n 個の子を1つずつ追加したときの位置を順に求める */
function addOneByOne(n: number): { x: number; y: number }[] {
  const nodes: MindMapNode[] = [root()];
  const edges: MindMapEdge[] = [];
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const pos = autoPosition("root", nodes, edges);
    out.push(pos);
    const id = `n${i}`;
    nodes.push({
      id,
      data: { label: id, role: "user" },
      position: pos,
      type: "mindNode",
    });
    edges.push({ id: `e-root-${id}`, source: "root", target: id });
  }
  return out;
}

function overlaps(
  a: { x: number; y: number },
  b: { x: number; y: number },
): boolean {
  return Math.abs(a.x - b.x) < NODE_W && Math.abs(a.y - b.y) < NODE_H;
}

describe("autoPosition", () => {
  it("1つずつ追加した兄弟ノードが重ならない", () => {
    const positions = addOneByOne(5);
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        expect(
          overlaps(positions[i], positions[j]),
          `${i} と ${j} が重なっている: ${JSON.stringify([
            positions[i],
            positions[j],
          ])}`,
        ).toBe(false);
      }
    }
  });

  it("兄弟が輪を使い切っても重ならない（12個）", () => {
    const positions = addOneByOne(12);
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        expect(overlaps(positions[i], positions[j])).toBe(false);
      }
    }
  });

  it("親から見て右側に、親自身とも重ならない位置に置く", () => {
    for (const p of addOneByOne(5)) {
      expect(p.x).toBeGreaterThan(0);
      expect(overlaps(p, { x: 0, y: 0 })).toBe(false);
    }
  });

  it("親が見つからなければ原点を返す", () => {
    expect(autoPosition("いない", [root()], [])).toEqual({ x: 0, y: 0 });
  });

  it("既存の兄弟がいる親に足すと、続きの席に置かれる", () => {
    const positions = addOneByOne(3);
    // 3個追加した後の4個目は、既存3個のどれとも重ならない
    const nodes: MindMapNode[] = [root()];
    const edges: MindMapEdge[] = [];
    positions.forEach((pos, i) => {
      nodes.push({
        id: `n${i}`,
        data: { label: `n${i}`, role: "user" },
        position: pos,
        type: "mindNode",
      });
      edges.push({ id: `e-root-n${i}`, source: "root", target: `n${i}` });
    });
    const next = autoPosition("root", nodes, edges);
    for (const p of positions) expect(overlaps(next, p)).toBe(false);
  });
});

describe("tidyLayout", () => {
  it("兄弟を横に並べ、階層を縦に下げる", () => {
    const nodes: MindMapNode[] = [
      root(),
      {
        id: "a",
        data: { label: "a", role: "user" },
        position: { x: 999, y: 999 },
      },
      {
        id: "b",
        data: { label: "b", role: "user" },
        position: { x: 999, y: 999 },
      },
    ];
    const edges: MindMapEdge[] = [
      { id: "e1", source: "root", target: "a" },
      { id: "e2", source: "root", target: "b" },
    ];
    const laid = tidyLayout(nodes, edges);
    const byId = new Map(laid.map((n) => [n.id, n.position]));
    expect(byId.get("a")!.y).toBeGreaterThan(byId.get("root")!.y);
    expect(byId.get("a")!.y).toBe(byId.get("b")!.y);
    expect(byId.get("a")!.x).not.toBe(byId.get("b")!.x);
  });

  it("ルートに繋がらない孤立ノードは動かさない", () => {
    const nodes: MindMapNode[] = [
      root(),
      {
        id: "lonely",
        data: { label: "孤立", role: "user" },
        position: { x: 42, y: 99 },
      },
    ];
    const laid = tidyLayout(nodes, []);
    expect(laid.find((n) => n.id === "lonely")!.position).toEqual({
      x: 42,
      y: 99,
    });
  });
});
