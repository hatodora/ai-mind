# 🧠 AIマインドマップ — 思索 / Mindmap

> 人間の脳で考えよう。行き詰まったらAIと対話して想像を膨らませよう。

ユーザーとAIが1ターンずつ交互にアイデアを出し合うマインドマップWebアプリ。

## 技術スタック

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS**
- **React Flow** — マインドマップUI
- **Zustand** — 状態管理
- **Firebase** — Authentication（Google / メール+確認メール必須）・Firestore・Cloud Functions
- **Groq API** (`llama-3.3-70b-versatile`) — AI提案・説明・レビュー
- **デザイン**: Satoshi（見出し）× Noto Sans JP、ダークモダン × ティファニーブルー

## ローカル開発

```bash
npm install
npm run dev
```

`.env.local` に以下を設定します（値は Firebase コンソール → プロジェクト設定 → マイアプリ）:

```bash
GROQ_API_KEY=...                              # ローカルAPIルート用
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
# Cloud Functions デプロイ後に有効化（AI呼び出しを Functions 経由に切替）
# NEXT_PUBLIC_AI_BACKEND=functions
```

http://localhost:3000 で起動します。

## データの保存先

| 状態 | 保存先 | 備考 |
|------|--------|------|
| 未ログイン | localStorage | 端末のみ・**最終更新から30日で自動削除** |
| ログイン済み | Firestore `maps/{mapId}` | ログイン時にローカルマップの取り込みを案内 |

## 認証（INFRA-02）

- **Google ログイン** / **メール+パスワード**（8文字以上）
- メール登録は**確認メールのリンククリックが必須**（2段階確認）。完了までクラウド機能は使えない
- プロフィール: **年齢は必須**（年齢別AI応答 UP-06 で使用）、表示名は任意（未入力はランダム生成）、アバターは任意

## Firebase デプロイ手順

事前に `npm i -g firebase-tools` と `firebase login` を済ませること。

```bash
# 1. Firestore ルールとインデックス
firebase deploy --only firestore

# 2. Cloud Functions（Groq キーを Secret Manager に登録してから）
firebase functions:secrets:set GROQ_API_KEY
cd functions && npm install && cd ..
firebase deploy --only functions

# 3. クライアントを Functions 経由に切替
echo "NEXT_PUBLIC_AI_BACKEND=functions" >> .env.local
```

> **注意**: Cloud Functions から外部API（Groq）を呼ぶには **Blaze プラン**（従量課金）が必要です。
> Firebase コンソールで Authentication → Sign-in method から **Google** と **メール/パスワード** を有効化してください。

### セキュリティ設計（SEC-01/02/04/05）

- `firestore.rules`: デフォルト全拒否・フィールド単位の型/桁検証・メール確認済みユーザーのみ書込可
- 将来の共有機能に対応済み: `visibility (private/shared/public)` + `sharedWith {uid: viewer|editor}`
- 開発・運用者は **admin カスタムクレーム**で別権限（`setCustomUserClaims` で付与、クライアントから変更不可）
- Cloud Functions: IDトークン自動検証＋メール確認必須＋**1時間30回のレートリミット**＋**応答キャッシュ**（説明30日/提案・レビュー1日）でAPI呼び出しを節約

## 主な機能

| 機能 | 説明 |
|------|------|
| テーマ設定 | 中心テーマを1つ決めてマインドマップ開始 |
| ターン制 | ユーザー → AI の順で交互にノード追加 |
| AIゲージ | 自分で考えるとAIに相談できるトークン制（UP-02） |
| AI提案 | 選択ノードから派生するアイデアを2〜3個提案 |
| わからない | ノードを小学生でも分かる言葉で解説 |
| AIレビュー | マップ全体を見て次のアクションを提案 |
| 整える | ノードをツリー状に自動整列（UP-05） |
| 行き詰まり検知 | 45秒無操作でAIサポート導線を表示（NF-04） |
| ログイン | Google / メール（確認必須）、マップをクラウド保存 |

## 開発状況

- [x] Phase 0: 全体レビュー・バグ修正
- [x] UIリデザイン v2（Satoshi × ティファニーブルー × ダークモダン）
- [x] Phase 2: AIトークンゲージ（UP-02）
- [x] Phase 1: Firebase（Firestore・認証・Cloud Functions・移行ツール）※デプロイは手動手順
- [ ] Phase 3: ゲーミフィケーション・リング・AIパーソナリティ・年齢別応答
- [ ] Phase 4: コミュニティ・3D表現・レビュー深掘り・カテゴリ診断
- [ ] Phase 5: セキュリティ横断監査
- [ ] Phase 6: ネイティブアプリ化
