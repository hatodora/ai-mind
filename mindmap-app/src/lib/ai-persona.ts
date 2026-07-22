import type { AgeBand, AIPersonality } from "@/types";

/**
 * 年齢帯（UP-06）とAIパーソナリティ（UP-04）の共通ロジック。
 * - クライアント: プロフィールから帯と人格を導出して AI 呼び出しに添える
 * - サーバー（Next.js API Routes）: 受け取った値を検証しプロンプトに織り込む
 * Cloud Functions 側は別パッケージのため functions/src/index.ts に同じ定義を持つ。
 */

export const DEFAULT_AGE_BAND: AgeBand = "worker";
export const DEFAULT_PERSONALITY: AIPersonality = "advisor";
/** 誕生日を自分で変更できる回数の上限（SEC-01 F-1）。rules 側にも同じ値がある */
export const MAX_BIRTHDATE_EDITS = 2;
/** 誕生日として選べる最小・最大年齢（UP-06 / validUser() と同じ範囲） */
export const MIN_BIRTHDATE_AGE = 5;
export const MAX_BIRTHDATE_AGE = 120;

const AGE_BANDS: readonly AgeBand[] = [
  "essential",
  "education",
  "teenager",
  "worker",
];
const PERSONALITIES: readonly AIPersonality[] = ["advisor", "boss", "analyst"];

/** 不正値・未指定は既定へフォールバック（サーバー側の入力検証を兼ねる） */
export function asAgeBand(v: unknown): AgeBand {
  return AGE_BANDS.includes(v as AgeBand) ? (v as AgeBand) : DEFAULT_AGE_BAND;
}

export function asPersonality(v: unknown): AIPersonality {
  return PERSONALITIES.includes(v as AIPersonality)
    ? (v as AIPersonality)
    : DEFAULT_PERSONALITY;
}

/** YYYY-MM-DD の誕生日から満年齢を求める。形式不正・非実在日は null */
export function ageFromBirthDate(
  birthDate: string,
  now: Date = new Date(),
): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const b = new Date(y, mo - 1, d);
  if (b.getFullYear() !== y || b.getMonth() !== mo - 1 || b.getDate() !== d) {
    return null;
  }
  let age = now.getFullYear() - y;
  const birthdayPassed =
    now.getMonth() > mo - 1 ||
    (now.getMonth() === mo - 1 && now.getDate() >= d);
  if (!birthdayPassed) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}

/** 5-10: essential / 11-14: education / 15-17: teenager / 18+: worker */
export function ageBandFromAge(age: number): AgeBand {
  if (age <= 10) return "essential";
  if (age <= 14) return "education";
  if (age <= 17) return "teenager";
  return "worker";
}

/** プロフィールから年齢帯を導出。誕生日優先・なければ age・どちらも無ければ既定 */
export function ageBandFromProfile(
  profile: { birthDate?: string; age?: number } | null | undefined,
): AgeBand {
  if (!profile) return DEFAULT_AGE_BAND;
  if (profile.birthDate) {
    const age = ageFromBirthDate(profile.birthDate);
    if (age !== null) return ageBandFromAge(age);
  }
  if (typeof profile.age === "number") return ageBandFromAge(profile.age);
  return DEFAULT_AGE_BAND;
}

// ---------- プロンプト素材 ----------

/** 年齢帯ごとの語り方ガイド（UP-06）。AIの回答全要素に適用する */
export const AGE_GUIDES: Record<AgeBand, string> = {
  essential:
    "読み手は5〜10歳の子どもです。学校・家族・遊び・動物など身近なものにたとえ、この年代の子が知っている言葉だけで話してください。難しい言い回しは避け、短い文とやさしい問いかけを交えてください。",
  education:
    "読み手は11〜14歳です。日本の義務教育で学ぶ内容を土台に説明し、少し難しい語句も意味が伝わる形でときどき使って、語彙を広げる手助けをしてください。",
  teenager:
    "読み手は15〜17歳です。大人と自然に話せる語彙で、事実を包み隠さず正確に伝えてください。過度な子ども扱いや遠回しなぼかしは不要です。",
  worker:
    "読み手は18歳以上の大人です。回りくどい配慮より、明快で実用的な表現を優先してください。専門的な内容もそのまま扱って構いません。",
};

/** パーソナリティごとの人格ガイド（UP-04）。explain / review で全面適用 */
export const PERSONA_GUIDES: Record<AIPersonality, string> = {
  advisor:
    "あなたの人格は「アドバイザー」。基本はユーザーの考えを認めて伸ばしつつ、気になる点があれば遠慮なく指摘します。励ましと指摘のバランスを取ってください。",
  boss: "あなたの人格は「ボス」。安易に答えを与えず、まず「本当にそうか？」「なぜそう思う？」と問いを突き返し、ユーザー自身に考えさせます。ただし突き放しすぎず、考える手がかりは残してください。",
  analyst:
    "あなたの人格は「アナリスト」。感情を挟まない冷徹なコンサルタントとして、論理と事実で端的に答えます。あえて逆の立場や反対意見も提示してください。慰めより正確さを優先します。",
};

/** suggest 用の軽い言葉選びヒント（現行の出力品質は維持しつつ人格を少しだけ） */
export const PERSONA_HINTS: Record<AIPersonality, string> = {
  advisor: "前向きに背中を押すような言葉選びを少しだけ意識する",
  boss: "ユーザーに問いを投げ返すような言葉選びを少しだけ意識する",
  analyst: "別の角度・逆の視点を突くような言葉選びを少しだけ意識する",
};

/** explain / review のプロンプト末尾に付ける共通ブロック */
export function personaAgeBlock(
  personality: AIPersonality,
  ageBand: AgeBand,
): string {
  return `${PERSONA_GUIDES[personality]}\n${AGE_GUIDES[ageBand]}`;
}
