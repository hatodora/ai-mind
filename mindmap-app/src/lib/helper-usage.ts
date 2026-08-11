/**
 * お助け機能（NF-04改）を使い切ったかの記録。
 *
 * 仕様は「1マップにつき無料1回」。マップ本体に持たせると Firestore の
 * ルール（キーの許可リスト）とスキーマを触ることになるため、
 * 判定に必要なのは端末側だけの情報と割り切ってブラウザに置く。
 *
 * 記録が消えた場合に起きるのは「もう1回だけ無料で使える」ことなので、
 * 消えても壊れない。逆に無制限に使われることは防げる。
 */

const KEY = "mindmap-app:helperUsed";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function hasUsedHelper(mapId: string): boolean {
  return read().includes(mapId);
}

export function markHelperUsed(mapId: string): void {
  if (typeof window === "undefined") return;
  const used = read();
  if (used.includes(mapId)) return;
  try {
    // 際限なく増やさない。古いものから捨てる
    localStorage.setItem(KEY, JSON.stringify([...used, mapId].slice(-500)));
  } catch {
    // 保存できない環境（プライベートモード等）では制限が効かないだけ
  }
}
