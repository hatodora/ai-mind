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
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  firebaseAuth,
  firebaseDb,
  isFirebaseConfigured,
} from "@/lib/firebase";
import { createFirestoreRepo, localRepo, setRepo } from "@/lib/repo";
import { DEFAULT_ASSIST_LEVEL } from "@/lib/gauge";
import { DEFAULT_PERSONALITY, MAX_BIRTHDATE_EDITS } from "@/lib/ai-persona";
import type { AIPersonality, AssistLevel, UserProfile } from "@/types";

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
  }) => Promise<void>;
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

  const loadProfile = useCallback(async (u: User) => {
    const snap = await getDoc(doc(firebaseDb(), "users", u.uid));
    setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsub = onAuthStateChanged(firebaseAuth(), async (u) => {
      setUser(u);
      if (u) {
        // メール確認済みユーザーのみ Firestore を使う（ルール側と整合）
        setRepo(u.emailVerified ? createFirestoreRepo(u.uid) : localRepo);
        try {
          await loadProfile(u);
        } catch {
          setProfile(null);
        }
      } else {
        setRepo(localRepo);
        setProfile(null);
      }
      setInitializing(false);
    });
    return unsub;
  }, [loadProfile]);

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
        role: profile?.role ?? "user",
        createdAt: profile?.createdAt ?? now,
        updatedAt: now,
      };
      await setDoc(doc(firebaseDb(), "users", u.uid), next);
      setProfile(next);
    },
    [profile],
  );

  const needsVerification = !!user && isPasswordUser(user) && !user.emailVerified;
  const needsProfile = !!user && !needsVerification && !profile;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        initializing,
        needsVerification,
        needsProfile,
        signInGoogle,
        signUpEmail,
        signInEmail,
        signOut,
        resendVerification,
        refreshUser,
        saveProfile,
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
