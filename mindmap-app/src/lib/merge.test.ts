import { describe, expect, it } from "vitest";
import type { MindMap, MindMapEdge, MindMapNode } from "@/types";
import { DIRTY_WINDOW_MS, emptyDirty, mergeMaps, pruneDirty } from "./merge";

function makeNode(id: string, label = id): MindMapNode {
  return { id, data: { label, role: "user" }, position: { x: 0, y: 0 } };
}

function makeEdge(id: string, source: string, target: string): MindMapEdge {
  return { id, source, target };
}

function makeMap(overrides: Partial<MindMap> = {}): MindMap {
  return {
    id: "map1",
    theme: "テーマ",
    nodes: [],
    edges: [],
    currentTurn: "user",
    turnCount: 0,
    aiGauge: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe("emptyDirty / pruneDirty", () => {
  it("初期状態は全て空", () => {
    const dirty = emptyDirty();
    expect(dirty.nodes.size).toBe(0);
    expect(dirty.metaTouchedAt).toBe(0);
  });

  it("期限切れの記録だけを間引く", () => {
    const dirty = emptyDirty();
    const now = 100_000;
    dirty.nodes.set("old", now - DIRTY_WINDOW_MS - 1);
    dirty.nodes.set("fresh", now - 100);
    pruneDirty(dirty, now);
    expect(dirty.nodes.has("old")).toBe(false);
    expect(dirty.nodes.has("fresh")).toBe(true);
  });
});

describe("mergeMaps", () => {
  it("何も編集していなければリモートをそのまま採用する", () => {
    const local = makeMap({ nodes: [makeNode("a", "古い")] });
    const remote = makeMap({ nodes: [makeNode("a", "新しい")] });
    const { merged, divergedFromRemote } = mergeMaps(local, remote, emptyDirty());
    expect(merged.nodes[0].data.label).toBe("新しい");
    expect(divergedFromRemote).toBe(false);
  });

  it("直近ローカル編集はリモートより優先される", () => {
    const now = 1_000_000;
    const local = makeMap({ nodes: [makeNode("a", "ローカル編集")] });
    const remote = makeMap({ nodes: [makeNode("a", "リモート版")] });
    const dirty = emptyDirty();
    dirty.nodes.set("a", now - 100);
    const { merged, divergedFromRemote } = mergeMaps(local, remote, dirty, now);
    expect(merged.nodes[0].data.label).toBe("ローカル編集");
    expect(divergedFromRemote).toBe(true);
  });

  it("編集ウィンドウを過ぎたローカル編集はリモートに上書きされる", () => {
    const now = 1_000_000;
    const local = makeMap({ nodes: [makeNode("a", "ローカル編集")] });
    const remote = makeMap({ nodes: [makeNode("a", "リモート版")] });
    const dirty = emptyDirty();
    dirty.nodes.set("a", now - DIRTY_WINDOW_MS - 1);
    const { merged } = mergeMaps(local, remote, dirty, now);
    expect(merged.nodes[0].data.label).toBe("リモート版");
  });

  it("直近削除したノードはリモートに残っていても復活させない", () => {
    const now = 1_000_000;
    const local = makeMap({ nodes: [] });
    const remote = makeMap({ nodes: [makeNode("a")] });
    const dirty = emptyDirty();
    dirty.deletedNodes.set("a", now - 100);
    const { merged } = mergeMaps(local, remote, dirty, now);
    expect(merged.nodes).toHaveLength(0);
  });

  it("直近ローカルで追加したがリモートにまだ無いノードは残す", () => {
    const now = 1_000_000;
    const local = makeMap({ nodes: [makeNode("new")] });
    const remote = makeMap({ nodes: [] });
    const dirty = emptyDirty();
    dirty.nodes.set("new", now - 100);
    const { merged } = mergeMaps(local, remote, dirty, now);
    expect(merged.nodes.map((n) => n.id)).toEqual(["new"]);
  });

  it("リモートに無く編集記録も無いローカルノードはリモート側削除とみなして消える", () => {
    const local = makeMap({ nodes: [makeNode("gone")] });
    const remote = makeMap({ nodes: [] });
    const { merged } = mergeMaps(local, remote, emptyDirty());
    expect(merged.nodes).toHaveLength(0);
  });

  it("両端ノードが存在しないエッジは含めない", () => {
    const now = 1_000_000;
    const local = makeMap({
      nodes: [makeNode("a")],
      edges: [makeEdge("e1", "a", "missing")],
    });
    const remote = makeMap({ nodes: [makeNode("a")], edges: [] });
    const dirty = emptyDirty();
    dirty.edges.set("e1", now - 100);
    const { merged } = mergeMaps(local, remote, dirty, now);
    expect(merged.edges).toHaveLength(0);
  });

  it("直近削除したエッジはリモートに残っていても復活させない", () => {
    const now = 1_000_000;
    const local = makeMap({ nodes: [makeNode("a"), makeNode("b")], edges: [] });
    const remote = makeMap({
      nodes: [makeNode("a"), makeNode("b")],
      edges: [makeEdge("e1", "a", "b")],
    });
    const dirty = emptyDirty();
    dirty.deletedEdges.set("e1", now - 100);
    const { merged } = mergeMaps(local, remote, dirty, now);
    expect(merged.edges).toHaveLength(0);
  });

  it("メタ情報は既定でリモートを正とする", () => {
    const local = makeMap({ aiGauge: 999, turnCount: 999 });
    const remote = makeMap({ aiGauge: 3, turnCount: 1 });
    const { merged } = mergeMaps(local, remote, emptyDirty());
    expect(merged.aiGauge).toBe(3);
    expect(merged.turnCount).toBe(1);
  });

  it("直近ローカルでメタ情報を操作していればローカルを保つ", () => {
    const now = 1_000_000;
    const local = makeMap({ aiGauge: 999, turnCount: 5 });
    const remote = makeMap({ aiGauge: 3, turnCount: 1 });
    const dirty = emptyDirty();
    dirty.metaTouchedAt = now - 100;
    const { merged } = mergeMaps(local, remote, dirty, now);
    expect(merged.aiGauge).toBe(999);
    expect(merged.turnCount).toBe(5);
  });

  it("所有権・共有設定は常にリモートを正とする（メタ新鮮でも）", () => {
    const now = 1_000_000;
    const local = makeMap({ ownerId: "local-owner", visibility: "private" });
    const remote = makeMap({ ownerId: "remote-owner", visibility: "shared" });
    const dirty = emptyDirty();
    dirty.metaTouchedAt = now - 100;
    const { merged } = mergeMaps(local, remote, dirty, now);
    expect(merged.ownerId).toBe("remote-owner");
    expect(merged.visibility).toBe("shared");
  });
});

describe("省略可能なメタ情報の保護", () => {
  // 共同編集相手が立てた完成フラグを、ローカルの未設定値で消さないこと
  function base(): MindMap {
    return {
      id: "m1",
      theme: "テーマ",
      nodes: [],
      edges: [],
      currentTurn: "user",
      turnCount: 0,
      aiGauge: 0,
      createdAt: 0,
      updatedAt: 0,
    };
  }

  it("相手が立てた completed をローカルの未設定で消さない", () => {
    const local = base();
    const remote: MindMap = { ...base(), completed: true, completedAt: 1234 };
    const dirty = emptyDirty();
    dirty.metaTouchedAt = Date.now();

    const { merged } = mergeMaps(local, remote, dirty);

    expect(merged.completed).toBe(true);
    expect(merged.completedAt).toBe(1234);
  });

  it("ローカルで完成にした直後はローカルを優先する", () => {
    const local: MindMap = { ...base(), completed: true, completedAt: 999 };
    const remote = base();
    const dirty = emptyDirty();
    dirty.metaTouchedAt = Date.now();

    const { merged } = mergeMaps(local, remote, dirty);

    expect(merged.completed).toBe(true);
    expect(merged.completedAt).toBe(999);
  });
});
