import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
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
};

export function isFirebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId);
}

let app: FirebaseApp | null = null;

function getApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase の環境変数が設定されていません（.env.local を確認）",
    );
  }
  if (!app) {
    app = getApps()[0] ?? initializeApp(config);
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
