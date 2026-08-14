"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import {
  firebaseAuth,
  firebaseDb,
  isFirebaseConfigured,
} from "@/lib/firebase";
import { createFirestoreRepo, localRepo, setRepo } from "@/lib/repo";
import { DEFAULT_ASSIST_LEVEL } from "@/lib/gauge";
import { DEFAULT_PERSONALITY, MAX_BIRTHDATE_EDITS } from "@/lib/ai-persona";
import { hasAcceptedCurrentTerms } from "@/lib/terms";
import type { AIPersonality, AssistLevel, UserProfile } from "@/types";
import {
  type MfaClaims,
  isTwoFactorEnabled,
  needsTwoFactor as computeNeedsTwoFactor,
} from "@/lib/two-factor";

/** 表示名未入力時のランダム生成（例: 思索家_k3x9pz） */
export function randomDisplayName(): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `思索家_${suffix}`;
}

interface AuthState {
  /** Firebase 認証ユーザー。null = 未ログイン */
  user: User | null;
  /** users/{uid} のプロフィール。null = 未作成（年齢入力が必要） */
  profile: UserProfile | null;
  /** 認証状態の初期化中 */
  initializing: boolean;
  /** メール/パスワード登録者でメール未確認（2段階目が未完了） */
  needsVerification: boolean;
  /** ログイン済みだがプロフィール（年齢必須）が未登録 */
  needsProfile: boolean;
  /** プロフィールあり ＆ 現行の利用規約に未合意（REL-03。既存ユーザー向けの再合意誘導用） */
  needsTermsAccept: boolean;
  /**
   * 2要素認証を有効にしていて、直近の検証が切れている（MFA-03）。
   * true のあいだ Firestore はルール側で拒否されるので、
   * プロフィールの読み込みも試みない。
   */
  needsTwoFactor: boolean;
  /** 2要素認証を有効にしているか。設定画面の表示に使う */
  twoFactorEnabled: boolean;
  /**
   * IDトークンを取り直してカスタムクレームを読み直す（MFA-03）。
   * 6桁コードを通したあとや、有効／無効を切り替えたあとに呼ぶ。
   */
  refreshClaims: () => Promise<void>;
  signInGoogle: () => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resendVerification: () => Promise<void>;
  /** 確認メールのクリック後に emailVerified を再取得する */
  refreshUser: () => Promise<void>;
  saveProfile: (input: {
    displayName?: string;
    age: number;
    photoURL?: string | null;
    assistLevel?: AssistLevel;
    /** 誕生日（YYYY-MM-DD）。age はここから導出した値を渡す（UP-06） */
    birthDate?: string;
    /** AIパーソナリティ（UP-04） */
    personality?: AIPersonality;
    /** コミュニティで名前を表示するか（NF-01b）。既定 false＝匿名 */
    showNameInCommunity?: boolean;
    /**
     * 利用規約に合意したバージョン（REL-03）。渡すと termsAcceptedAt=now, termsVersion=this
     * が記録される。setup 初回・利用規約再合意時に指定する
     */
    acceptedTermsVersion?: number;
  }) => Promise<void>;
  /**
   * チュートリアル完走をプロフィールへ記録する（TUT-03）。
   * 初回のみ。すでに記録済み・未ログインなら何もしない。
   */
  markTutorialCleared: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function isPasswordUser(user: User): boolean {
  return user.providerData.some((p) => p.providerId === "password");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // Firebase 未設定ならログイン機能ごと無効なので、初期化待ちも不要
  const [initializing, setInitializing] = useState(() => isFirebaseConfigured());
  // カスタムクレーム（MFA-03）。2要素認証の有効・最終検証時刻が入る。
  // Date.now() を描画中に呼ばないよう、判定は読み込んだ時点で済ませて持つ
  const [claims, setClaims] = useState<MfaClaims>({});
  const [mfaPending, setMfaPending] = useState(false);

  const loadProfile = useCallback(async (u: User) => {
    const snap = await getDoc(doc(firebaseDb(), "users", u.uid));
    setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
  }, []);

  /**
   * IDトークンからカスタムクレームを読む（MFA-03）。
   * 2要素認証が要るかどうかは、ここで一度だけ判定して持つ
   * （描画のたびに Date.now() を呼ばないため）。
   */
  const loadClaims = useCallback(
    async (u: User, forceRefresh = false): Promise<boolean> => {
      try {
        const res = await u.getIdTokenResult(forceRefresh);
        const c = res.claims as MfaClaims;
        setClaims(c);
        const pending = computeNeedsTwoFactor(c, Date.now());
        setMfaPending(pending);
        return pending;
      } catch {
        // トークンが読めない状況では、通っていない側に倒す
        setClaims({});
        setMfaPending(false);
        return false;
      }
    },
    [],
  );

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsub = onAuthStateChanged(firebaseAuth(), async (u) => {
      setUser(u);
      if (u) {
        // メール確認済みユーザーのみ Firestore を使う（ルール側と整合）
        if (u.emailVerified) {
          const pending = await loadClaims(u);
          setRepo(createFirestoreRepo(u.uid));
          // 2要素認証が切れている間は、ルール側がすべて拒否する。
          // 読みにいっても permission-denied が返るだけなので試みない
          if (pending) {
            setProfile(null);
          } else {
            try {
              await loadProfile(u);
            } catch {
              setProfile(null);
            }
          }
        } else {
          setRepo(localRepo);
          setProfile(null);
          setClaims({});
          setMfaPending(false);
        }
      } else {
        setRepo(localRepo);
        setProfile(null);
        setClaims({});
        setMfaPending(false);
      }
      setInitializing(false);
    });
    return unsub;
  }, [loadProfile, loadClaims]);

  const signInGoogle = useCallback(async () => {
    await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
  }, []);

  const signUpEmail = useCallback(async (email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(
      firebaseAuth(),
      email,
      password,
    );
    // メールによる2段階目の確認を必須とする（INFRA-02）
    await sendEmailVerification(cred.user);
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(firebaseAuth(), email, password);
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(firebaseAuth());
  }, []);

  const resendVerification = useCallback(async () => {
    const u = firebaseAuth().currentUser;
    if (u) await sendEmailVerification(u);
  }, []);

  const refreshUser = useCallback(async () => {
    const u = firebaseAuth().currentUser;
    if (!u) return;
    await u.reload();
    const fresh = firebaseAuth().currentUser;
    setUser(fresh);
    if (fresh?.emailVerified) {
      setRepo(createFirestoreRepo(fresh.uid));
      await loadProfile(fresh);
    }
  }, [loadProfile]);

  const saveProfile = useCallback(
    async (input: {
      displayName?: string;
      age: number;
      photoURL?: string | null;
      assistLevel?: AssistLevel;
      birthDate?: string;
      personality?: AIPersonality;
      showNameInCommunity?: boolean;
      acceptedTermsVersion?: number;
    }) => {
      const u = firebaseAuth().currentUser;
      if (!u) throw new Error("ログインしていません");
      const now = Date.now();
      // Firestore は undefined を保存できないため、誕生日は判明している時だけ持つ
      const prevBirthDate = profile?.birthDate;
      const birthDate = input.birthDate ?? prevBirthDate;
      // 一度設定した誕生日は空にできない（rules でも強制。クリア→再設定で
      // 下の変更回数制限を回避させないため）
      if (prevBirthDate && !birthDate) {
        throw new Error("誕生日は空にできません");
      }
      // 誕生日の自己変更は2回まで（SEC-01 F-1）。以降は管理者への問い合わせが必要
      const prevEdits = profile?.birthDateEdits ?? 0;
      const birthDateChanged =
        !!prevBirthDate && !!birthDate && birthDate !== prevBirthDate;
      if (birthDateChanged && prevEdits >= MAX_BIRTHDATE_EDITS) {
        throw new Error(
          `誕生日の変更は${MAX_BIRTHDATE_EDITS}回までです。それ以上の変更はお問い合わせください`,
        );
      }
      const birthDateEdits = birthDateChanged ? prevEdits + 1 : prevEdits;
      // 利用規約合意（REL-03）。新規合意があれば now を記録、
      // 未指定なら既存の合意日時・バージョンを維持する
      const termsVersion =
        input.acceptedTermsVersion ?? profile?.termsVersion;
      const termsAcceptedAt =
        input.acceptedTermsVersion !== undefined
          ? now
          : profile?.termsAcceptedAt;
      const next: UserProfile = {
        uid: u.uid,
        email: u.email ?? "",
        displayName: input.displayName?.trim() || randomDisplayName(),
        age: input.age,
        ...(birthDate ? { birthDate, birthDateEdits } : {}),
        photoURL: input.photoURL ?? u.photoURL ?? null,
        assistLevel:
          input.assistLevel ?? profile?.assistLevel ?? DEFAULT_ASSIST_LEVEL,
        personality:
          input.personality ?? profile?.personality ?? DEFAULT_PERSONALITY,
        showNameInCommunity:
          input.showNameInCommunity ?? profile?.showNameInCommunity ?? false,
        ...(termsVersion !== undefined ? { termsVersion } : {}),
        ...(termsAcceptedAt !== undefined ? { termsAcceptedAt } : {}),
        // 保存は全置換なので、この画面が扱わない項目も引き継がないと消える
        ...(profile?.tutorialCompletedAt !== undefined
          ? { tutorialCompletedAt: profile.tutorialCompletedAt }
          : {}),
        role: profile?.role ?? "user",
        createdAt: profile?.createdAt ?? now,
        updatedAt: now,
      };
      await setDoc(doc(firebaseDb(), "users", u.uid), next);
      setProfile(next);
    },
    [profile],
  );

  const markTutorialCleared = useCallback(async () => {
    const u = firebaseAuth().currentUser;
    // 記録できるのはプロフィールを持つ本人だけ。
    // 2回目以降は書かない（ルール側でも上書きを禁じている）
    if (!u || !profile || profile.tutorialCompletedAt !== undefined) return;
    const tutorialCompletedAt = Date.now();
    // 差分更新にして、他の画面が持っている項目を巻き込まないようにする
    await updateDoc(doc(firebaseDb(), "users", u.uid), {
      tutorialCompletedAt,
      updatedAt: Date.now(),
    });
    setProfile({ ...profile, tutorialCompletedAt });
  }, [profile]);

  const refreshClaims = useCallback(async () => {
    const u = firebaseAuth().currentUser;
    if (!u) return;
    const pending = await loadClaims(u, true);
    // 通ったばかりならプロフィールを読みにいく。
    // ここで読まないと «検証は済んだのに未登録扱い» のまま止まる
    if (!pending) {
      try {
        await loadProfile(u);
      } catch {
        setProfile(null);
      }
    }
  }, [loadClaims, loadProfile]);

  const needsVerification = !!user && isPasswordUser(user) && !user.emailVerified;
  // 2要素認証が先。ここを後回しにすると、プロフィールが読めないせいで
  // «未登録» と誤解して初期設定へ飛ばしてしまう
  const needsTwoFactor = !!user && !needsVerification && mfaPending;
  const needsProfile =
    !!user && !needsVerification && !needsTwoFactor && !profile;
  const needsTermsAccept =
    !!user && !needsVerification && !needsTwoFactor
    && !!profile && !hasAcceptedCurrentTerms(profile);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        initializing,
        needsVerification,
        needsProfile,
        needsTermsAccept,
        needsTwoFactor,
        twoFactorEnabled: isTwoFactorEnabled(claims),
        refreshClaims,
        signInGoogle,
        signUpEmail,
        signInEmail,
        signOut,
        resendVerification,
        refreshUser,
        saveProfile,
        markTutorialCleared,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth は AuthProvider の内側で使ってください");
  return ctx;
}
