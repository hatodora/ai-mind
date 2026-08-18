// キャラクター「シコウ」を静的 SVG に書き出す。
// 幾何は src/components/character/Mascot.tsx の写しなので、原画と形が揃う。
import { writeFileSync, mkdirSync } from "node:fs";

const OUT = "/private/tmp/claude-501/-Users-matsumotohayato-AI-------/290fe67c-34a0-4339-98ae-2a732a119a69/scratchpad/art";
mkdirSync(OUT, { recursive: true });

const PAPER = "#edefe1";
const INK = "#38412f";

const ARM_HALF = 5.5;
const HAND_HALF = 7;

const leftNormal = (a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
};
const intersect = (a1, b1, a2, b2) => {
  const d1x = b1.x - a1.x, d1y = b1.y - a1.y;
  const d2x = b2.x - a2.x, d2y = b2.y - a2.y;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-6) return null;
  const t = ((a2.x - a1.x) * d2y - (a2.y - a1.y) * d2x) / den;
  return { x: a1.x + d1x * t, y: a1.y + d1y * t };
};
function offsetSide(pts, half, handHalf) {
  const out = [];
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
      const sh = (p, n) => ({ x: p.x + n.x * half, y: p.y + n.y * half });
      out.push(
        intersect(sh(pts[i - 1], n1), sh(pts[i], n1), sh(pts[i], n2), sh(pts[i + 1], n2)) ??
          sh(pts[i], n1),
      );
    }
  }
  return out;
}
const round = (n) => Math.round(n * 10) / 10;
function limbPath(joints) {
  const a = offsetSide(joints, ARM_HALF, HAND_HALF);
  const b = offsetSide(joints, -ARM_HALF, -HAND_HALF);
  const fwd = a.map((p, i) => `${i === 0 ? "M" : "L"} ${round(p.x)} ${round(p.y)}`).join(" ");
  const back = [...b].reverse().map((p) => `L ${round(p.x)} ${round(p.y)}`).join(" ");
  return `${fwd} ${back}`;
}

const ARM_JOINTS = {
  sit: {
    left: [{ x: 30, y: 92 }, { x: 15, y: 97 }, { x: 13, y: 118 }],
    right: [{ x: 92, y: 92 }, { x: 107, y: 97 }, { x: 109, y: 118 }],
  },
  sleep: {
    left: [{ x: 30, y: 94 }, { x: 17, y: 100 }, { x: 20, y: 118 }],
    right: [{ x: 92, y: 94 }, { x: 105, y: 100 }, { x: 102, y: 118 }],
  },
  wave: {
    left: [{ x: 30, y: 88 }, { x: 16, y: 76 }, { x: 6, y: 52 }],
    right: [{ x: 92, y: 92 }, { x: 107, y: 97 }, { x: 109, y: 118 }],
  },
  annoyed: {
    left: [{ x: 30, y: 88 }, { x: 15, y: 76 }, { x: 3, y: 56 }],
    right: [{ x: 92, y: 88 }, { x: 107, y: 76 }, { x: 119, y: 56 }],
  },
  meditate: {
    left: [{ x: 30, y: 94 }, { x: 22, y: 112 }, { x: 54, y: 122 }],
    right: [{ x: 92, y: 94 }, { x: 100, y: 112 }, { x: 68, y: 122 }],
  },
  read: {
    left: [{ x: 30, y: 94 }, { x: 22, y: 106 }, { x: 44, y: 110 }],
    right: [{ x: 92, y: 94 }, { x: 100, y: 106 }, { x: 78, y: 110 }],
  },
  work: {
    left: [{ x: 30, y: 94 }, { x: 22, y: 108 }, { x: 46, y: 114 }],
    right: [{ x: 92, y: 94 }, { x: 100, y: 108 }, { x: 76, y: 114 }],
  },
};
const ARMS = Object.fromEntries(
  Object.entries(ARM_JOINTS).map(([p, { left, right }]) => [
    p, { left: limbPath(left), right: limbPath(right) },
  ]),
);

const EYE_L = { cx: 45, cy: 38 };
const EYE_R = { cx: 79, cy: 38 };
const closedEye = ({ cx, cy }) => `M ${cx - 12} ${cy - 2} Q ${cx} ${cy + 10} ${cx + 12} ${cy - 2}`;
const ANTENNA_L = "M 39 18 C 37 9 31 6 29 11";
const ANTENNA_R = "M 81 18 C 83 9 89 6 91 11";

