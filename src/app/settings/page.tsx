"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_ASSIST_LEVEL } from "@/lib/gauge";
import { DEFAULT_PERSONALITY, ageFromBirthDate } from "@/lib/ai-persona";
import type { AIPersonality, AssistLevel, UserProfile } from "@/types";

/** AIアシスト既定レベルの選択肢（UP-02） */
const LEVEL_OPTIONS: { value: AssistLevel; label: string; hint: string }[] = [
  { value: "level1", label: "たっぷり", hint: "1ノードでAI2回" },
  { value: "level2", label: "標準", hint: "1ノードでAI1回" },
  { value: "level3", label: "ひかえめ", hint: "3ノードでAI1回" },
  { value: "off", label: "AIなし", hint: "提案を使わない" },
];

/** AIパーソナリティの選択肢（UP-04） */
const PERSONA_OPTIONS: {
  value: AIPersonality;
  label: string;
  hint: string;
}[] = [
  {
    value: "advisor",
    label: "アドバイザー",
    hint: "あなたの考えを認めて伸ばしつつ、気になる点は率直に指摘する",
  },
  {
    value: "boss",
    label: "ボス",
    hint: "安易に答えず「本当にそうか？」と問いを突き返し、自分で考えさせる",
  },
  {
    value: "analyst",
    label: "アナリスト",
    hint: "感情を挟まず論理と事実で端的に。あえて逆の視点も提示する",
  },
];

/**
 * プロフィール設定（UP-04 / UP-06）。
 * 表示名・誕生日・AIパーソナリティ・AIアシスト既定レベルを変更できる。
 * ここで選んだ設定は以降のすべてのマップに適用される（過去の内容は変えない）。
 */
export default function SettingsPage() {
  const router = useRouter();
  const { user, profile, initializing, needsVerification, saveProfile } =
    useAuth();

  useEffect(() => {
    if (initializing) return;
    if (!user || needsVerification) {
      router.replace("/login");
      return;
    }
    if (!profile) {
      router.replace("/setup");
    }
  }, [initializing, user, needsVerification, profile, router]);

  if (initializing || !user || !profile) return null;

  // プロフィールが読めてからフォームをマウントし、初期値は useState で確定させる
  return <SettingsForm profile={profile} saveProfile={saveProfile} />;
}

