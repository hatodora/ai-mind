"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { firebaseDb } from "@/lib/firebase";
import { newId } from "@/lib/storage";
import {
  CATEGORY_LABEL,
  EMAIL_MAX,
  MESSAGE_MAX,
  isValidCategory,
  isValidEmail,
  type Inquiry,
  type InquiryCategory,
} from "@/lib/inquiry";

type Status = "idle" | "sending" | "success" | "error";

/**
 * お問い合わせフォーム（REL-04）。
 * ログインユーザーのみ送信可能。inquiries/{id} に保存され、管理者が別途対応する。
 * メール未確認・利用規約未合意でも送信できるようにしておく
 * （削除請求・誕生日変更依頼など、規約合意前の相談を受け付けるため）。
 */
export default function ContactPage() {
  const router = useRouter();
  const { user, profile, initializing } = useAuth();
  const [category, setCategory] = useState<InquiryCategory>("bug");
  // ユーザーが編集していない間は user.email を反映する（初期値は effect ではなく派生値で）
  const [emailInput, setEmailInput] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initializing) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent("/contact")}`);
    }
  }, [initializing, user, router]);

  if (initializing || !user) return null;

  const email = emailInput ?? user.email ?? "";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setError(null);

    if (!isValidCategory(category)) {
      setError("種別を選択してください");
      return;
    }
    if (!isValidEmail(email)) {
      setError("メールアドレスの形式が正しくありません");
      return;
    }
    const trimmed = message.trim();
    if (trimmed.length === 0) {
      setError("お問い合わせ内容を入力してください");
      return;
    }
    if (trimmed.length > MESSAGE_MAX) {
      setError(`お問い合わせ内容は${MESSAGE_MAX}文字以内でお願いします`);
      return;
    }

    setStatus("sending");
    try {
      const id = newId();
      const now = Date.now();
      const inquiry: Inquiry = {
        id,
        category,
        email,
        message: trimmed,
        submittedByUid: user.uid,
        status: "new",
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(firebaseDb(), "inquiries", id), inquiry);
      setStatus("success");
      setMessage("");
      setEmailInput(null);
      setCategory("bug");
    } catch (e) {
      console.error("お問い合わせの送信に失敗しました", e);
      setStatus("error");
      setError("送信に失敗しました。時間をおいて再度お試しください");
    }
  }

  if (status === "success") {
    return (
      <main className="min-h-screen bg-page px-5 py-16">
        <div className="mx-auto max-w-md">
          <div className="anim-float-up card-soft p-6">
            <div className="micro-label mb-2 text-accent-soft">Sent</div>
            <h1 className="mb-3 font-display text-[22px] font-bold tracking-tight">
              送信が完了しました
            </h1>
            <p className="mb-6 text-[13.5px] leading-[1.9] text-muted">
              お問い合わせを受け付けました。内容を確認のうえ、必要に応じて記載のメールアドレスへご返信いたします。
            </p>
            <Link href="/" className="btn-lift btn-primary inline-block px-6 py-3 text-[14px]">
              ホームへ戻る
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-page px-5 py-12">
      <div className="mx-auto max-w-md">
        <Link
          href="/"
          className="micro-label mb-4 inline-block text-muted hover:text-ink"
        >
          ← ホームへ戻る
        </Link>

        <div className="anim-float-up">
          <div className="micro-label mb-2">Contact</div>
          <h1 className="mb-2 font-display text-[28px] font-bold tracking-tight">
            お問い合わせ
          </h1>
          <p className="mb-8 text-[13.5px] leading-[1.9] text-muted">
            不具合の報告・削除請求・誕生日変更依頼など、必要事項をご記入ください。
            {profile ? "" : "利用規約未合意でも送信できます。"}
          </p>

          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="category" className="mb-1.5 block text-[13px] font-bold">
                種別
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as InquiryCategory)}
                className="w-full rounded-[12px] border border-line bg-card px-4 py-3 text-[14px] text-ink outline-none ring-accent/40 focus:border-accent/60 focus:ring-2"
              >
                {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-[13px] font-bold">
                返信用メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmailInput(e.target.value)}
                required
                maxLength={EMAIL_MAX}
                autoComplete="email"
                className="w-full rounded-[12px] border border-line bg-card px-4 py-3 text-[14px] text-ink outline-none ring-accent/40 placeholder:text-placeholder focus:border-accent/60 focus:ring-2"
              />
            </div>

            <div>
              <label htmlFor="message" className="mb-1.5 block text-[13px] font-bold">
                お問い合わせ内容
                <span className="ml-2 text-[11px] font-normal text-placeholder">
                  {message.length} / {MESSAGE_MAX}
                </span>
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={8}
                maxLength={MESSAGE_MAX}
                placeholder="ご質問・ご要望をご記入ください"
                className="w-full rounded-[12px] border border-line bg-card px-4 py-3 text-[14px] text-ink outline-none ring-accent/40 placeholder:text-placeholder focus:border-accent/60 focus:ring-2"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-[12px] bg-tint-danger px-4 py-3 text-[13px] text-danger"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="btn-lift btn-primary w-full py-4 text-[15px] disabled:opacity-40"
            >
              {status === "sending" ? "送信中…" : "送信する"}
            </button>

            <p className="text-[11px] leading-[1.8] text-placeholder">
              送信いただいた内容は、
              <Link
                href="/privacy"
                className="mx-1 text-accent-soft underline underline-offset-4 hover:no-underline"
              >
                プライバシーポリシー
              </Link>
              に従い、お問い合わせ対応のためのみ利用します。
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
