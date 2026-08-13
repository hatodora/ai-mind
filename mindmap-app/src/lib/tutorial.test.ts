import { describe, expect, it } from "vitest";
import {
  MISSIONS,
  type MissionId,
  type TutorialState,
  defaultTutorial,
  isAllDone,
  nextMission,
  withMissionDone,
} from "./tutorial";

/**
 * チュートリアル進行の規則（TUT-01）。
 * 特に「2回目以降のクリアではバッジ（初回クリア日時）を上書きしない」を守る。
 */

const ALL: MissionId[] = MISSIONS.map((m) => m.id);

function running(done: MissionId[] = []): TutorialState {
  return { ...defaultTutorial(), active: true, done };
}

/** 与えた順にミッションを達成させる */
function runAll(from: TutorialState, ids: MissionId[] = ALL): TutorialState {
  return ids.reduce((s, id) => withMissionDone(s, id), from);
}

describe("withMissionDone", () => {
  it("進行中なら達成が記録される", () => {
    const s = withMissionDone(running(), "open_new");
    expect(s.done).toEqual(["open_new"]);
    expect(s.active).toBe(true);
  });

  it("進行中でなければ何も起きない（通常利用で勝手に進まない）", () => {
    const idle = defaultTutorial();
    expect(withMissionDone(idle, "open_new")).toBe(idle);
  });

  it("同じミッションを2回達成しても増えない", () => {
    const once = withMissionDone(running(), "ask_ai");
    expect(withMissionDone(once, "ask_ai")).toBe(once);
  });

  it("全達成すると進行が終わり、クリア日時が入る", () => {
    const s = runAll(running());
    expect(isAllDone(s.done)).toBe(true);
    expect(s.active).toBe(false);
    expect(s.clearedAt).toBeTypeOf("number");
  });

  it("2回目のクリアでは初回のクリア日時を上書きしない", () => {
    const first = runAll(running());
    const firstClearedAt = first.clearedAt;
    expect(firstClearedAt).not.toBeNull();

    // もう一度やり直して完走する
    const second = runAll({ ...first, active: true, done: [] });

    expect(second.clearedAt).toBe(firstClearedAt);
  });

  it("達成の順番が前後しても完走できる", () => {
    const shuffled: MissionId[] = [
      "complete",
      "ask_ai",
      "open_new",
      "review",
      "set_theme",
      "add_nodes",
    ];
    const s = runAll(running(), shuffled);
    expect(s.active).toBe(false);
    expect(s.clearedAt).toBeTypeOf("number");
  });

  it("最後の1つを残しているあいだはクリアにならない", () => {
    const s = runAll(running(), ALL.slice(0, -1));
    expect(s.active).toBe(true);
    expect(s.clearedAt).toBeNull();
  });
});

describe("nextMission", () => {
  it("未達成のうち先頭のものを返す", () => {
    expect(nextMission([])?.id).toBe(MISSIONS[0].id);
    expect(nextMission([MISSIONS[0].id])?.id).toBe(MISSIONS[1].id);
  });

  it("順番どおりでなくても、残っている先頭を返す", () => {
    expect(nextMission([MISSIONS[1].id])?.id).toBe(MISSIONS[0].id);
  });

  it("全部済んでいれば null", () => {
    expect(nextMission(ALL)).toBeNull();
  });
});

describe("MISSIONS", () => {
  it("id が重複していない", () => {
    expect(new Set(ALL).size).toBe(ALL.length);
  });
});