function SettingsForm({
  profile,
  saveProfile,
}: {
  profile: UserProfile;
  saveProfile: (input: {
    displayName?: string;
    age: number;
    birthDate?: string;
    personality?: AIPersonality;
    assistLevel?: AssistLevel;
    showNameInCommunity?: boolean;
  }) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [birthDate, setBirthDate] = useState(profile.birthDate ?? "");
  const [personality, setPersonality] = useState<AIPersonality>(
    profile.personality ?? DEFAULT_PERSONALITY,
  );
  const [assistLevel, setAssistLevel] = useState<AssistLevel>(
    profile.assistLevel ?? DEFAULT_ASSIST_LEVEL,
  );
  const [showName, setShowName] = useState(
    profile.showNameInCommunity ?? false,
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 誕生日が入力されていれば年齢を導出、空なら既存の age を維持（旧プロフィール）
  const derivedAge = birthDate ? ageFromBirthDate(birthDate) : profile.age;
  const ageValid =
    derivedAge !== null && derivedAge >= 5 && derivedAge <= 120;

  const handleSave = async () => {
    if (!ageValid || busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await saveProfile({
        displayName,
        age: derivedAge,
        ...(birthDate ? { birthDate } : {}),
        personality,
        assistLevel,
        showNameInCommunity: showName,
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-page px-5 py-10 sm:py-16">
      <div className="mx-auto max-w-md">
        <Link href="/" className="icon-circle anim-float-up mb-10" aria-label="戻る">
          <span className="font-display text-lg leading-none">←</span>
        </Link>

        <div className="anim-float-up" style={{ animationDelay: "0.06s" }}>
          <div className="micro-label mb-2">Settings</div>
          <h1 className="mb-2.5 font-display text-[30px] font-bold leading-snug tracking-tight">
            プロフィール設定
          </h1>
          <p className="mb-8 text-sm leading-relaxed text-muted">
            ここで選んだ設定は、これからの全てのマップに適用されます
          </p>

          <label className="mb-1.5 block text-[13px] font-bold">表示名</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={30}
            className="mb-5 w-full rounded-[12px] border border-line bg-card px-5 py-3.5 text-[15px] text-ink outline-none ring-accent/40 transition-shadow placeholder:text-placeholder focus:border-accent/60 focus:ring-2"
          />

          <label className="mb-1.5 block text-[13px] font-bold">誕生日</label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full rounded-[12px] border border-line bg-card px-5 py-3.5 text-[15px] text-ink outline-none ring-accent/40 transition-shadow focus:border-accent/60 focus:ring-2 [color-scheme:dark]"
          />
          {!ageValid && birthDate !== "" ? (
            <p className="mt-1.5 text-[11px] text-danger">
              5〜120歳になる誕生日を入力してください
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-muted">
              年齢に合わせてAIの言葉づかいを調整します
            </p>
          )}

          {/* AIパーソナリティ（UP-04） */}
          <label className="mb-1.5 mt-6 block text-[13px] font-bold">
            AIパーソナリティ
          </label>
          <p className="mb-2.5 text-xs leading-relaxed text-muted">
            解説・レビューを中心に、AIの応答トーンが変わります
          </p>
          <div className="flex flex-col gap-2">
            {PERSONA_OPTIONS.map((opt) => {
              const active = opt.value === personality;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPersonality(opt.value)}
                  className={`rounded-[12px] px-4 py-3 text-left transition-all ${
                    active
                      ? "bg-accent text-on-accent"
                      : "border border-line bg-card text-muted hover:border-accent/50 hover:text-accent-soft"
                  }`}
                >
                  <span className="block text-[14px] font-bold">
                    {opt.label}
                  </span>
                  <span
                    className={`mt-0.5 block text-[11px] leading-relaxed ${
                      active ? "text-on-accent/80" : "text-placeholder"
                    }`}
                  >
                    {opt.hint}
                  </span>
                </button>
              );
            })}
          </div>

          {/* AIアシスト既定レベル（UP-02） */}
          <label className="mb-1.5 mt-6 block text-[13px] font-bold">
            AIアシスト（既定）
          </label>
          <p className="mb-2.5 text-xs leading-relaxed text-muted">
            新しいマップの初期値になります。マップごとの変更も可能です
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

          {/* コミュニティの名前表示（NF-01b）。既定はオフ＝匿名 */}
          <label className="mb-1.5 mt-6 block text-[13px] font-bold">
            コミュニティ
          </label>
          <button
            type="button"
            onClick={() => setShowName((v) => !v)}
            role="switch"
            aria-checked={showName}
            className="flex w-full items-center justify-between gap-4 rounded-[12px] border border-line bg-card px-4 py-3.5 text-left transition-colors hover:border-accent/50"
          >
            <span className="min-w-0">
              <span className="block text-[14px] font-bold text-ink">
                投稿・コメントに名前を表示
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                オフのときは「匿名の思索家」として表示されます
              </span>
            </span>
            <span
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                showName ? "bg-accent" : "bg-card-raised"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-page transition-all ${
                  showName ? "left-[22px]" : "left-0.5"
                }`}
              />
            </span>
          </button>

          <button
            onClick={handleSave}
            disabled={!ageValid || busy}
            className="btn-lift btn-primary mt-8 w-full py-4 text-[15px] disabled:opacity-40"
          >
            {busy ? "保存中…" : "保存する"}
          </button>

          {saved && (
            <div className="anim-float-up mt-4 rounded-[12px] bg-tint-accent-strong px-4 py-3 text-[13px] font-bold text-accent-soft">
              保存しました
            </div>
          )}
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
