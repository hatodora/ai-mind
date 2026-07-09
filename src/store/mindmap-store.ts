"use client";

import { create } from "zustand";
import type { MindMap, MindMapEdge, MindMapNode, Turn } from "@/types";
import { newId } from "@/lib/storage";
import { getRepo } from "@/lib/repo";
import { autoPosition, tidyLayout } from "@/lib/layout";

interface State {
  map: MindMap | null;
  selectedNodeId: string | null;
  loading: boolean;
  /** 整列のたびに増える。キャンバス側が fitView するための合図 */
  layoutVersion: number;
}

interface Actions {
  load: (id: string) => Promise<void>;
  create: (theme: string) => MindMap;
  setSelected: (id: string | null) => void;
  addNode: (
    parentId: string,
    label: string,
    role: "user" | "ai",
  ) => MindMapNode | null;
  addNodes: (
    parentId: string,
    labels: string[],
    role: "user" | "ai",
  ) => MindMapNode[];
  removeNode: (id: string) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;
  updateNodeLabel: (id: string, label: string) => void;
  setTurn: (turn: Turn) => void;
  /** AIトークンゲージを消費する（UP-02）。足りなければ false */
  spendGauge: (amount: number) => boolean;
  /** ノードをツリー状に自動整列する（UP-05） */
  arrange: () => void;
  persist: () => void;
}

/** 保存はUI操作を待たせない。失敗はコンソールに残す（オフライン時など） */
function saveAsync(map: MindMap) {
  void getRepo()
    .save(map)
    .catch((e) => console.error("マップの保存に失敗しました", e));
}

export const useMindMapStore = create<State & Actions>((set, get) => ({
  map: null,
  selectedNodeId: null,
  loading: false,
  layoutVersion: 0,

  load: async (id) => {
    set({ loading: true });
    let raw: MindMap | null = null;
    try {
      raw = await getRepo().get(id);
    } catch (e) {
      console.error("マップの読み込みに失敗しました", e);
    }
    // 旧データには aiGauge が無いため補完する（1 = すぐAIに1回相談できる）。
    // AI提案はローカル状態のため復元できない。「AIの番」のまま保存されていると
    // 入力UIが出ず操作不能になるので、読み込み時はユーザーの番に戻す。
    const map = raw
      ? {
          ...raw,
          aiGauge: raw.aiGauge ?? 1,
          currentTurn: "user" as const,
        }
      : null;
    set({ map, selectedNodeId: map?.nodes[0]?.id ?? null, loading: false });
  },

  create: (theme) => {
    const rootId = newId();
    const map: MindMap = {
      id: newId(),
      theme,
      nodes: [
        {
          id: rootId,
          data: { label: theme, role: "root" },
          position: { x: 0, y: 0 },
          type: "mindNode",
        },
      ],
      edges: [],
      currentTurn: "user",
      turnCount: 0,
      aiGauge: 0, // まずは自分の頭で1つ考えてから
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveAsync(map);
    set({ map, selectedNodeId: rootId });
    return map;
  },

  setSelected: (id) => set({ selectedNodeId: id }),

  addNode: (parentId, label, role) => {
    const map = get().map;
    if (!map) return null;
    const id = newId();
    const node: MindMapNode = {
      id,
      data: { label, role },
      position: autoPosition(parentId, map.nodes, map.edges, 0, 1),
      type: "mindNode",
    };
    const edge: MindMapEdge = {
      id: `e-${parentId}-${id}`,
      source: parentId,
      target: id,
    };
    const updated: MindMap = {
      ...map,
      nodes: [...map.nodes, node],
      edges: [...map.edges, edge],
      // 自分の頭で考えた分だけ、AIに相談できる（UP-02）
      aiGauge: role === "user" ? map.aiGauge + 1 : map.aiGauge,
    };
    set({ map: updated });
    saveAsync(updated);
    return node;
  },

  addNodes: (parentId, labels, role) => {
    const map = get().map;
    if (!map) return [];
    const newNodes: MindMapNode[] = [];
    const newEdges: MindMapEdge[] = [];
    labels.forEach((label, i) => {
      const id = newId();
      newNodes.push({
        id,
        data: { label, role },
        position: autoPosition(
          parentId,
          [...map.nodes, ...newNodes],
          [...map.edges, ...newEdges],
          i,
          labels.length,
        ),
        type: "mindNode",
      });
      newEdges.push({
        id: `e-${parentId}-${id}`,
        source: parentId,
        target: id,
      });
    });
    const updated: MindMap = {
      ...map,
      nodes: [...map.nodes, ...newNodes],
      edges: [...map.edges, ...newEdges],
    };
    set({ map: updated });
    saveAsync(updated);
    return newNodes;
  },

  removeNode: (id) => {
    const map = get().map;
    if (!map) return;
    const toRemove = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of map.edges) {
        if (toRemove.has(e.source) && !toRemove.has(e.target)) {
          toRemove.add(e.target);
          changed = true;
        }
      }
    }
    const updated: MindMap = {
      ...map,
      nodes: map.nodes.filter((n) => !toRemove.has(n.id)),
      edges: map.edges.filter(
        (e) => !toRemove.has(e.source) && !toRemove.has(e.target),
      ),
    };
    set({
      map: updated,
      selectedNodeId:
        get().selectedNodeId && toRemove.has(get().selectedNodeId!)
          ? updated.nodes[0]?.id ?? null
          : get().selectedNodeId,
    });
    saveAsync(updated);
  },

  updateNodePosition: (id, x, y) => {
    const map = get().map;
    if (!map) return;
    const updated: MindMap = {
      ...map,
      nodes: map.nodes.map((n) =>
        n.id === id ? { ...n, position: { x, y } } : n,
      ),
    };
    set({ map: updated });
  },

  updateNodeLabel: (id, label) => {
    const map = get().map;
    if (!map) return;
    const updated: MindMap = {
      ...map,
      nodes: map.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label } } : n,
      ),
    };
    set({ map: updated });
    saveAsync(updated);
  },

  setTurn: (turn) => {
    const map = get().map;
    if (!map) return;
    const updated: MindMap = {
      ...map,
      currentTurn: turn,
      turnCount: turn === "user" ? map.turnCount + 1 : map.turnCount,
    };
    set({ map: updated });
    saveAsync(updated);
  },

  spendGauge: (amount) => {
    const map = get().map;
    if (!map) return false;
    const ok = map.aiGauge >= amount;
    // 一括採用ペナルティはマイナス残高（＝借金）も許す。
    // 返済し終わるまでAIには相談できない。
    const updated: MindMap = { ...map, aiGauge: map.aiGauge - amount };
    set({ map: updated });
    saveAsync(updated);
    return ok;
  },

  arrange: () => {
    const map = get().map;
    if (!map) return;
    const updated: MindMap = {
      ...map,
      nodes: tidyLayout(map.nodes, map.edges),
    };
    set({ map: updated, layoutVersion: get().layoutVersion + 1 });
    saveAsync(updated);
  },

  persist: () => {
    const map = get().map;
    if (map) saveAsync(map);
  },
}));
