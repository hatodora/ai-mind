import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from "firebase/app-check";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getFunctions, type Functions } from "firebase/functions";

/**
 * Firebase クライアント初期化。
 * NEXT_PUBLIC_FIREBASE_* はクライアント公開前提の識別子であり、
 * 実際のアクセス制御は Firestore セキュリティルールと
 * Cloud Functions 側の IDトークン検証で行う（SEC-01/SEC-05）。
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // 利用状況モニタリング（REL-10）。未設定なら計測は行われない
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId);
}

/**
 * App Check（REL-06）の reCAPTCHA v3 サイトキー。
 * 設定されている場合のみ App Check を有効化する。
 * これはブラウザに露出する前提の公開キーで、秘密情報ではない。
 */
const appCheckSiteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;

/**
 * ローカル開発・プレビュー用のデバッグトークン（REL-06）。
 * Firebase コンソールの App Check にこのトークンを登録すると、
 * reCAPTCHA を通さずに検証を通過できる。本番では設定しないこと。
 */
const appCheckDebugToken =
  process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN;

export function isAppCheckConfigured(): boolean {
  return Boolean(appCheckSiteKey);
}

let app: FirebaseApp | null = null;
let appCheck: AppCheck | null = null;

/**
 * App Check を初期化する（REL-06）。
 * サイトキー未設定なら何もしない＝App Check 導入前でもアプリは動く。
 * Functions 側の enforceAppCheck を true にするのは、
 * このキーを本番に設定してからにすること（SECURITY_PRODUCTION.md 参照）。
 */
function setupAppCheck(firebaseApp: FirebaseApp): void {
  // App Check はブラウザ専用（reCAPTCHA が window を要求する）
  if (typeof window === "undefined") return;
  if (appCheck || !appCheckSiteKey) return;
  if (appCheckDebugToken) {
    // Firebase SDK はこのグローバルを見てデバッグモードに入る
    (
      window as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }
    ).FIREBASE_APPCHECK_DEBUG_TOKEN = appCheckDebugToken;
  }
  try {
    appCheck = initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      // 期限切れ前に自動でトークンを更新する
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    // App Check の失敗でアプリ全体を落とさない（未登録ドメイン等）
    console.error("App Check の初期化に失敗しました", e);
  }
}

function getApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase の環境変数が設定されていません（.env.local を確認）",
    );
  }
  if (!app) {
    app = getApps()[0] ?? initializeApp(config);
    // Auth / Firestore / Functions を使う前に App Check を立ち上げる
    setupAppCheck(app);
  }
  return app;
}

export function firebaseAuth(): Auth {
  return getAuth(getApp());
}

export function firebaseDb(): Firestore {
  return getFirestore(getApp());
}

export function firebaseFunctions(): Functions {
  // Cloud Functions のリージョンは asia-northeast1（東京）に統一
  return getFunctions(getApp(), "asia-northeast1");
}

/** 計測（REL-10）が設定されているか。measurementId が無ければ計測しない */
export function isAnalyticsConfigured(): boolean {
  return Boolean(config.measurementId && isFirebaseConfigured());
}

/** 計測用に Firebase App を取得する。未設定なら null（呼び出し側で握りつぶす） */
export function firebaseAppForAnalytics(): FirebaseApp | null {
  if (!isAnalyticsConfigured()) return null;
  try {
    return getApp();
  } catch {
    return null;
  }
}
