"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  TERMS_EFFECTIVE_DATE,
  TERMS_VERSION,
  hasAcceptedCurrentTerms,
} from "@/lib/terms";

/**
 * 既存ユーザー向け利用規約再合意画面（REL-03）。
 * TERMS_VERSION が上がったときに `<AppGate>` から誘導される。
 * 初回登録の合意は setup ページ側で行うため、ここに来る条件は
 * 「プロフィールあり ＆ termsVersion が現行より古い」だけ。
 */
export default function TermsAcceptPage() {
  return (
    <Suspense fallback={null}>
      <TermsAcceptInner />
    </Suspense>
  );
}

function TermsAcceptInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, profile, initializing, saveProfile } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPath = params.get("next") || "/";

  useEffect(() => {
    if (initializing) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!profile) {
      router.replace("/setup");
      return;
    }
    // 既に合意済みなら遷移先へ戻す（URL 直打ちの誤操作対策）
    if (hasAcceptedCurrentTerms(profile)) {
      router.replace(nextPath);
    }
  }, [initializing, user, profile, nextPath, router]);

  if (initializing || !user || !profile) return null;

  const handleAccept = async () => {
    if (!agreed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveProfile({
        // 既存の値をそのまま送り、規約バージョンだけ更新する
        displayName: profile.displayName,
        age: profile.age,
        birthDate: profile.birthDate,
        personality: profile.personality,
        assistLevel: profile.assistLevel,
        showNameInCommunity: profile.showNameInCommunity,
        acceptedTermsVersion: TERMS_VERSION,
      });
      router.replace(nextPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-page px-5 py-12">
      <div className="mx-auto max-w-md">
        <div className="anim-float-up">
          <div className="micro-label mb-2">Terms updated</div>
          <h1 className="mb-2 font-display text-[26px] font-bold tracking-tight">
            利用規約が更新されました
          </h1>
          <p className="mb-6 text-[13.5px] leading-[1.9] text-muted">
            続けてご利用いただくには、新しい
            <Link
              href="/terms"
              target="_blank"
              className="mx-1 text-accent-soft underline underline-offset-4 hover:no-underline"
            >
              利用規約
            </Link>
            および
            <Link
              href="/privacy"
              target="_blank"
              className="mx-1 text-accent-soft underline underline-offset-4 hover:no-underline"
            >
              プライバシーポリシー
            </Link>
            への同意が必要です。
            <br />
            <span className="text-[11px] text-placeholder">
              最終改定日: {TERMS_EFFECTIVE_DATE}
            </span>
          </p>

          <label className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-line bg-card p-4">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span className="text-[13px] leading-[1.8] text-ink">
              新しい利用規約とプライバシーポリシーに同意します
            </span>
          </label>

          {error && (
            <div className="mt-4 rounded-[12px] bg-tint-danger px-4 py-3 text-[13px] text-danger">
              {error}
            </div>
          )}

          <button
            onClick={handleAccept}
            disabled={!agreed || busy}
            className="btn-lift btn-primary mt-6 w-full py-4 text-[15px] disabled:opacity-40"
          >
            {busy ? "更新中…" : "同意して続ける"}
          </button>
        </div>
      </div>
    </main>
  );
}
