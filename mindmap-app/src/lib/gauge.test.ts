import { describe, expect, it } from "vitest";
import type { MindMapNode } from "@/types";
import {
  AI_REQUEST_COST,
  BULK_PENALTY_MULT,
  CREDITS_PER_TURN,
  DEFAULT_ASSIST_LEVEL,
  HELPER_MAX_AI_RATIO,
  HELPER_MIN_NODES,
  INITIAL_GRANT,
  UNLOCK_THRESHOLD,
  aiUsageRatio,
  bulkPenalty,
  bulkPenaltyNodes,
  countAINodes,
  countUserNodes,
  creditsToTurns,
  effectiveLevel,
  helperEligible,
  isUnlocked,
  nodesUntilNextTurn,
  recoveryPerNode,
} from "./gauge";

function node(role: MindMapNode["data"]["role"], id = role): MindMapNode {
  return {
    id: `${id}-${Math.random()}`,
    data: { label: id, role },
    position: { x: 0, y: 0 },
  };
}

describe("recoveryPerNode", () => {
  it("level1は1ノードでAI2回分回復する", () => {
    expect(recoveryPerNode("level1")).toBe(CREDITS_PER_TURN * 2);
  });
  it("level2は1ノードでAI1回分回復する", () => {
    expect(recoveryPerNode("level2")).toBe(CREDITS_PER_TURN);
  });
  it("level3は3ノードでAI1回分＝1ノードで1/3回復する", () => {
    expect(recoveryPerNode("level3")).toBeCloseTo(CREDITS_PER_TURN / 3);
  });
  it("offは回復しない", () => {
    expect(recoveryPerNode("off")).toBe(0);
  });
});

describe("effectiveLevel", () => {
  it("未設定なら既定レベルを返す", () => {
    expect(effectiveLevel(undefined)).toBe(DEFAULT_ASSIST_LEVEL);
  });
  it("設定済みならそのまま返す", () => {
    expect(effectiveLevel("level3")).toBe("level3");
  });
});

describe("countUserNodes / countAINodes", () => {
  it("役割ごとに正しくカウントする", () => {
    const nodes = [node("root"), node("user"), node("user"), node("ai")];
    expect(countUserNodes(nodes)).toBe(2);
    expect(countAINodes(nodes)).toBe(1);
  });
  it("空配列は0", () => {
    expect(countUserNodes([])).toBe(0);
    expect(countAINodes([])).toBe(0);
  });
});

describe("isUnlocked", () => {
  it("閾値未満はロックされたまま", () => {
    expect(isUnlocked(UNLOCK_THRESHOLD - 1)).toBe(false);
  });
  it("閾値ちょうどで解禁される", () => {
    expect(isUnlocked(UNLOCK_THRESHOLD)).toBe(true);
  });
  it("閾値超過も解禁される", () => {
    expect(isUnlocked(UNLOCK_THRESHOLD + 10)).toBe(true);
  });
});

describe("bulkPenalty / bulkPenaltyNodes", () => {
  it("採用数×レベル回復量×倍率で消費クレジットを計算する", () => {
    expect(bulkPenalty("level2", 2)).toBe(
      BULK_PENALTY_MULT * recoveryPerNode("level2") * 2,
    );
  });
  it("offレベルはペナルティも0", () => {
    expect(bulkPenalty("off", 5)).toBe(0);
  });
  it("必要ノード数は採用数の3倍", () => {
    expect(bulkPenaltyNodes(2)).toBe(BULK_PENALTY_MULT * 2);
  });
});

describe("aiUsageRatio", () => {
  it("ノードが無ければ0", () => {
    expect(aiUsageRatio([])).toBe(0);
  });
  it("root以外の人間/AI比率で計算する", () => {
    const nodes = [node("root"), node("user"), node("ai"), node("ai")];
    expect(aiUsageRatio(nodes)).toBeCloseTo(2 / 3);
  });
  it("全て自力なら0", () => {
    const nodes = [node("root"), node("user"), node("user")];
    expect(aiUsageRatio(nodes)).toBe(0);
  });
});

describe("helperEligible", () => {
  // total は root を含むノード総数（helperEligible の判定基準）。
  // aiRatio は root を除いた user/ai 内での比率（aiUsageRatio の定義に合わせる）
  function nodesWithRatio(total: number, aiRatio: number): MindMapNode[] {
    const nonRoot = total - 1;
    const aiCount = Math.floor(nonRoot * aiRatio);
    const out: MindMapNode[] = [node("root")];
    for (let i = 0; i < aiCount; i++) out.push(node("ai"));
    for (let i = 0; i < nonRoot - aiCount; i++) out.push(node("user"));
    return out;
  }

  it("ノード数が閾値未満なら不成立", () => {
    const nodes = nodesWithRatio(HELPER_MIN_NODES - 1, 0.3);
    expect(helperEligible(nodes)).toBe(false);
  });
  it("AI比率が上限を超えると不成立", () => {
    const nodes = nodesWithRatio(HELPER_MIN_NODES, 0.9);
    expect(helperEligible(nodes)).toBe(false);
  });
  it("ノード数十分・AI比率が上限以下なら成立", () => {
    const nodes = nodesWithRatio(HELPER_MIN_NODES, HELPER_MAX_AI_RATIO);
    expect(helperEligible(nodes)).toBe(true);
  });
});

describe("creditsToTurns", () => {
  it("端数は切り捨てる", () => {
    expect(creditsToTurns(CREDITS_PER_TURN * 2 + 1)).toBe(2);
  });
  it("負のクレジットは0扱い", () => {
    expect(creditsToTurns(-CREDITS_PER_TURN)).toBe(0);
  });
  it("初期付与はちょうど1ターン", () => {
    expect(creditsToTurns(INITIAL_GRANT)).toBe(1);
  });
});

describe("nodesUntilNextTurn", () => {
  it("既に足りていれば0", () => {
    expect(nodesUntilNextTurn(AI_REQUEST_COST, "level2")).toBe(0);
  });
  it("offレベルは回復しないので0（詰み状態）", () => {
    expect(nodesUntilNextTurn(0, "off")).toBe(0);
  });
  it("不足分を回復量で割って切り上げる", () => {
    // level2: 1ノード=3クレジット回復。0クレジットから3必要 → 1ノード
    expect(nodesUntilNextTurn(0, "level2")).toBe(1);
  });
  it("level3は1ノード=1クレジットなので必要ノード数が多い", () => {
    // 3クレジット不足、1ノード=1クレジット回復 → 3ノード
    expect(nodesUntilNextTurn(0, "level3")).toBe(3);
  });
});
