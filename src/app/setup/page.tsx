"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, randomDisplayName } from "@/contexts/AuthContext";
import { DEFAULT_ASSIST_LEVEL } from "@/lib/gauge";
import { ageFromBirthDate } from "@/lib/ai-persona";
import type { AssistLevel } from "@/types";

/** AIアシスト既定レベルの選択肢（UP-02） */
const LEVEL_OPTIONS: { value: AssistLevel; label: string; hint: string }[] = [
  { value: "level1", label: "たっぷり", hint: "1ノードでAI2回" },
  { value: "level2", label: "標準", hint: "1ノードでAI1回" },
  { value: "level3", label: "ひかえめ", hint: "3ノードでAI1回" },
  { value: "off", label: "AIなし", hint: "提案を使わない" },
];

/**
 * プロフィール登録（NF-06）。
 * 年齢は必須（UP-06 年齢別AI応答で利用）。
 * 表示名は任意 — 未入力ならランダム生成。
 * アバター（写真）は任意 — Google アカウントの写真があれば引き継ぐ。
 */
export default function SetupPage() {
  const router = useRouter();
  const { user, profile, initializing, needsVerification, saveProfile } =
    useAuth();

  const [displayName, setDisplayName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [assistLevel, setAssistLevel] =
    useState<AssistLevel>(DEFAULT_ASSIST_LEVEL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placeholder] = useState(randomDisplayName);

  useEffect(() => {
    if (initializing) return;
    if (!user || needsVerification) {
      router.replace("/login");
      return;
    }
    if (profile) {
      router.replace("/");
    }
  }, [initializing, user, needsVerification, profile, router]);

  // 誕生日から満年齢を導出して保存する（UP-06）。5〜120歳のみ許可
  const derivedAge = birthDate ? ageFromBirthDate(birthDate) : null;
  const ageValid =
    derivedAge !== null && derivedAge >= 5 && derivedAge <= 120;

  const handleSubmit = async () => {
    if (!ageValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveProfile({
        displayName,
        age: derivedAge,
        birthDate,
        assistLevel,
      });
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
      setBusy(false);
    }
  };

  if (initializing || !user) return null;

  return (
    <main className="min-h-screen bg-page px-5 py-10 sm:py-16">
      <div className="mx-auto max-w-md">
        <div className="anim-float-up">
          <div className="micro-label mb-2">Profile</div>
          <h1 className="mb-2.5 font-display text-[30px] font-bold leading-snug tracking-tight">
            あなたのことを教えてください
          </h1>
          <p className="mb-8 text-sm leading-relaxed text-muted">
            年齢に合わせて AI の言葉づかいを調整します
          </p>

          {/* アバター（任意・Googleの写真を引き継ぎ） */}
          <div className="mb-6 flex items-center gap-4">
            {user.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.photoURL}
                alt="アバター"
                className="h-14 w-14 rounded-full border border-line object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-tint-accent-strong font-display text-lg font-bold text-accent-soft">
                {(displayName || placeholder).charAt(0)}
              </span>
            )}
            <p className="text-xs leading-relaxed text-muted">
              アバターは任意です。
              {user.photoURL
                ? "Google アカウントの写真を使います。"
                : "あとから設定できます。"}
            </p>
          </div>

          <label className="mb-1.5 block text-[13px] font-bold">
            表示名 <span className="font-normal text-muted">（任意）</span>
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={`未入力なら「${placeholder}」になります`}
            maxLength={30}
            className="mb-5 w-full rounded-[12px] border border-line bg-card px-5 py-3.5 text-[15px] text-ink outline-none ring-accent/40 transition-shadow placeholder:text-placeholder focus:border-accent/60 focus:ring-2"
          />

          <label className="mb-1.5 block text-[13px] font-bold">
            誕生日 <span className="font-normal text-danger">（必須）</span>
          </label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full rounded-[12px] border border-line bg-card px-5 py-3.5 text-[15px] text-ink outline-none ring-accent/40 transition-shadow placeholder:text-placeholder focus:border-accent/60 focus:ring-2 [color-scheme:dark]"
          />
          {birthDate !== "" && !ageValid && (
            <p className="mt-1.5 text-[11px] text-danger">
              5〜120歳になる誕生日を入力してください
            </p>
          )}
          {ageValid && (
            <p className="mt-1.5 text-[11px] text-muted">
              {derivedAge}歳 — 年齢に合わせてAIの言葉づかいを調整します
            </p>
          )}

          {/* AIアシストの既定レベル（UP-02）。マップごとに後から変更できる */}
          <label className="mb-1.5 mt-6 block text-[13px] font-bold">
            AIアシスト <span className="font-normal text-muted">（あとで変更可）</span>
          </label>
          <p className="mb-2.5 text-xs leading-relaxed text-muted">
            自分でノードを増やすほどAIに相談できます。強さの既定値を選んでください。
          </p>
          <div className="grid grid-cols-2 gap-2">
            {LEVEL_OPTIONS.map((opt) => {
              const active = opt.value === assistLevel;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAssistLevel(opt.value)}
                  className={`rounded-[12px] px-3 py-2.5 text-left transition-all ${
                    active
                      ? "bg-accent text-on-accent"
                      : "border border-line bg-card text-muted hover:border-accent/50 hover:text-accent-soft"
                  }`}
                >
                  <span className="block text-[13px] font-bold">
                    {opt.label}
                  </span>
                  <span
                    className={`mt-0.5 block text-[11px] ${
                      active ? "text-on-accent/80" : "text-placeholder"
                    }`}
                  >
                    {opt.hint}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!ageValid || busy}
            className="btn-lift btn-primary mt-8 w-full py-4 text-[15px] disabled:opacity-40"
          >
            {busy ? "保存中…" : "はじめる"}
          </button>

          {error && (
            <div className="mt-4 rounded-[12px] bg-tint-danger px-4 py-3 text-[13px] text-danger">
              {error}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
