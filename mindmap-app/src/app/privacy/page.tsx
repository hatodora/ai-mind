import type { Metadata } from "next";
import Link from "next/link";
import {
  MIN_SERVICE_AGE,
  OPERATOR_NAME,
  TERMS_EFFECTIVE_DATE,
} from "@/lib/terms";

export const metadata: Metadata = {
  title: "プライバシーポリシー — 思索 / Mindmap",
  description: "思索 / Mindmap における個人情報の取り扱い。",
};

/** プライバシーポリシー（REL-03）。運営体制・法令改正時は文言を見直す */
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-page px-5 py-12">
      <article className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="micro-label mb-4 inline-block text-muted hover:text-ink"
        >
          ← ホームへ戻る
        </Link>

        <div className="micro-label mb-2">Privacy</div>
        <h1 className="mb-2 font-display text-[28px] font-bold tracking-tight">
          プライバシーポリシー
        </h1>
        <p className="mb-8 text-xs text-muted">
          最終改定日: {TERMS_EFFECTIVE_DATE}
        </p>

        <div className="space-y-6 text-[14px] leading-[1.9] text-ink">
          <p>
            {OPERATOR_NAME}（以下「当方」）は、「思索 /
            Mindmap」および関連サービス（以下「本サービス」）における個人情報の取り扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」）を定めます。
          </p>

          <Section title="1. 収集する情報">
            <p>本サービスは、以下の情報を収集します。</p>
            <ul className="mt-2 list-inside list-disc space-y-1.5 pl-2">
              <li>
                <strong>メールアドレス</strong>:
                アカウント作成・ログイン・お問い合わせ対応のため（Firebase
                Authentication に保存）。
              </li>
              <li>
                <strong>表示名</strong>:
                サービス内の表示のため。未入力時はランダムに生成した名前を使用します。
              </li>
              <li>
                <strong>誕生日</strong>:
                年齢帯を算出し、年齢に応じた AI
                応答の調整および機能制限（15歳未満のコミュニティ投稿制限等）を行うため。
                <strong className="mx-0.5">
                  生の誕生日を AI プロバイダに送信することはありません
                </strong>
                。
              </li>
              <li>
                <strong>プロフィール画像</strong>: Google
                アカウントで連携ログインした場合のみ、Google
                が提供する画像 URL。
              </li>
              <li>
                <strong>マインドマップの内容・コミュニティ投稿</strong>:
                本サービスの提供に必要な範囲で保存します。
              </li>
              <li>
                <strong>アクセスログ等の技術情報</strong>: IP
                アドレス、ブラウザ情報、アクセス日時等。不正利用の防止・統計処理・サービス品質の改善のため。
              </li>
            </ul>
          </Section>

          <Section title="2. 利用目的">
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>本サービスの提供・維持・改善・新機能の開発</li>
              <li>本人確認・認証・不正利用防止</li>
              <li>お問い合わせ・サポート対応</li>
              <li>統計処理（個人を特定しない形式）</li>
              <li>法令に基づく対応</li>
            </ul>
          </Section>

          <Section title="3. AI プロバイダへの送信">
            <p>
              マインドマップの提案・解説・レビュー等の生成のため、以下の情報を Groq
              を含む AI プロバイダに送信することがあります。
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1.5 pl-2">
              <li>マインドマップのテーマおよびノード内容</li>
              <li>年齢帯（粗い区分。生の誕生日は送信しません）</li>
              <li>利用者が設定した AI パーソナリティ設定</li>
            </ul>
            <p className="mt-3">
              氏名・メールアドレスなど、
              <strong className="mx-0.5">個人を特定する情報は AI プロバイダに送信しません</strong>
              。
            </p>
          </Section>

          <Section title="4. 第三者提供・外部委託">
            <p>
              当方は、法令に基づく場合を除き、利用者の同意なく個人情報を第三者に提供しません。ただし、以下の外部サービスをインフラとして利用し、必要な範囲で情報を委託処理しています。
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1.5 pl-2">
              <li>Google (Firebase Authentication / Firestore / Cloud Functions)</li>
              <li>Vercel（ホスティング）</li>
              <li>Groq（AI 推論）</li>
            </ul>
          </Section>

          <Section title="5. データ保持と削除">
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>
                未ログイン（匿名）で作成されたマインドマップは、作成から
                <strong className="mx-0.5">30日</strong>
                を経過した時点で自動的に削除されます。
              </li>
              <li>
                アカウント削除は設定画面から本人がいつでも実行できます。削除するとプロフィール・マインドマップ・投稿・コメント・ブックマークはすべて完全に削除され、復元できません（匿名化しての残存もありません）。
              </li>
              <li>
                削除できない事情がある場合（ログイン不可等）は
                <Link
                  href="/contact"
                  className="mx-1 text-accent-soft underline underline-offset-4 hover:no-underline"
                >
                  お問い合わせフォーム
                </Link>
                から削除請求してください。本人確認のうえ削除いたします。
              </li>
            </ul>
          </Section>

          <Section title="6. 未成年の利用について">
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>本サービスは {MIN_SERVICE_AGE} 歳以上を対象としています。</li>
              <li>
                コミュニティ投稿・コメント機能は、15歳以上の方のみ利用できます。
              </li>
              <li>
                未成年の方は、保護者の同意を得たうえで本サービスをご利用ください。保護者の方は、本ポリシーおよび利用規約をご確認のうえ、必要に応じてお子様の利用を監督してください。
              </li>
            </ul>
          </Section>

          <Section title="7. Cookie 等の利用">
            <p>
              本サービスは、認証セッションの維持および利便性向上のため、Cookie
              および類似技術を利用します。ブラウザの設定により Cookie
              を無効化できますが、その場合本サービスの一部機能をご利用いただけないことがあります。
            </p>
          </Section>

          <Section title="8. 安全管理措置">
            <p>
              当方は、個人情報の漏えい・滅失または毀損の防止その他個人情報の安全管理のために必要かつ適切な措置を講じます。認証情報の管理には
              Firebase Authentication を、データ本体は Firestore
              のセキュリティルールによって最小限のアクセスに絞り込んで保護しています。
            </p>
          </Section>

          <Section title="9. 開示・訂正・削除等の請求">
            <p>
              利用者は、当方が保有する自己の個人情報について、開示・訂正・追加・削除・利用停止を請求できます。
              <Link
                href="/contact"
                className="mx-1 text-accent-soft underline underline-offset-4 hover:no-underline"
              >
                お問い合わせフォーム
              </Link>
              よりご連絡ください。
            </p>
          </Section>

          <Section title="10. 本ポリシーの変更">
            <p>
              当方は必要に応じて本ポリシーを変更することがあります。変更後の本ポリシーは、本サイトに掲示された時点から効力を生じます。実質的な変更については、次回ログイン時に再合意を求めることがあります。
            </p>
          </Section>

          <Section title="11. お問い合わせ窓口">
            <p>
              本ポリシーに関するお問い合わせは、
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
            href="/terms"
            className="rounded-full border border-line bg-card px-4 py-2 text-muted transition-colors hover:text-ink"
          >
            利用規約 →
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
