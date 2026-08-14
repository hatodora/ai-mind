/**
 * 2要素認証 — メールの6桁コード（MFA-02）。
 *
 * Firebase Authentication の多要素認証は Identity Platform（有料）が要るうえ、
 * SMS と TOTP しか無く、メールの6桁コードは提供されていない。
 * そこでアプリ側で実装している。
 *
 * 画面を隠すだけでは意味がない。IDトークンさえあれば Firestore を直接叩けるので、
 * 実際の境界はカスタムクレームとセキュリティルールで作る。
 *
 *   mfaRequired: この利用者は2要素認証を有効にしている
 *   mfa:         最後に6桁コードを通した時刻（ミリ秒）
 *
 * ルール側は request.auth.token のこの2つだけを見る（追加の読み取りが要らない）。
 * どちらも Admin SDK でしか付けられないので、クライアントから偽装できない。
 *
 * クライアント側の同じ取り決めは src/lib/two-factor.ts にある。
 * 別ビルドなので値を二重に持っている。変えるときは両方を直すこと。
 */
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { sendMail, twoFactorMail } from "./mail";

const db = getFirestore();

/** コードの桁数 */
const CODE_LENGTH = 6;
/** 発行したコードの有効期限 */
const CODE_TTL_MS = 10 * 60 * 1000;
/** 間違えられる回数。超えたら再送してもらう */
const MAX_ATTEMPTS = 5;
/** 再送できるようになるまでの間隔 */
const RESEND_COOLDOWN_MS = 60 * 1000;
/** 1時間に発行できる回数。メール費用と嫌がらせの両方を抑える */
const HOURLY_ISSUE_LIMIT = 5;

/**
 * 設定の変更（有効化・無効化）に求める «直近の» 検証。
 *
 * 通常の利用は30日通すが、締め出しを解除できてしまう操作なので
 * ここだけは短く切る。端末を離席した隙に無効化される事故を防ぐ。
 */
const SETTINGS_FRESH_MS = 10 * 60 * 1000;

interface Challenge {
  codeHash: string;
  salt: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
  /** 1時間の窓での発行回数 */
  issuedInWindow: number;
  windowStart: number;
}

function challengeRef(uid: string) {
  return db.doc(`twoFactorChallenges/${uid}`);
}

/**
 * コードを保存できる形にする。
 *
 * 平文は残さない。scrypt を使うのは、万一この置き場ごと漏れたときに
 * 6桁（100万通り）を総当たりされるのを高くつかせるため。
 * sha256 だと一瞬で逆引きできてしまう。
 */
function hashCode(code: string, salt: string): string {
  return scryptSync(code, salt, 32).toString("hex");
}

/** 桁数を揃えた6桁。randomInt は暗号論的に安全な乱数を使う */
function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

/** 長さの違いで漏れないよう、必ず同じ長さ同士で比べる */
function sameHash(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** 送信先の伏せ字。画面に「どのアドレスへ送ったか」を出すために使う */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  const name = email.slice(0, at);
  const domain = email.slice(at);
  const head = name.slice(0, 1);
  const tail = name.length > 2 ? name.slice(-1) : "";
  return `${head}${"*".repeat(Math.max(1, name.length - 2))}${tail}${domain}`;
}

/**
 * ログイン済み・メール確認済みであることだけを求める。
 *
 * ここで «2要素認証を通っていること» を求めてはいけない。
 * 通るためにこの関数を呼ぶので、堂々巡りになる。
 */
function requireSignedIn(request: CallableRequest): {
  uid: string;
  email: string;
} {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "ログインが必要です");
  }
  if (request.auth.token.email_verified !== true) {
    throw new HttpsError(
      "permission-denied",
      "メールアドレスの確認が完了していません",
    );
  }
  const email = request.auth.token.email;
  if (typeof email !== "string" || !email) {
    throw new HttpsError("failed-precondition", "メールアドレスが取得できません");
  }
  return { uid: request.auth.uid, email };
}

/**
 * カスタムクレームを «足す»。
 *
 * setCustomUserClaims は総入れ替えなので、既存のものを読んでから混ぜる。
 * これを忘れると admin 権限が消える。
 */
async function mergeClaims(
  uid: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const auth = getAuth();
  const user = await auth.getUser(uid);
  await auth.setCustomUserClaims(uid, { ...(user.customClaims ?? {}), ...patch });
}

// ---------- ①コードを送る ----------

