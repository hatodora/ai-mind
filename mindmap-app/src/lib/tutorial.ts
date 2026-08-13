/**
 * チュートリアルモード（TUT-01）。
 *
 * 初めて使う人向けの操作マニュアルをミッション形式にしたもの。
 * 6つ全部を達成すると完走バッジがもらえる。
 * 2回目以降のクリアでは初回の記録（clearedAt）を上書きしない。
 *
 * 進行状況は端末（localStorage）に持つ。未ログインでも遊べるようにするためで、
 * ログイン済みの人はクリア時にプロフィールへも記録され、
 * 別の端末でもバッジが残る（TUT-03）。
 */

export type MissionId =
  | "open_new"
  | "set_theme"
  | "add_nodes"
  | "ask_ai"
  | "review"
  | "complete";

export interface Mission {
  id: MissionId;
  /** ミッション名（バーの一覧に出す短い文言） */
  title: string;
  /** いま何をすればいいか。進行中のミッションだけ出す */
  hint: string;
}

/** ノードのミッションで必要な数。AIが解禁される数（UNLOCK_THRESHOLD）と同じ */
export const TUTORIAL_NODE_GOAL = 5;

/** 達成する順に並べる。バーの表示順もこの順 */
export const MISSIONS: readonly Mission[] = [
  {
    id: "open_new",
    title: "新しいマップを作成する",
    hint: "「新しいマップを作る」を押してみよう",
  },
  {
    id: "set_theme",
    title: "自分でテーマを決める",
    hint: "考えたいことを入力して、マインドマップを始めよう",
  },
  {
    id: "add_nodes",
    title: `ノードを${TUTORIAL_NODE_GOAL}個広げる`,
    hint: `思いついた言葉を${TUTORIAL_NODE_GOAL}個ぶら下げてみよう。AIはそのあと解禁される`,
  },
  {
    id: "ask_ai",
    title: "AIにアドバイスを聞く",
    hint: "行き詰まったら「AI にアイデアを聞く」を押してみよう",
  },
  {
    id: "review",
    title: "結論を出す",
    hint: "「AI に全体をレビューしてもらう」で、考えをまとめてもらおう",
  },
  {
    id: "complete",
    title: "マップを完成させる",
    hint: "レビューを読んだら「マップを一時的に保存する」で完成にしよう",
  },
] as const;

export interface TutorialState {
  /** 進行中か。ページを再読み込みしても続くよう保存する */
  active: boolean;
  /** 達成済みミッション */
  done: MissionId[];
  /** 一度でも自動起動したか。初回起動の判定に使う */
  seen: boolean;
  /** 初めて全達成した日時。2回目以降のクリアでは書き換えない */
  clearedAt: number | null;
}

export function defaultTutorial(): TutorialState {
  return { active: false, done: [], seen: false, clearedAt: null };
}

export function isAllDone(done: readonly MissionId[]): boolean {
  return MISSIONS.every((m) => done.includes(m.id));
}

/** まだ達成していない最初のミッション。全部済んでいれば null */
export function nextMission(done: readonly MissionId[]): Mission | null {
  return MISSIONS.find((m) => !done.includes(m.id)) ?? null;
}

/**
 * ミッションを達成として記録した次の状態を返す。
 * すでに達成済み、または進行中でないときは元の状態をそのまま返す
 * （チュートリアル外の操作で勝手に進まないようにする）。
 */
export function withMissionDone(
  state: TutorialState,
  id: MissionId,
): TutorialState {
  if (!state.active || state.done.includes(id)) return state;
  const done = [...state.done, id];
  const cleared = isAllDone(done);
  return {
    ...state,
    done,
    // 全達成したら進行を終える
    active: !cleared,
    // 初回クリアの日時だけを残す（2回目以降は上書きしない）
    clearedAt: cleared ? (state.clearedAt ?? Date.now()) : state.clearedAt,
  };
}

// ---------- 端末への保存 ----------

const KEY = "mindmap-app:tutorial";

export function loadTutorial(): TutorialState {
  if (typeof window === "undefined") return defaultTutorial();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultTutorial();
    const parsed = JSON.parse(raw) as Partial<TutorialState>;
    const known = new Set<string>(MISSIONS.map((m) => m.id));
    return {
      active: parsed.active === true,
      // 知らない id が混ざっていても落とす（仕様変更をまたいでも壊れない）
      done: Array.isArray(parsed.done)
        ? (parsed.done.filter((d) => known.has(d as string)) as MissionId[])
        : [],
      seen: parsed.seen === true,
      clearedAt:
        typeof parsed.clearedAt === "number" ? parsed.clearedAt : null,
    };
  } catch {
    return defaultTutorial();
  }
}

export function saveTutorial(state: TutorialState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 保存できない環境では、その場かぎりの進行になるだけ
  }
}
