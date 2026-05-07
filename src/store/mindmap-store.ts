"use client";

import { create } from "zustand";
import type { MindMap, MindMapEdge, MindMapNode, Turn } from "@/types";
import { newId, storage } from "@/lib/storage";
import { autoPosition } from "@/lib/layout";

interface State {
  map: MindMap | null;
  selectedNodeId: string | null;
  loading: boolean;
}

interface Actions {
  load: (id: string) => void;
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
  persist: () => void;
}

export const useMindMapStore = create<State & Actions>((set, get) => ({
  map: null,
  selectedNodeId: null,
  loading: false,

  load: (id) => {
    const map = storage.get(id);
    set({ map, selectedNodeId: map?.nodes[0]?.id ?? null });
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
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    storage.save(map);
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
    };
    set({ map: updated });
    storage.save(updated);
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
    storage.save(updated);
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
    storage.save(updated);
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
    storage.save(updated);
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
    storage.save(updated);
  },

  persist: () => {
    const map = get().map;
    if (map) storage.save(map);
  },
}));
