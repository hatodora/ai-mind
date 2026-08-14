/**
 * オリジナルキャラクター「シコウ」の SVG（CHR-01）。
 *
 * 手描きの原画（四角い頭・大きな目・ほほの3本線・胴体のバッテリー表示）を
 * 線画のまま起こしてある。画像ではなく SVG なのは、まばたきや手を振るといった
 * 部位単位の動きを付けるため。
 *
 * 色は「白い紙にモスグリーンのペンで描いた」見立て。
 * 暗い背景に置いても原画の可愛さが残るよう、体は紙色で塗りつぶし、
 * 線だけを濃いモスにしている（globals.css の --mascot-paper / --mascot-ink）。
 *
 * 腕は 1本の線ではなく、原画と同じく太さのある輪郭として描く。
 * 関節の座標から輪郭を計算しているので（limbPath）、
 * ポーズを増やしても線の太さや手の形が揃う。
 */

/** 常時ポーズ5種 ＋ タップ反応2種 */
export type MascotPose =
  | "sit" // まばたきをしながら座る（既定）
  | "meditate" // 目を閉じて瞑想する
  | "read" // 本を読む
  | "work" // PCで作業をする
  | "wave" // ユーザーに向けて手を振る
  | "annoyed" // 何度もタップされて嫌がる
  | "sleep"; // しばらく放置されて寝る

/** ポーズごとの読み上げ用の説明。装飾ではなく状態を伝える */
const POSE_LABEL: Record<MascotPose, string> = {
  sit: "座っているキャラクター",
  meditate: "瞑想しているキャラクター",
  read: "本を読んでいるキャラクター",
  work: "パソコンで作業しているキャラクター",
  wave: "手を振っているキャラクター",
  annoyed: "少し困っているキャラクター",
  sleep: "眠っているキャラクター",
};

// ---------- 腕の輪郭を関節から組み立てる ----------

interface Pt {
  x: number;
  y: number;
}

/** 腕の太さ（半分）。原画では胴の幅の1〜2割ほどしかない */
const ARM_HALF = 5.5;
/** 手先の太さ（半分）。原画のミトンのような手を出すため少し広げる */
const HAND_HALF = 7;

/** 線分 a→b の左向き単位法線 */
function leftNormal(a: Pt, b: Pt): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

/** 2直線（a1→b1 と a2→b2）の交点。平行なら null */
function intersect(a1: Pt, b1: Pt, a2: Pt, b2: Pt): Pt | null {
  const d1x = b1.x - a1.x;
  const d1y = b1.y - a1.y;
  const d2x = b2.x - a2.x;
  const d2y = b2.y - a2.y;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-6) return null;
  const t = ((a2.x - a1.x) * d2y - (a2.y - a1.y) * d2x) / den;
  return { x: a1.x + d1x * t, y: a1.y + d1y * t };
}

/**
 * 関節の並びを片側へ half だけ寄せた折れ線に変換する。
 * 曲がり角は「ずらした2直線の交点」にするので、
 * 内側・外側どちらの線もきれいにつながる（肘が痩せない）。
 */
function offsetSide(pts: Pt[], half: number, handHalf: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) {
      const n = leftNormal(pts[0], pts[1]);
      out.push({ x: pts[0].x + n.x * half, y: pts[0].y + n.y * half });
    } else if (i === pts.length - 1) {
      const n = leftNormal(pts[i - 1], pts[i]);
      out.push({ x: pts[i].x + n.x * handHalf, y: pts[i].y + n.y * handHalf });
    } else {
      const n1 = leftNormal(pts[i - 1], pts[i]);
      const n2 = leftNormal(pts[i], pts[i + 1]);
      const shift = (p: Pt, n: Pt) => ({
        x: p.x + n.x * half,
        y: p.y + n.y * half,
      });
      out.push(
        intersect(
          shift(pts[i - 1], n1),
          shift(pts[i], n1),
          shift(pts[i], n2),
          shift(pts[i + 1], n2),
        ) ?? shift(pts[i], n1),
      );
    }
  }
  return out;
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * 関節の並びから腕の輪郭パスを作る。
 *
 * 肩側はあえて閉じない（Z を付けない）。
 * 塗りは自動で閉じられるので体と地続きに見えるが、
 * 線は引かれないので肩に不自然な切れ目が出ない。
 */
function limbPath(joints: Pt[]): string {
  const a = offsetSide(joints, ARM_HALF, HAND_HALF);
  const b = offsetSide(joints, -ARM_HALF, -HAND_HALF);
  const fwd = a
    .map((p, i) => `${i === 0 ? "M" : "L"} ${round(p.x)} ${round(p.y)}`)
    .join(" ");
  const back = [...b]
    .reverse()
    .map((p) => `L ${round(p.x)} ${round(p.y)}`)
    .join(" ");
  return `${fwd} ${back}`;
}

