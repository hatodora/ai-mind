"use client";

import { create } from "zustand";
import type {
  AssistLevel,
  MindMap,
  MindMapEdge,
  MindMapNode,
  Turn,
} from "@/types";
import { newId } from "@/lib/storage";
import { getRepo } from "@/lib/repo";
import { autoPosition, tidyLayout } from "@/lib/layout";
import { emptyDirty, mergeMaps, pruneDirty } from "@/lib/merge";
import {
  DEFAULT_ASSIST_LEVEL,
  INITIAL_GRANT,
  UNLOCK_THRESHOLD,
  countUserNodes,
  effectiveLevel,
  isUnlocked,
  recoveryPerNode,
} from "@/lib/gauge";

interface State {
  map: MindMap | null;
  selectedNodeId: string | null;
  loading: boolean;
  /** 整列のたびに増える。キャンバス側が fitView するための合図 */
  layoutVersion: number;
  /** AIレビューが根拠にしたノード（NF-03）。キャンバスでハイライトする */
  highlightedNodeIds: string[];
}

interface Actions {
  load: (id: string) => Promise<void>;
  create: (theme: string, level?: AssistLevel) => MindMap;
  setSelected: (id: string | null) => void;
  /** このマップのAIアシストレベルを変更する（UP-02） */
  setAssistLevel: (level: AssistLevel) => void;
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
  /** AIにアイデアを相談した回数を記録する（UP-01 バッジ用） */
  noteAIRequest: () => void;
  /** マップを完成にする（UP-01）。結論レビュー後の「一時的に保存」で呼ぶ */
  completeMap: () => void;
  /** ノードをツリー状に自動整列する（UP-05） */
  arrange: () => void;
  /** レビュー根拠ノードのハイライトを設定/解除する（NF-03） */
  setHighlightedNodes: (ids: string[]) => void;
  /** 共同編集者を外す（NF-01a）。所有者のみ（ルールでも強制） */
  removeCollaborator: (uid: string) => void;
  /** リモート（共同編集相手）の変更を取り込む（NF-01a） */
  applyRemote: (remote: MindMap) => void;
  persist: () => void;
}

/** 保存はUI操作を待たせない。失敗はコンソールに残す（オフライン時など） */
function saveAsync(map: MindMap) {
  void getRepo()
    .save(map)
    .catch((e) => console.error("マップの保存に失敗しました", e));
}

// ---- リアルタイム共同編集（NF-01a）のローカル編集履歴 ----
// リモートのスナップショットとマージする際、直近にローカルで触った要素を
// 上書きから保護するために使う。UI状態ではないためストアの外に置く。
let dirty = emptyDirty();
let healTimer: ReturnType<typeof setTimeout> | null = null;

function markNode(id: string) {
  dirty.nodes.set(id, Date.now());
}
function markEdge(id: string) {
  dirty.edges.set(id, Date.now());
}
function markMeta() {
  dirty.metaTouchedAt = Date.now();
}
function resetDirty() {
  dirty = emptyDirty();
  if (healTimer) {
    clearTimeout(healTimer);
    healTimer = null;
  }
}

/**
 * ユーザーが1ノード追加した後のゲージ値を求める（UP-02）。
 * - ロック中（解禁ノード数未満）は貯まらない
 * - ちょうど解禁に達したら初期ゲージを付与
 * - 以降はレベルに応じた回復
 * off レベルはゲージを使わないため据え置き。
 */
function recoverOnUserNode(map: MindMap): number {
  const level = effectiveLevel(map.assistLevel);
  if (level === "off") return map.aiGauge;
  const userCountAfter = countUserNodes(map.nodes) + 1;
  if (userCountAfter < UNLOCK_THRESHOLD) return map.aiGauge;
  if (userCountAfter === UNLOCK_THRESHOLD) {
    return Math.max(map.aiGauge, INITIAL_GRANT);
  }
  return map.aiGauge + recoveryPerNode(level);
}

