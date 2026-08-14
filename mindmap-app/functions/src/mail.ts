/**
 * メール送信（MFA-02）。
 *
 * このプロジェクトには元々メール送信の口が無かったので、
 * 送信先を差し替えられる形にしてある。環境変数 MAIL_PROVIDER で選ぶ。
 *
 *   resend  … Resend の API（本番）
 *   console … ログに出すだけ（開発・CI。既定）
 *
 * 既定を console にしてあるので、契約前でも実装とテストは進められる。
 * 本番で resend にするときは、Secret に RESEND_API_KEY を入れ、
 * MAIL_FROM に «認証済みドメインの» 差出人を設定すること。
 * 詳しい手順は SECURITY_PRODUCTION.md を参照。
 */
import { logger } from "firebase-functions/v2";

export interface MailMessage {
  to: string;
  subject: string;
  /** 文字だけの本文。HTMLを表示しないメーラー向け */
  text: string;
  html: string;
}

type Provider = "resend" | "console";

function provider(): Provider {
  return process.env.MAIL_PROVIDER === "resend" ? "resend" : "console";
}

/** 差出人。Resend では認証済みドメインのアドレスである必要がある */
function fromAddress(): string {
  // resend.dev は Resend が用意している試験用の差出人。
  // 独自ドメインを認証するまでは、自分宛のテスト送信だけができる
  return process.env.MAIL_FROM ?? "思索 / Mindmap <onboarding@resend.dev>";
}

/** 本番で送信できる設定になっているか。運用チェック用 */
export function isMailConfigured(): boolean {
  return provider() === "console" || Boolean(process.env.RESEND_API_KEY);
}

/**
 * Resend へ送る。
 *
 * SDK を足さずに fetch で叩いている。呼ぶのは1エンドポイントだけなので、
 * 依存を増やしてまで抽象化する理由が無い（Node 20 に fetch がある）。
 */
async function sendViaResend(msg: MailMessage): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "RESEND_API_KEY が設定されていません（MAIL_PROVIDER=resend のため送信できません）",
    );
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [msg.to],
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    }),
  });
  if (!res.ok) {
    // 本文に宛先が入るので、そのままログへ出さない
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Resend への送信に失敗しました (${res.status}): ${detail.slice(0, 200)}`,
    );
  }
}

/**
 * メールを送る。
 *
 * console のときは宛先と本文をログに出すだけ。
 * 開発中に6桁コードを受け取る唯一の手段になるので、本文をそのまま出す。
 * 本番でこの経路に落ちないよう、起動時に isMailConfigured() を確認すること。
 */
export async function sendMail(msg: MailMessage): Promise<void> {
  if (provider() === "resend") {
    await sendViaResend(msg);
    return;
  }
  logger.info("[MAIL_PROVIDER=console] メールを送信したつもりになります", {
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
  });
}

/**
 * 6桁コードのメール文面。
 *
 * 覚えて入力するものなので、コードを本文の頭に置いて大きく見せる。
 * 「心当たりがなければ無視してよい」ことも必ず書く（乗っ取り検知の手がかりになる）。
 */
export function twoFactorMail(to: string, code: string, ttlMinutes: number): MailMessage {
  const subject = `【思索 / Mindmap】確認コード ${code}`;
  const text = [
    `確認コード: ${code}`,
    "",
    `ログイン画面にこの6桁を入力してください。${ttlMinutes}分で期限が切れます。`,
    "",
    "心当たりがない場合は、このメールを無視してください。",
    "その場合、あなたのパスワードが第三者に知られている可能性があります。",
    "念のためパスワードの変更をおすすめします。",
  ].join("\n");
  const html = `
<div style="font-family:system-ui,-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;line-height:1.8;color:#24261f">
  <p style="margin:0 0 8px;font-size:13px;color:#6b6f63">思索 / Mindmap</p>
  <p style="margin:0 0 4px;font-size:13px">確認コード</p>
  <p style="margin:0 0 20px;font-size:34px;font-weight:700;letter-spacing:0.18em">${code}</p>
  <p style="margin:0 0 20px;font-size:14px">
    ログイン画面にこの6桁を入力してください。${ttlMinutes}分で期限が切れます。
  </p>
  <p style="margin:0;font-size:12px;color:#6b6f63">
    心当たりがない場合は、このメールを無視してください。<br>
    その場合、あなたのパスワードが第三者に知られている可能性があります。
    念のためパスワードの変更をおすすめします。
  </p>
</div>`.trim();
  return { to, subject, text, html };
}
