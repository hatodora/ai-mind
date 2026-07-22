import type { MindMap, MindMapEdge, MindMapNode } from "@/types";

/**
 * リアルタイム共同編集のマージ（NF-01a）。
 *
 * 保存は setDoc の全置換なので、素朴に適用すると「相手の保存が
 * 自分の直近の編集を消す」事故が起きる。そこでリモートのスナップショットを
 * 受け取ったら、ノード/エッジを id 単位でマージする:
 *  - 基本はリモートを正とする（最後の保存が勝つ）
 *  - 直近 DIRTY_WINDOW_MS 以内にローカルで触った要素はローカルを優先
 *  - 直近にローカルで削除した要素は、リモートにあっても復活させない
 *  - マージ結果がリモートと異なるなら呼び出し側がデバウンス保存して差分を癒す
 */

/** ローカル編集を保護する時間窓（ミリ秒） */
export const DIRTY_WINDOW_MS = 5000;

/** ローカルの編集履歴。id → 最終編集時刻 */
export interface DirtyState {
  nodes: Map<string, number>;
  edges: Map<string, number>;
  deletedNodes: Map<string, number>;
  deletedEdges: Map<string, number>;
  /** ゲージ・ターン等のメタ情報を最後に触った時刻（0 = 触っていない） */
  metaTouchedAt: number;
}

export function emptyDirty(): DirtyState {
  return {
    nodes: new Map(),
    edges: new Map(),
    deletedNodes: new Map(),
    deletedEdges: new Map(),
    metaTouchedAt: 0,
  };
}

/** 期限切れのダーティ記録を捨てる（無限に膨らませない） */
export function pruneDirty(dirty: DirtyState, now = Date.now()): void {
  const cutoff = now - DIRTY_WINDOW_MS;
  for (const m of [
    dirty.nodes,
    dirty.edges,
    dirty.deletedNodes,
    dirty.deletedEdges,
  ]) {
    for (const [id, ts] of m) {
      if (ts < cutoff) m.delete(id);
    }
  }
}

function isFresh(m: Map<string, number>, id: string, now: number): boolean {
  const ts = m.get(id);
  return ts !== undefined && ts > now - DIRTY_WINDOW_MS;
}

export function mergeMaps(
  local: MindMap,
  remote: MindMap,
  dirty: DirtyState,
  now = Date.now(),
): { merged: MindMap; divergedFromRemote: boolean } {
  // --- ノード ---
  const localNodes = new Map(local.nodes.map((n) => [n.id, n]));
  const nodes: MindMapNode[] = [];
  const seen = new Set<string>();
  for (const rn of remote.nodes) {
    seen.add(rn.id);
    // 直近にローカルで削除したノードは復活させない
    if (isFresh(dirty.deletedNodes, rn.id, now)) continue;
    // 直近にローカルで編集したノードはローカル版を優先
    const ln = localNodes.get(rn.id);
    nodes.push(ln && isFresh(dirty.nodes, rn.id, now) ? ln : rn);
  }
  // リモートに無いローカルノード: 直近に追加/編集したものだけ残す
  // （それ以外はリモート側で削除されたとみなす）
  for (const ln of local.nodes) {
    if (!seen.has(ln.id) && isFresh(dirty.nodes, ln.id, now)) {
      nodes.push(ln);
    }
  }

  // --- エッジ（ノードと同じ規則。ただし両端が生きているものだけ） ---
  const nodeIds = new Set(nodes.map((n) => n.id));
  const localEdges = new Map(local.edges.map((e) => [e.id, e]));
  const edges: MindMapEdge[] = [];
  const seenEdges = new Set<string>();
  for (const re of remote.edges) {
    seenEdges.add(re.id);
    if (isFresh(dirty.deletedEdges, re.id, now)) continue;
    const le = localEdges.get(re.id);
    const edge = le && isFresh(dirty.edges, re.id, now) ? le : re;
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) edges.push(edge);
  }
  for (const le of local.edges) {
    if (
      !seenEdges.has(le.id) &&
      isFresh(dirty.edges, le.id, now) &&
      nodeIds.has(le.source) &&
      nodeIds.has(le.target)
    ) {
      edges.push(le);
    }
  }

  // --- メタ情報（ゲージ・ターン等） ---
  // 基本はリモートが正。直近にローカルで操作した場合のみローカルを保つ
  // （所有権・共有設定は常にリモート＝サーバーの最新を正とする）
  const metaFresh = dirty.metaTouchedAt > now - DIRTY_WINDOW_MS;
  const merged: MindMap = {
    ...remote,
    nodes,
    edges,
    ...(metaFresh
      ? {
          aiGauge: local.aiGauge,
          currentTurn: local.currentTurn,
          turnCount: local.turnCount,
          aiRequestCount: local.aiRequestCount,
          completed: local.completed,
          completedAt: local.completedAt,
          assistLevel: local.assistLevel,
        }
      : {}),
  };

  const divergedFromRemote =
    JSON.stringify({ n: merged.nodes, e: merged.edges }) !==
    JSON.stringify({ n: remote.nodes, e: remote.edges });
  return { merged, divergedFromRemote };
}