/**
 * 肩から手先までの関節。左右それぞれのポーズ分。
 *
 * 原画にならって、肩は胴の上の角（30,78 / 92,78）付近から生やす。
 * 物を持つポーズ以外は胴の内側（x40〜82）を通らないようにしてあり、
 * バッテリー表示に腕が被らない。
 */
const ARM_JOINTS: Record<MascotPose, { left: Pt[]; right: Pt[] }> = {
  sit: {
    left: [
      { x: 30, y: 92 },
      { x: 15, y: 97 },
      { x: 13, y: 118 },
    ],
    right: [
      { x: 92, y: 92 },
      { x: 107, y: 97 },
      { x: 109, y: 118 },
    ],
  },
  sleep: {
    left: [
      { x: 30, y: 94 },
      { x: 17, y: 100 },
      { x: 20, y: 118 },
    ],
    right: [
      { x: 92, y: 94 },
      { x: 105, y: 100 },
      { x: 102, y: 118 },
    ],
  },
  // 上げた腕は頭（x18〜102・y16〜74）に重ならないよう外へ逃がしてから上げる
  wave: {
    left: [
      { x: 30, y: 88 },
      { x: 16, y: 76 },
      { x: 6, y: 52 },
    ],
    right: [
      { x: 92, y: 92 },
      { x: 107, y: 97 },
      { x: 109, y: 118 },
    ],
  },
  annoyed: {
    left: [
      { x: 30, y: 88 },
      { x: 15, y: 76 },
      { x: 3, y: 56 },
    ],
    right: [
      { x: 92, y: 88 },
      { x: 107, y: 76 },
      { x: 119, y: 56 },
    ],
  },
  // 体の前で手を合わせる／物を持つ形。
  // 胴の外をいったん下ろしてから、内側へ折り返す
  meditate: {
    left: [
      { x: 30, y: 94 },
      { x: 22, y: 112 },
      { x: 54, y: 122 },
    ],
    right: [
      { x: 92, y: 94 },
      { x: 100, y: 112 },
      { x: 68, y: 122 },
    ],
  },
  read: {
    left: [
      { x: 30, y: 94 },
      { x: 22, y: 106 },
      { x: 44, y: 110 },
    ],
    right: [
      { x: 92, y: 94 },
      { x: 100, y: 106 },
      { x: 78, y: 110 },
    ],
  },
  work: {
    left: [
      { x: 30, y: 94 },
      { x: 22, y: 108 },
      { x: 46, y: 114 },
    ],
    right: [
      { x: 92, y: 94 },
      { x: 100, y: 108 },
      { x: 76, y: 114 },
    ],
  },
};

/** 輪郭は毎回計算しなくてよいので、読み込み時に1回だけ作っておく */
const ARMS: Record<MascotPose, { left: string; right: string }> =
  Object.fromEntries(
    Object.entries(ARM_JOINTS).map(([pose, { left, right }]) => [
      pose,
      { left: limbPath(left), right: limbPath(right) },
    ]),
  ) as Record<MascotPose, { left: string; right: string }>;

// ---------- 顔まわり ----------

/** 目の中心 */
const EYE_L = { cx: 45, cy: 38 };
const EYE_R = { cx: 79, cy: 38 };

/** 閉じた目（ゆるい弧） */
function closedEye({ cx, cy }: { cx: number; cy: number }) {
  return `M ${cx - 12} ${cy - 2} Q ${cx} ${cy + 10} ${cx + 12} ${cy - 2}`;
}

/** アンテナ。体の外に出るので、暗い背景でも見えるよう紙色を敷いてから描く */
const ANTENNA_L = "M 39 18 C 37 9 31 6 29 11";
const ANTENNA_R = "M 81 18 C 83 9 89 6 91 11";

