import type { AssistLevel, MindMapNode } from "@/types";

/**
 * AIアシストレベル制（UP-02）の計算ロジックを集約する。
 *
 * 設計の要:
 * - 内部単位は「クレジット」。1 AIターン = 3クレジット。
 *   こうすると Level 3 の「3ノードで1回」も端数なしの整数で扱える。
 * - 最初の UNLOCK_THRESHOLD ノードを自分で作るまで AI はロック。
 *   到達時に INITIAL_GRANT（＝1ターン）を付与する。
 * - 一括採用は「採用数の3倍のノード追加」で回復するだけのペナルティを課す。
 */

/** 既定のアシストレベル（新規マップ・未設定マップに適用） */
export const DEFAULT_ASSIST_LEVEL: AssistLevel = "level2";

/** 1 AIターンあたりのクレジット数 */
export const CREDITS_PER_TURN = 3;

/** AIに1回相談するコスト（＝1ターン） */
export const AI_REQUEST_COST = CREDITS_PER_TURN;

/** AIが解禁されるまでに自分で伸ばすノード数 */
export const UNLOCK_THRESHOLD = 5;

/** 解禁時に付与する初期ゲージ（＝1ターン） */
export const INITIAL_GRANT = CREDITS_PER_TURN;

/** 一括採用ペナルティ倍率（どのレベルでも「採用数×この値」ノードで回復） */
export const BULK_PENALTY_MULT = 3;

/** レベルごとの「1ノード追加あたりの回復クレジット」 */
export function recoveryPerNode(level: AssistLevel): number {
  switch (level) {
    case "level1":
      return CREDITS_PER_TURN * 2; // 1ノード = AI2回 → 6
    case "level2":
      return CREDITS_PER_TURN; // 1ノード = AI1回 → 3
    case "level3":
      return CREDITS_PER_TURN / 3; // 3ノード = AI1回 → 1
    case "off":
      return 0;
  }
}

/** マップの実効レベル（未設定なら既定） */
export function effectiveLevel(assistLevel: AssistLevel | undefined): AssistLevel {
  return assistLevel ?? DEFAULT_ASSIST_LEVEL;
}

/** 自分で作ったノード数（root / ai を除く） */
export function countUserNodes(nodes: MindMapNode[]): number {
  return nodes.filter((n) => n.data.role === "user").length;
}

/** AIが解禁されているか（最初の閾値ノードを作り終えたか） */
export function isUnlocked(userNodeCount: number): boolean {
  return userNodeCount >= UNLOCK_THRESHOLD;
}

/** 一括採用（N個）のペナルティ（消費クレジット） */
export function bulkPenalty(level: AssistLevel, n: number): number {
  return BULK_PENALTY_MULT * recoveryPerNode(level) * n;
}

/** 一括採用後、次にAIへ聞くまでに必要な概算ノード数 */
export function bulkPenaltyNodes(n: number): number {
  return BULK_PENALTY_MULT * n;
}

// ---------- お助け機能（NF-04改） ----------

/** お助け機能の前提: マップの総ノード数（root含む）がこれ以上 */
export const HELPER_MIN_NODES = 30;
/** お助け機能の前提: AI使用率がこれ以下 */
export const HELPER_MAX_AI_RATIO = 0.5;
/** お助け機能の発動: この秒数ノードが伸びない（活動がない）と行き詰まりとみなす */
export const HELPER_STALL_SECONDS = 180;

/** AIが作ったノード数（root を除く） */
export function countAINodes(nodes: MindMapNode[]): number {
  return nodes.filter((n) => n.data.role === "ai").length;
}

/** AI使用率 = AIノード / (人間＋AI)。root は数えない。ノードが無ければ 0 */
export function aiUsageRatio(nodes: MindMapNode[]): number {
  const user = countUserNodes(nodes);
  const ai = countAINodes(nodes);
  const total = user + ai;
  return total === 0 ? 0 : ai / total;
}

/**
 * お助け機能（ゲージ無関係の無料AI提案1回）の前提条件。
 * 「ある程度自力で広げたのに行き詰まっている人」だけを救済する。
 */
export function helperEligible(nodes: MindMapNode[]): boolean {
  return (
    nodes.length >= HELPER_MIN_NODES &&
    aiUsageRatio(nodes) <= HELPER_MAX_AI_RATIO
  );
}

/** 表示用: クレジット → AIターン数（切り捨て・負値は0） */
export function creditsToTurns(credits: number): number {
  return Math.max(0, Math.floor(credits / CREDITS_PER_TURN));
}

/** ゲージ不足時、あと何ノードでAIに相談できるかの概算 */
export function nodesUntilNextTurn(credits: number, level: AssistLevel): number {
  const deficit = AI_REQUEST_COST - credits;
  const per = recoveryPerNode(level);
  if (deficit <= 0 || per <= 0) return 0;
  return Math.ceil(deficit / per);
}
