/**
 * オリジナルキャラクター「シコウ」の SVG（CHR-01）。
 *
 * 手描きの原画（四角い頭・大きな目・ほほの3本線・胴体のバッテリー表示）を
 * 線画のまま起こしてある。画像ではなく SVG なのは、まばたき・手を振るといった
 * 部位単位の動きを付けるため。
 *
 * 塗りは --mascot-fill（既定 --page）。腕や小物が体に重なっても
 * 線が透けないよう、背景と同じ色で塗りつぶしている。
 * 背景が違う場所（キャンバス上など）に置くときは、
 * 親側で --mascot-fill を上書きすること。
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

/** 目の中心 */
const EYE_L = { cx: 45, cy: 38 };
const EYE_R = { cx: 79, cy: 38 };

/** 閉じた目（ゆるい弧） */
function closedEye({ cx, cy }: { cx: number; cy: number }) {
  return `M ${cx - 12} ${cy - 2} Q ${cx} ${cy + 10} ${cx + 12} ${cy - 2}`;
}

/** 腕はポーズごとに差し替える。肩から手先までの折れ線 */
const ARMS: Record<MascotPose, { left: string; right: string }> = {
  sit: {
    left: "M 32 88 L 12 97 L 8 118",
    right: "M 90 88 L 110 97 L 114 118",
  },
  sleep: {
    left: "M 32 90 L 14 102 L 16 120",
    right: "M 90 90 L 108 102 L 106 120",
  },
  // 以下は体の前で手を合わせる／物を持つ形。
  // 外へ張り出してから折り返すと矢印のように見えてしまうので、
  // いったん真下へ下ろしてから内側へ曲げる
  meditate: {
    left: "M 32 88 L 30 108 L 56 118",
    right: "M 90 88 L 92 108 L 66 118",
  },
  read: {
    left: "M 32 88 L 28 104 L 40 112",
    right: "M 90 88 L 94 104 L 82 112",
  },
  work: {
    left: "M 32 88 L 28 106 L 44 116",
    right: "M 90 88 L 94 106 L 78 116",
  },
  // 振る方の腕（左）は肩を軸に回すので、ここでは上げた状態だけ持つ
  // 上げた腕は頭（x18〜102・y16〜74）に重ならないよう、外へ逃がしてから上げる
  wave: {
    left: "M 32 88 L 20 76 L 10 56",
    right: "M 90 88 L 110 97 L 114 118",
  },
  annoyed: {
    left: "M 32 88 L 18 78 L 8 60",
    right: "M 90 88 L 104 78 L 114 60",
  },
};

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

  return (
    <svg
      viewBox="0 0 120 164"
      className={`mascot ${className}`}
      role="img"
      aria-label={POSE_LABEL[pose]}
      fill="none"
      stroke="currentColor"
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 呼吸。全体をゆっくり上下させて生き物らしさを出す */}
      <g className={pose === "sleep" ? "mascot-snore" : "mascot-breathe"}>
        {/* --- 胴体と脚（1本の輪郭。原画と同じく脚のあいだが空く） --- */}
        <path
          d="M 30 78 L 92 78 L 92 150 L 74 150 L 74 126 L 48 126 L 48 150 L 30 150 Z"
          fill="var(--mascot-fill, var(--page))"
        />

        {/* バッテリー残量。原画の「60%」 */}
        {showBattery && (
          <text
            x="61"
            y="108"
            textAnchor="middle"
            className="mascot-battery"
            stroke="none"
            fill="currentColor"
            fontSize="22"
          >
            60%
          </text>
        )}

        {/* --- 小物。胸の前に置く（脚のあいだに掛かると形が読み取れない） --- */}
        {pose === "read" && (
          // 本。小さく表示しても読み取れるよう、見開きの傾きは付けずに
          // 「四角＋真ん中の綴じ目」で表す
          <g fill="var(--mascot-fill, var(--page))">
            <rect x="38" y="96" width="48" height="22" rx="2" />
            <path d="M 62 96 L 62 118" />
          </g>
        )}
        {pose === "work" && (
          <g className="mascot-laptop" fill="var(--mascot-fill, var(--page))">
            {/* 画面 */}
            <path d="M 44 84 L 82 84 L 86 110 L 40 110 Z" />
            {/* 天板 */}
            <path d="M 36 110 L 90 110 L 94 121 L 32 121 Z" />
          </g>
        )}

        {/* --- 腕。体・小物より前に描く。
            後ろに置くと、体を塗りつぶしている分だけ
            «前で手を組む» ポーズの腕が丸ごと隠れてしまう --- */}
        {pose === "wave" ? (
          // 振る腕だけ肩（32,88）を軸に回す
          <path
            d={ARMS.wave.left}
            className="mascot-wave-arm"
            style={{ transformOrigin: "32px 88px" }}
          />
        ) : (
          <path d={ARMS[pose].left} />
        )}
        <path d={ARMS[pose].right} />

        {/* --- 頭 --- */}
        {/* アンテナ */}
        <path d="M 39 18 C 37 9 31 6 29 11" />
        <path d="M 81 18 C 83 9 89 6 91 11" />
        <rect
          x="18"
          y="16"
          width="84"
          height="58"
          rx="3"
          fill="var(--mascot-fill, var(--page))"
        />

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
              fill="currentColor"
              stroke="none"
            />
            <circle
              cx={EYE_R.cx}
              cy={EYE_R.cy}
              r="5"
              fill="currentColor"
              stroke="none"
            />
          </g>
        )}

        {/* ほほの3本線（原画の特徴） */}
        <g strokeWidth="3">
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
          <path d="M 52 63 Q 57 57 62 63 Q 67 69 72 63" strokeWidth="3.5" />
        ) : (
          <>
            <path d="M 51 59 Q 62 69 72 61" />
            <path d="M 72 61 L 73 51" />
          </>
        )}

        {/* 寝息 */}
        {pose === "sleep" && (
          <g stroke="none" fill="currentColor">
            <text x="100" y="30" fontSize="16" className="mascot-zzz">
              z
            </text>
            <text
              x="104"
              y="16"
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