export async function handleStartTwoFactor(
  request: CallableRequest,
): Promise<{ sentTo: string; expiresAt: number }> {
  const { uid, email } = requireSignedIn(request);
  const now = Date.now();
  const ref = challengeRef(uid);

  const code = generateCode();
  const salt = randomBytes(16).toString("hex");

  // 発行の制限はトランザクションの中で見る。
  // 連打で同時に走っても、窓の回数がすり抜けないようにするため
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists ? (snap.data() as Challenge) : null;

    if (prev && now - prev.lastSentAt < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - prev.lastSentAt)) / 1000);
      throw new HttpsError(
        "resource-exhausted",
        `再送は${wait}秒後にできます`,
      );
    }

    const withinWindow =
      prev !== null && now - prev.windowStart < 60 * 60 * 1000;
    const issued = withinWindow ? prev.issuedInWindow : 0;
    if (issued >= HOURLY_ISSUE_LIMIT) {
      throw new HttpsError(
        "resource-exhausted",
        "確認コードの送信回数が上限に達しました。1時間ほど待ってからお試しください",
      );
    }

    const next: Challenge = {
      codeHash: hashCode(code, salt),
      salt,
      expiresAt: now + CODE_TTL_MS,
      // 新しいコードを出したので、間違えた回数は数え直す
      attempts: 0,
      lastSentAt: now,
      issuedInWindow: issued + 1,
      windowStart: withinWindow ? prev!.windowStart : now,
    };
    tx.set(ref, next);
  });

  // 送信はトランザクションの外で。中で待つと、その間ずっと書き込みを掴んでしまう
  await sendMail(twoFactorMail(email, code, Math.round(CODE_TTL_MS / 60000)));

  return { sentTo: maskEmail(email), expiresAt: now + CODE_TTL_MS };
}

// ---------- ②コードを照合する ----------

export async function handleVerifyTwoFactor(
  request: CallableRequest,
): Promise<{ verifiedAt: number }> {
  const { uid } = requireSignedIn(request);
  const raw = (request.data ?? {}) as { code?: unknown };
  const code =
    typeof raw.code === "string" ? raw.code.replace(/\D/g, "") : "";
  if (code.length !== CODE_LENGTH) {
    throw new HttpsError("invalid-argument", "6桁の数字を入力してください");
  }

  const now = Date.now();
  const ref = challengeRef(uid);

  // 照合もトランザクションで。並列に送られた総当たりで
  // 試行回数がすり抜けないようにする
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new HttpsError(
        "failed-precondition",
        "確認コードが発行されていません。送信し直してください",
      );
    }
    const ch = snap.data() as Challenge;

    if (now > ch.expiresAt) {
      tx.delete(ref);
      throw new HttpsError(
        "deadline-exceeded",
        "確認コードの期限が切れました。送信し直してください",
      );
    }
    if (ch.attempts >= MAX_ATTEMPTS) {
      throw new HttpsError(
        "resource-exhausted",
        "入力を間違えた回数が上限に達しました。送信し直してください",
      );
    }

    if (!sameHash(hashCode(code, ch.salt), ch.codeHash)) {
      tx.update(ref, { attempts: FieldValue.increment(1) });
      const left = MAX_ATTEMPTS - ch.attempts - 1;
      throw new HttpsError(
        "permission-denied",
        left > 0
          ? `確認コードが違います（あと${left}回）`
          : "入力を間違えた回数が上限に達しました。送信し直してください",
      );
    }

    // 使い切ったコードは残さない
    tx.delete(ref);
  });

  await mergeClaims(uid, { mfa: now });
  return { verifiedAt: now };
}

// ---------- ③有効化・無効化 ----------

export async function handleSetTwoFactorEnabled(
  request: CallableRequest,
): Promise<{ enabled: boolean }> {
  const { uid } = requireSignedIn(request);
  const raw = (request.data ?? {}) as { enabled?: unknown };
  if (typeof raw.enabled !== "boolean") {
    throw new HttpsError("invalid-argument", "enabled は真偽値で指定してください");
  }
  const enabled = raw.enabled;

  // 有効化も無効化も、直前に6桁コードを通していることを求める。
  // 無効化を素通りさせると、パスワードを盗んだ相手が
  // 自分で締め出しを解除できてしまい、機能そのものが意味を失う。
  const verifiedAt = request.auth?.token.mfa;
  if (
    typeof verifiedAt !== "number" ||
    Date.now() - verifiedAt > SETTINGS_FRESH_MS
  ) {
    throw new HttpsError(
      "failed-precondition",
      "確認コードの入力が必要です",
    );
  }

  const now = Date.now();
  await mergeClaims(uid, { mfaRequired: enabled });
  // 画面に出すための控え。強制しているのはあくまでクレームのほうで、
  // こちらが書けなくても守りは効いたままになる
  await db.doc(`users/${uid}`).set(
    enabled
      ? { twoFactorEnabled: true, twoFactorEnabledAt: now, updatedAt: now }
      : {
          twoFactorEnabled: false,
          twoFactorEnabledAt: FieldValue.delete(),
          updatedAt: now,
        },
    { merge: true },
  );

  return { enabled };
}