export function Mascot({
  pose = "sit",
  className = "",
}: {
  pose?: MascotPose;
  className?: string;
}) {
  const eyesClosed = pose === "meditate" || pose === "sleep";
  const annoyed = pose === "annoyed";
  // 小物を持つポーズでは、バッテリー表示が隠れるので出さない
  const showBattery = pose !== "read" && pose !== "work";
  const paper = "var(--mascot-paper)";

  return (
    <svg
      // 上げた腕がはみ出せるよう、左右に余白を持たせてある
      viewBox="-10 0 140 164"
      className={`mascot ${className}`}
      role="img"
      aria-label={POSE_LABEL[pose]}
      fill="none"
      stroke="var(--mascot-ink)"
      strokeWidth={3.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 呼吸。全体をゆっくり上下させて生き物らしさを出す */}
      <g className={pose === "sleep" ? "mascot-snore" : "mascot-breathe"}>
        {/* --- 胴体と脚（1本の輪郭。原画と同じく脚のあいだが空く） --- */}
        <path
          d="M 30 78 L 92 78 L 92 150 L 74 150 L 74 126 L 48 126 L 48 150 L 30 150 Z"
          fill={paper}
        />

        {/* バッテリー残量。原画の「60%」 */}
        {showBattery && (
          <text
            x="61"
            y="104"
            textAnchor="middle"
            className="mascot-battery"
            stroke="none"
            fill="var(--mascot-ink)"
            fontSize="22"
          >
            60%
          </text>
        )}

        {/* --- 小物。胸の前に置く（脚のあいだに掛かると形が読み取れない） --- */}
        {pose === "read" && (
          // 本。小さく表示しても読み取れるよう、見開きの傾きは付けずに
          // 「四角＋真ん中の綴じ目」で表す
          <g fill={paper}>
            <rect x="43" y="98" width="36" height="18" rx="2" />
            <path d="M 61 98 L 61 116" />
          </g>
        )}
        {pose === "work" && (
          <g className="mascot-laptop" fill={paper}>
            {/* 画面 */}
            <path d="M 48 86 L 76 86 L 79 106 L 45 106 Z" />
            {/* 天板 */}
            <path d="M 42 106 L 82 106 L 85 116 L 39 116 Z" />
          </g>
        )}

        {/* --- 腕。体・小物より前に描く。
            後ろに置くと、体を塗りつぶしている分だけ
            «前で手を組む» ポーズの腕が丸ごと隠れてしまう --- */}
        {pose === "wave" ? (
          // 振る腕だけ肩（30,88）を軸に回す
          <path
            d={ARMS.wave.left}
            fill={paper}
            className="mascot-wave-arm"
            style={{ transformOrigin: "30px 88px" }}
          />
        ) : (
          <path d={ARMS[pose].left} fill={paper} />
        )}
        <path d={ARMS[pose].right} fill={paper} />

        {/* --- 頭 --- */}
        {/* アンテナ。紙色を下に敷いてから線を重ねる */}
        <path d={ANTENNA_L} stroke={paper} strokeWidth={6} />
        <path d={ANTENNA_R} stroke={paper} strokeWidth={6} />
        <path d={ANTENNA_L} />
        <path d={ANTENNA_R} />
        <rect x="18" y="16" width="84" height="58" rx="3" fill={paper} />

        {/* 目 */}
        {eyesClosed ? (
          <>
            <path d={closedEye(EYE_L)} />
            <path d={closedEye(EYE_R)} />
          </>
        ) : annoyed ? (
          <>
            {/* >_< の困り顔 */}
            <path
              d={`M ${EYE_L.cx - 10} ${EYE_L.cy - 9} L ${EYE_L.cx + 7} ${EYE_L.cy} L ${EYE_L.cx - 10} ${EYE_L.cy + 9}`}
            />
            <path
              d={`M ${EYE_R.cx + 10} ${EYE_R.cy - 9} L ${EYE_R.cx - 7} ${EYE_R.cy} L ${EYE_R.cx + 10} ${EYE_R.cy + 9}`}
            />
          </>
        ) : (
          <g className="mascot-eyes">
            <ellipse cx={EYE_L.cx} cy={EYE_L.cy} rx="13" ry="15" />
            <ellipse cx={EYE_R.cx} cy={EYE_R.cy} rx="13" ry="15" />
            <circle
              cx={EYE_L.cx}
              cy={EYE_L.cy}
              r="5"
              fill="var(--mascot-ink)"
              stroke="none"
            />
            <circle
              cx={EYE_R.cx}
              cy={EYE_R.cy}
              r="5"
              fill="var(--mascot-ink)"
              stroke="none"
            />
          </g>
        )}

        {/* ほほの3本線（原画の特徴） */}
        <g strokeWidth="2.6">
          <path d="M 25 53 L 26 60" />
          <path d="M 30 52 L 31 60" />
          <path d="M 35 53 L 36 60" />
          <path d="M 87 53 L 88 60" />
          <path d="M 92 52 L 93 60" />
          <path d="M 97 53 L 98 60" />
        </g>

        {/* 口 */}
        {pose === "sleep" ? (
          <ellipse cx="62" cy="62" rx="6" ry="5" />
        ) : annoyed ? (
          <path d="M 52 63 Q 57 57 62 63 Q 67 69 72 63" strokeWidth="3" />
        ) : (
          <>
            <path d="M 51 59 Q 62 69 72 61" />
            <path d="M 72 61 L 73 51" />
          </>
        )}

        {/* 寝息。体の外に出るので、こちらも紙色を下に敷く */}
        {pose === "sleep" && (
          <g
            fill="var(--mascot-ink)"
            stroke={paper}
            strokeWidth="3"
            paintOrder="stroke"
          >
            <text x="99" y="36" fontSize="16" className="mascot-zzz">
              z
            </text>
            <text
              x="104"
              y="20"
              fontSize="12"
              className="mascot-zzz"
              style={{ animationDelay: "1.1s" }}
            >
              z
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}