export const useMindMapStore = create<State & Actions>((set, get) => ({
  map: null,
  selectedNodeId: null,
  loading: false,
  layoutVersion: 0,
  highlightedNodeIds: [],

  load: async (id) => {
    set({ loading: true });
    let raw: MindMap | null = null;
    try {
      raw = await getRepo().get(id);
    } catch (e) {
      console.error("マップの読み込みに失敗しました", e);
    }
    // 旧データ補完（UP-02 移行）。旧マップ（assistLevel 未設定）で既に
    // 解禁ノード数に達しているものは、すぐ使えるよう初期ゲージを補う。
    // AI提案はローカル状態のため復元できない。「AIの番」のまま保存されていると
    // 入力UIが出ず操作不能になるので、読み込み時はユーザーの番に戻す。
    let map: MindMap | null = null;
    if (raw) {
      const isLegacy = raw.assistLevel === undefined;
      const userNodes = countUserNodes(raw.nodes);
      let aiGauge = raw.aiGauge ?? 0;
      if (isLegacy && isUnlocked(userNodes)) {
        aiGauge = Math.max(aiGauge, INITIAL_GRANT);
      }
      map = {
        ...raw,
        aiGauge,
        assistLevel: raw.assistLevel ?? DEFAULT_ASSIST_LEVEL,
        currentTurn: "user" as const,
      };
    }
    resetDirty();
    set({
      map,
      selectedNodeId: map?.nodes[0]?.id ?? null,
      loading: false,
      highlightedNodeIds: [],
    });
  },

  create: (theme, level = DEFAULT_ASSIST_LEVEL) => {
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
      aiGauge: 0, // まずは自分の頭で UNLOCK_THRESHOLD 個考えてから
      assistLevel: level,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    resetDirty();
    saveAsync(map);
    set({ map, selectedNodeId: rootId, highlightedNodeIds: [] });
    return map;
  },

  setSelected: (id) => set({ selectedNodeId: id }),

  setAssistLevel: (level) => {
    const map = get().map;
    if (!map) return;
    const updated: MindMap = { ...map, assistLevel: level };
    markMeta();
    set({ map: updated });
    saveAsync(updated);
  },

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
      // 自分の頭で考えた分だけ、AIに相談できる（UP-02）。
      // 回復量はアシストレベル依存。解禁ノード数に達するまでは貯まらず、
      // 到達した瞬間に初期ゲージを付与する。
      aiGauge: role === "user" ? recoverOnUserNode(map) : map.aiGauge,
    };
    markNode(id);
    markEdge(edge.id);
    markMeta();
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
    for (const n of newNodes) markNode(n.id);
    for (const e of newEdges) markEdge(e.id);
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
    // ゲージの返納（UP-02 の穴ふさぎ）: 「追加→削除」を繰り返すだけで
    // ゲージが無限に貯まらないよう、削除したユーザーノードの分は
    // 回復量と同じレートで差し引く。ただし回復が発生していたのは
    // 解禁しきい値を超えた分だけなので、その範囲でのみ返納する。
    const level = effectiveLevel(map.assistLevel);
    const userCountBefore = countUserNodes(map.nodes);
    const removedUserNodes = map.nodes.filter(
      (n) => toRemove.has(n.id) && n.data.role === "user",
    ).length;
    const refundable = Math.max(
      0,
      Math.min(removedUserNodes, userCountBefore - UNLOCK_THRESHOLD),
    );
    const aiGauge =
      level === "off"
        ? map.aiGauge
        : map.aiGauge - recoveryPerNode(level) * refundable;
    const updated: MindMap = {
      ...map,
      nodes: map.nodes.filter((n) => !toRemove.has(n.id)),
      edges: map.edges.filter(
        (e) => !toRemove.has(e.source) && !toRemove.has(e.target),
      ),
      aiGauge,
    };
    // 共同編集マージ用: 削除を記録（相手のスナップショットで復活させない）
    const now = Date.now();
    for (const nid of toRemove) dirty.deletedNodes.set(nid, now);
    for (const e of map.edges) {
      if (toRemove.has(e.source) || toRemove.has(e.target)) {
        dirty.deletedEdges.set(e.id, now);
      }
    }
    markMeta();
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
    markNode(id);
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
    markNode(id);
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
    markMeta();
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
    markMeta();
    set({ map: updated });
    saveAsync(updated);
    return ok;
  },

  noteAIRequest: () => {
    const map = get().map;
    if (!map) return;
    const updated: MindMap = {
      ...map,
      aiRequestCount: (map.aiRequestCount ?? 0) + 1,
    };
    markMeta();
    set({ map: updated });
    saveAsync(updated);
  },

  completeMap: () => {
    const map = get().map;
    if (!map || map.completed) return;
    const updated: MindMap = {
      ...map,
      completed: true,
      completedAt: Date.now(),
    };
    markMeta();
    set({ map: updated });
    saveAsync(updated);
  },

  setHighlightedNodes: (ids) => set({ highlightedNodeIds: ids }),

  removeCollaborator: (uid) => {
    const map = get().map;
    if (!map) return;
    const sharedWith = { ...(map.sharedWith ?? {}) };
    delete sharedWith[uid];
    const collaboratorNames = { ...(map.collaboratorNames ?? {}) };
    delete collaboratorNames[uid];
    const updated: MindMap = {
      ...map,
      sharedWith,
      collaboratorNames,
      // 誰もいなくなったら非公開へ戻す
      visibility:
        Object.keys(sharedWith).length === 0 && map.visibility === "shared"
          ? "private"
          : map.visibility,
    };
    set({ map: updated });
    saveAsync(updated);
  },

  arrange: () => {
    const map = get().map;
    if (!map) return;
    const updated: MindMap = {
      ...map,
      nodes: tidyLayout(map.nodes, map.edges),
    };
    // 整列は全ノードの位置を変えるので、全部をローカル編集として保護する
    for (const n of updated.nodes) markNode(n.id);
    set({ map: updated, layoutVersion: get().layoutVersion + 1 });
    saveAsync(updated);
  },

  applyRemote: (remote) => {
    const map = get().map;
    // 別マップのスナップショットや、読み込み前の通知は無視する
    if (!map || map.id !== remote.id) return;
    pruneDirty(dirty);
    const { merged, divergedFromRemote } = mergeMaps(map, remote, dirty);
    const selected = get().selectedNodeId;
    const stillThere =
      !!selected && merged.nodes.some((n) => n.id === selected);
    set({
      map: merged,
      selectedNodeId: stillThere ? selected : merged.nodes[0]?.id ?? null,
    });
    // マージ結果がリモートと違う（＝ローカルの編集を守った）場合は、
    // デバウンス保存でサーバー側との発散を癒す
    if (divergedFromRemote) {
      if (healTimer) clearTimeout(healTimer);
      healTimer = setTimeout(() => {
        healTimer = null;
        const current = get().map;
        if (current && current.id === remote.id) saveAsync(current);
      }, 1500);
    }
  },

  persist: () => {
    const map = get().map;
    if (map) saveAsync(map);
  },
}));
