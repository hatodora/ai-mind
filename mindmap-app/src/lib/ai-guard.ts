import { NextResponse } from "next/server";

/**
 * 未認証 AI 経路（/api/ai/*）の開閉スイッチ（REL-06）。
 *
 * この経路は認証を要求しないため、URL さえ分かれば誰でも Groq を呼べてしまう。
 * レートリミットは IP 単位・プロセス内メモリのみで、サーバーレスでは
 * インスタンスごとに窓が分かれるため、本番で開けたままにすると
 * 「他人の API キーで動く無料 AI プロキシ」になりかねない。
 *
 * そのため既定では本番のみ閉じ、開発では従来どおり動くようにしている。
 *  - AI_PUBLIC_FALLBACK=on  … 明示的に開ける（未ログインでも AI を使わせたい場合）
 *  - AI_PUBLIC_FALLBACK=off … 明示的に閉じる
 *  - 未設定            … 本番は閉じる / 開発は開ける
 *
 * 本番で開ける場合は、少なくとも App Check の適用と
 * 共有ストア（Redis 等）でのレートリミットをセットで導入すること。
 */
export function isPublicAiEnabled(): boolean {
  const flag = process.env.AI_PUBLIC_FALLBACK;
  if (flag === "on") return true;
  if (flag === "off") return false;
  return process.env.NODE_ENV !== "production";
}

/**
 * 経路が閉じているときに返すレスポンス。開いていれば null。
 * 各 route の先頭で呼び、null でなければそのまま返すこと。
 *
 * ここに到達するのは未ログイン時だけのはずなので、文言も未ログイン前提にする。
 * ただしログイン済みでも認証状態の復元前などに落ちてくることがあり得るため、
 * 「ログインしているのに出た」場合の次の一手も書いておく。
 */
export function publicAiDisabledResponse(): NextResponse | null {
  if (isPublicAiEnabled()) return null;
  return NextResponse.json(
    {
      error:
        "AI機能はログイン後にご利用いただけます。ログイン済みでこの表示が出る場合は、ページを再読み込みしてお試しください",
    },
    { status: 403 },
  );
}
