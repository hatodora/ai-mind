"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "@/contexts/AuthContext";
import { firebaseFunctions } from "@/lib/firebase";
import { DEFAULT_ASSIST_LEVEL } from "@/lib/gauge";
import {
  DEFAULT_PERSONALITY,
  MAX_BIRTHDATE_EDITS,
  ageFromBirthDate,
} from "@/lib/ai-persona";
import { BirthDatePicker } from "@/components/BirthDatePicker";
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
  const { user, profile, initializing, needsVerification, signOut, saveProfile } =
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
  return (
    <SettingsForm profile={profile} saveProfile={saveProfile} signOut={signOut} />
  );
}

function SettingsForm({
  profile,
  saveProfile,
  signOut,
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
  signOut: () => Promise<void>;
}) {
  const router = useRouter();
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

  // 誕生日の自己変更は2回まで（SEC-01 F-1）。一度設定した誕生日は空にもできない
  const hadBirthDate = !!profile.birthDate;
  const editsUsed = profile.birthDateEdits ?? 0;
  const editsRemaining = Math.max(0, MAX_BIRTHDATE_EDITS - editsUsed);
  const birthDateLocked = hadBirthDate && editsRemaining <= 0;
  const birthDateCleared = hadBirthDate && birthDate === "";
  const canSave = ageValid && !birthDateCleared;

  const handleSave = async () => {
    if (!canSave || busy) return;
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
          <BirthDatePicker
            value={birthDate}
            onChange={setBirthDate}
            disabled={birthDateLocked}
          />
          {birthDateLocked ? (
            <p className="mt-1.5 text-[11px] text-danger">
              誕生日の変更回数の上限（{MAX_BIRTHDATE_EDITS}回）に達しています。
              変更が必要な場合は管理者にお問い合わせください
            </p>
          ) : birthDateCleared ? (
            <p className="mt-1.5 text-[11px] text-danger">
              誕生日は空にできません
            </p>
          ) : !ageValid && birthDate !== "" ? (
            <p className="mt-1.5 text-[11px] text-danger">
              5〜120歳になる誕生日を入力してください
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-muted">
              年齢に合わせてAIの言葉づかいを調整します
              {hadBirthDate &&
                `（あと${editsRemaining}回まで変更できます）`}
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
            disabled={!canSave || busy}
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

          {/* 法務ページへの導線（REL-03/04） */}
          <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-placeholder">
            <Link href="/terms" className="hover:text-muted">
              利用規約
            </Link>
            <span className="opacity-40">·</span>
            <Link href="/privacy" className="hover:text-muted">
              プライバシー
            </Link>
            <span className="opacity-40">·</span>
            <Link href="/contact" className="hover:text-muted">
              お問い合わせ
            </Link>
          </div>

          {/* アカウント削除セクション（REL-02） */}
          <DangerZone router={router} signOut={signOut} />
        </div>
      </div>
    </main>
  );
}

/**
 * アカウント削除セクション（REL-02）。
 * 2段階確認: (1) 「アカウントを削除」ボタンを開く → (2) 「削除」と入力して実行。
 * Cloud Functions で完全削除（プロフィール・マップ・投稿・コメント・Auth）。
 */
function DangerZone({
  router,
  signOut,
}: {
  router: ReturnType<typeof useRouter>;
  signOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canDelete = confirmText === "削除" && !busy;

  const handleDelete = async () => {
    if (!canDelete) return;
    setBusy(true);
    setError(null);
    try {
      const fn = httpsCallable<Record<string, never>, { ok: boolean }>(
        firebaseFunctions(),
        "deleteAccount",
      );
      await fn({});
      // Firestore・Auth が削除済み。onAuthStateChanged が発火する前に
      // 明示的にサインアウトしてローカルの状態をクリアする
      try {
        await signOut();
      } catch {
        // Auth が既に消えているため失敗する可能性があるが、遷移は続行
      }
      router.replace("/");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "アカウントの削除に失敗しました。時間をおいて再度お試しください",
      );
      setBusy(false);
    }
  };

  return (
    <section className="mt-10 rounded-[12px] border border-danger/30 bg-tint-danger/40 p-5">
      <h2 className="mb-1.5 font-display text-[15px] font-bold text-danger">
        アカウントの削除
      </h2>
      <p className="text-[12px] leading-[1.8] text-muted">
        アカウントを削除すると、プロフィール・マインドマップ・コミュニティ投稿・コメント・ブックマークがすべて完全に削除され、復元できません。
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-lift mt-4 rounded-full border border-danger/40 bg-page px-4 py-2 text-[12px] font-bold text-danger hover:bg-tint-danger"
        >
          アカウントを削除する
        </button>
      ) : (
        <div className="mt-4">
          <label className="mb-1.5 block text-[12px] font-bold text-danger">
            確認のため
            <span className="mx-1 font-display">「削除」</span>
            と入力してください
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="削除"
            className="w-full rounded-[10px] border border-danger/40 bg-page px-4 py-2.5 text-[14px] text-ink outline-none placeholder:text-placeholder focus:border-danger focus:ring-2 focus:ring-danger/30"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete}
              className="btn-lift rounded-full bg-danger px-5 py-2 text-[13px] font-bold text-white disabled:opacity-40"
            >
              {busy ? "削除中…" : "完全に削除する"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmText("");
                setError(null);
              }}
              disabled={busy}
              className="btn-lift rounded-full border border-line bg-card px-4 py-2 text-[13px] text-muted"
            >
              キャンセル
            </button>
          </div>
          {error && (
            <div className="mt-3 rounded-[10px] bg-tint-danger px-3 py-2 text-[12px] text-danger">
              {error}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