function mascot(pose) {
  const eyesClosed = pose === "meditate" || pose === "sleep";
  const annoyed = pose === "annoyed";
  const showBattery = pose !== "read" && pose !== "work";

  const eyes = eyesClosed
    ? `<path d="${closedEye(EYE_L)}"/><path d="${closedEye(EYE_R)}"/>`
    : annoyed
      ? `<path d="M ${EYE_L.cx - 10} ${EYE_L.cy - 9} L ${EYE_L.cx + 7} ${EYE_L.cy} L ${EYE_L.cx - 10} ${EYE_L.cy + 9}"/>` +
        `<path d="M ${EYE_R.cx + 10} ${EYE_R.cy - 9} L ${EYE_R.cx - 7} ${EYE_R.cy} L ${EYE_R.cx + 10} ${EYE_R.cy + 9}"/>`
      : `<ellipse cx="${EYE_L.cx}" cy="${EYE_L.cy}" rx="13" ry="15"/>` +
        `<ellipse cx="${EYE_R.cx}" cy="${EYE_R.cy}" rx="13" ry="15"/>` +
        `<circle cx="${EYE_L.cx}" cy="${EYE_L.cy}" r="5" fill="${INK}" stroke="none"/>` +
        `<circle cx="${EYE_R.cx}" cy="${EYE_R.cy}" r="5" fill="${INK}" stroke="none"/>`;

  const mouth =
    pose === "sleep"
      ? `<ellipse cx="62" cy="62" rx="6" ry="5"/>`
      : annoyed
        ? `<path d="M 52 63 Q 57 57 62 63 Q 67 69 72 63" stroke-width="3"/>`
        : `<path d="M 51 59 Q 62 69 72 61"/><path d="M 72 61 L 73 51"/>`;

  const prop =
    pose === "read"
      ? `<g fill="${PAPER}"><rect x="43" y="98" width="36" height="18" rx="2"/><path d="M 61 98 L 61 116"/></g>`
      : pose === "work"
        ? `<g fill="${PAPER}"><path d="M 48 86 L 76 86 L 79 106 L 45 106 Z"/><path d="M 42 106 L 82 106 L 85 116 L 39 116 Z"/></g>`
        : "";

  const zzz =
    pose === "sleep"
      ? `<g fill="${INK}" stroke="${PAPER}" stroke-width="3" paint-order="stroke">
           <text x="99" y="36" font-size="16" font-family="Satoshi, Helvetica, sans-serif">z</text>
           <text x="104" y="20" font-size="12" font-family="Satoshi, Helvetica, sans-serif">z</text>
         </g>`
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 0 140 164" fill="none"
  stroke="${INK}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M 30 78 L 92 78 L 92 150 L 74 150 L 74 126 L 48 126 L 48 150 L 30 150 Z" fill="${PAPER}"/>
  ${showBattery ? `<text x="61" y="104" text-anchor="middle" stroke="none" fill="${INK}" font-size="22" font-family="Satoshi, Helvetica, sans-serif" font-weight="700">60%</text>` : ""}
  ${prop}
  <path d="${ARMS[pose].left}" fill="${PAPER}"/>
  <path d="${ARMS[pose].right}" fill="${PAPER}"/>
  <path d="${ANTENNA_L}" stroke="${PAPER}" stroke-width="6"/>
  <path d="${ANTENNA_R}" stroke="${PAPER}" stroke-width="6"/>
  <path d="${ANTENNA_L}"/>
  <path d="${ANTENNA_R}"/>
  <rect x="18" y="16" width="84" height="58" rx="3" fill="${PAPER}"/>
  ${eyes}
  <g stroke-width="2.6">
    <path d="M 25 53 L 26 60"/><path d="M 30 52 L 31 60"/><path d="M 35 53 L 36 60"/>
    <path d="M 87 53 L 88 60"/><path d="M 92 52 L 93 60"/><path d="M 97 53 L 98 60"/>
  </g>
  ${mouth}
  ${zzz}
</svg>`;
}

for (const pose of ["sit", "wave", "read", "work", "meditate", "annoyed", "sleep"]) {
  writeFileSync(`${OUT}/mascot-${pose}.svg`, mascot(pose));
  console.log("wrote mascot-" + pose + ".svg");
}
