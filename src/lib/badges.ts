import type { MindMap } from "@/types";

/**
 * バッジ（UP-01）。マップ群から統計を取り、達成状況を導出する。
 * どこにも保存せず毎回計算する（正解データはマップ本体のみ）。
 */

export interface ThinkStats {
  /** 自分の言葉で作ったノードの累計（root / ai を除く） */
  userNodes: number;
  /** AI提案から採用したノードの累計 */
  aiNodes: number;
  /** AIにアイデアを相談した回数の累計（explain / review は数えない） */
  aiRequests: number;
  /** 完成にしたマップの数 */
  completedMaps: number;
  /** AIの提案を一切使わず（相談も採用もせず）完成させたマップの数 */
  soloCompletedMaps: number;
  /** 1枚のマップの最大ノード数 */
  maxMapNodes: number;
}

export function computeStats(maps: MindMap[]): ThinkStats {
  const stats: ThinkStats = {
    userNodes: 0,
    aiNodes: 0,
    aiRequests: 0,
    completedMaps: 0,
    soloCompletedMaps: 0,
    maxMapNodes: 0,
  };
  for (const m of maps) {
    const users = m.nodes.filter((n) => n.data.role === "user").length;
    const ais = m.nodes.filter((n) => n.data.role === "ai").length;
    const requests = m.aiRequestCount ?? 0;
    stats.userNodes += users;
    stats.aiNodes += ais;
    stats.aiRequests += requests;
    stats.maxMapNodes = Math.max(stats.maxMapNodes, m.nodes.length);
    if (m.completed) {
      stats.completedMaps += 1;
      if (ais === 0 && requests === 0) stats.soloCompletedMaps += 1;
    }
  }
  return stats;
}

export interface BadgeDef {
  id: string;
  /** バッジ名（短く、記章らしく） */
  name: string;
  /** 獲得条件の説明 */
  description: string;
  /** 達成に必要な値 */
  goal: number;
  /** 現在値を統計から取り出す */
  value: (s: ThinkStats) => number;
}

export interface BadgeCategory {
  id: string;
  label: string;
  badges: BadgeDef[];
}

function tiers(
  categoryId: string,
  value: (s: ThinkStats) => number,
  describe: (goal: number) => string,
  defs: [goal: number, name: string][],
): BadgeDef[] {
  return defs.map(([goal, name]) => ({
    id: `${categoryId}_${goal}`,
    name,
    description: describe(goal),
    goal,
    value,
  }));
}

/** バッジ一覧（UP-01）。カテゴリごとに段階制 */
export const BADGE_CATEGORIES: BadgeCategory[] = [
  {
    id: "nodes",
    label: "つみかさね — 自分の言葉のノード",
    badges: tiers(
      "nodes",
      (s) => s.userNodes,
      (g) => `自分の言葉のノードを累計 ${g} 個つくる`,
      [
        [10, "芽吹き"],
        [50, "若木"],
        [150, "大樹"],
        [500, "思索の森"],
      ],
    ),
  },
  {
    id: "spread",
    label: "ひろがり — 1枚のマップの大きさ",
    badges: tiers(
      "spread",
      (s) => s.maxMapNodes,
      (g) => `1枚のマップを ${g} ノードまで広げる`,
      [
        [30, "広がる思考"],
        [80, "大きな地図"],
      ],
    ),
  },
  {
    id: "ai",
    label: "AIとの対話 — アイデアの相談",
    badges: tiers(
      "ai",
      (s) => s.aiRequests,
      (g) => `AIにアイデアを ${g} 回相談する`,
      [
        [1, "はじめての相談"],
        [25, "良き相棒"],
        [100, "対話の達人"],
      ],
    ),
  },
  {
    id: "solo",
    label: "自分のちからで — AIに頼らない完成",
    badges: tiers(
      "solo",
      (s) => s.soloCompletedMaps,
      (g) => `AIの提案を使わずにマップを ${g} 枚完成させる`,
      [
        [1, "独考の証"],
        [5, "孤高の思索家"],
      ],
    ),
  },
  {
    id: "complete",
    label: "完成 — 結論までたどり着く",
    badges: tiers(
      "complete",
      (s) => s.completedMaps,
      (g) => `マップを ${g} 枚完成させる`,
      [
        [1, "はじめての完成"],
        [10, "仕上げ屋"],
      ],
    ),
  },
];

export function isEarned(badge: BadgeDef, stats: ThinkStats): boolean {
  return badge.value(stats) >= badge.goal;
}

/** 獲得済みバッジ数（ページのサマリ表示用） */
export function countEarned(stats: ThinkStats): {
  earned: number;
  total: number;
} {
  let earned = 0;
  let total = 0;
  for (const cat of BADGE_CATEGORIES) {
    for (const b of cat.badges) {
      total += 1;
      if (isEarned(b, stats)) earned += 1;
    }
  }
  return { earned, total };
}
