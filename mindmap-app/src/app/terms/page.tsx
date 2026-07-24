import type { Metadata } from "next";
import Link from "next/link";
import {
  MIN_SERVICE_AGE,
  OPERATOR_NAME,
  TERMS_EFFECTIVE_DATE,
} from "@/lib/terms";

export const metadata: Metadata = {
  title: "利用規約 — 思索 / Mindmap",
  description: "思索 / Mindmap（AIマインドマップ）の利用規約。",
};

/**
 * 利用規約（REL-03）。
 * ここに載せた条項に実質的な変更がある場合は src/lib/terms.ts の
 * TERMS_VERSION を上げ、既存ユーザーに再合意を求めること。
 */
export default function TermsPage() {
  return (
    <main className="min-h-screen bg-page px-5 py-12">
      <article className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="micro-label mb-4 inline-block text-muted hover:text-ink"
        >
          ← ホームへ戻る
        </Link>

        <div className="micro-label mb-2">Terms</div>
        <h1 className="mb-2 font-display text-[28px] font-bold tracking-tight">
          利用規約
        </h1>
        <p className="mb-8 text-xs text-muted">
          最終改定日: {TERMS_EFFECTIVE_DATE}
        </p>

        <div className="space-y-6 text-[14px] leading-[1.9] text-ink">
          <p>
            この利用規約（以下「本規約」）は、{OPERATOR_NAME}
            （以下「当方」）が提供するマインドマップ作成サービス「思索 /
            Mindmap」および関連機能（以下「本サービス」）の利用条件を定めるものです。
            利用者は本規約に同意のうえ、本サービスを利用するものとします。
          </p>

          <Section title="1. 対象年齢">
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>
                本サービスは {MIN_SERVICE_AGE}
                歳以上を対象としています。未成年の方は、保護者の同意を得たうえでご利用ください。
              </li>
              <li>
                コミュニティへの投稿・コメントは
                <strong className="mx-0.5">15歳以上</strong>
                の方のみ利用できます（閲覧・ブックマークは全年齢が可能です）。
              </li>
            </ul>
          </Section>

          <Section title="2. アカウント登録">
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>
                本サービスの一部機能はアカウント登録が必要です。登録には有効なメールアドレスまたは
                Google アカウントを使用してください。
              </li>
              <li>
                登録時に入力する誕生日は、年齢に応じた AI
                応答の調整および機能制限（コミュニティ投稿等）に利用します。
              </li>
              <li>
                誕生日の自己変更は
                <strong className="mx-0.5">2回まで</strong>
                です。それ以上の変更はお問い合わせフォームより管理者へ依頼してください。
              </li>
              <li>
                利用者は、登録情報を正確に保つ責任を負います。他人のメールアドレスや虚偽の情報での登録はお控えください。
              </li>
            </ul>
          </Section>

          <Section title="3. 禁止事項">
            <p>本サービスの利用にあたり、以下の行為を禁止します。</p>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>法令または公序良俗に違反する行為</li>
              <li>
                他者の権利（プライバシー・著作権・肖像権等）を侵害する行為
              </li>
              <li>他者を誹謗中傷し、または差別的表現を投稿する行為</li>
              <li>本サービスの運営を妨害する行為（過度な自動化・スクレイピング等）</li>
              <li>本サービスの脆弱性を悪用する行為、または不正アクセス</li>
              <li>本サービスまたは AI 出力を使った違法・有害なコンテンツの生成</li>
              <li>他の利用者になりすます行為</li>
            </ul>
          </Section>

          <Section title="4. AI 機能について">
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>
                本サービスは Groq
                を含む第三者の AI 事業者による推論を利用し、提案・解説・レビュー等を生成します。
              </li>
              <li>
                AI
                の出力は正確性・完全性を保証するものではありません。医療・法律・投資等の重要な判断は、必ず専門家にご相談ください。
              </li>
              <li>
                AI
                には利用者のマインドマップの内容（テーマ・ノード・年齢帯・パーソナリティ設定）を送信します。氏名・メールアドレス等の個人を特定する情報は送信しません。詳細は
                <Link
                  href="/privacy"
                  className="mx-1 text-accent-soft underline underline-offset-4 hover:no-underline"
                >
                  プライバシーポリシー
                </Link>
                をご確認ください。
              </li>
            </ul>
          </Section>

          <Section title="5. コンテンツの取り扱い">
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>
                利用者がマインドマップやコミュニティに投稿したコンテンツの著作権は利用者に帰属します。
              </li>
              <li>
                当方は、本サービスの提供・改善・広報のために必要な範囲で、投稿コンテンツを無償で利用（複製・公衆送信・改変等）できるものとします。
              </li>
              <li>
                当方は、本規約または法令に違反すると判断した投稿を、事前の通知なく削除することがあります。
              </li>
            </ul>
          </Section>

          <Section title="6. アカウントの削除・データの保持">
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>
                利用者は設定画面よりいつでもアカウントを削除できます。削除すると、プロフィール・マインドマップ・投稿・コメント・ブックマークはすべて完全に削除され、復元できません。
              </li>
              <li>
                未ログインで作成された匿名マインドマップは、作成から
                <strong className="mx-0.5">30日</strong>
                で自動的に削除されます。
              </li>
              <li>
                当方は、法令に基づく場合または本規約への違反があった場合、事前の通知なく利用者のアカウントを停止または削除することがあります。
              </li>
            </ul>
          </Section>

          <Section title="7. サービスの変更・中断">
            <p>
              当方は、事前の通知なく本サービスの全部または一部を変更・中断・終了することがあります。これによって利用者に損害が生じた場合でも、当方は責任を負わないものとします。
            </p>
          </Section>

          <Section title="8. 免責事項">
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>
                当方は、本サービスが常に安全・正確・中断なく提供されることを保証しません。
              </li>
              <li>
                本サービスの利用により利用者または第三者に生じた損害について、当方は法令上許容される最大限の範囲で責任を負いません。ただし、当方の故意または重大な過失による場合はこの限りではありません。
              </li>
            </ul>
          </Section>

          <Section title="9. 規約の変更">
            <p>
              当方は、必要に応じて本規約を変更することがあります。実質的な変更を行う場合は、本サービス内でお知らせし、次回ログイン時に再合意を求めることがあります。変更後も本サービスを継続して利用した場合、変更後の規約に同意したものとみなします。
            </p>
          </Section>

          <Section title="10. 準拠法と管轄">
            <p>
              本規約は日本法に準拠し、本サービスに関する紛争は当方の所在地を管轄する裁判所を第一審の専属的合意管轄とします。
            </p>
          </Section>

          <Section title="11. お問い合わせ">
            <p>
              本規約に関するお問い合わせは、
              <Link
                href="/contact"
                className="mx-1 text-accent-soft underline underline-offset-4 hover:no-underline"
              >
                お問い合わせフォーム
              </Link>
              よりご連絡ください。
            </p>
          </Section>
        </div>

        <div className="mt-10 flex flex-wrap gap-3 text-xs">
          <Link
            href="/privacy"
            className="rounded-full border border-line bg-card px-4 py-2 text-muted transition-colors hover:text-ink"
          >
            プライバシーポリシー →
          </Link>
          <Link
            href="/contact"
            className="rounded-full border border-line bg-card px-4 py-2 text-muted transition-colors hover:text-ink"
          >
            お問い合わせ →
          </Link>
        </div>
      </article>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 font-display text-[17px] font-bold text-ink">
        {title}
      </h2>
      <div className="text-[13.5px] leading-[1.9] text-muted">{children}</div>
    </section>
  );
}
