# ポータル & 管理ダッシュボード 実装仕様書（引き継ぎ用）

> **この文書だけで実装に着手できることを目標にしています。**
> 新しい Claude セッション（このリポジトリの過去の会話を知らない前提）が
> 読んで、質問なしで実装を始められるように書いています。
> 不明点があれば、まず本書と参照ファイルを読み、それでも決まらない
> 場合のみユーザーに質問してください。

**作成日**: 2026-07-22
**関連**: [TASKS.md](TASKS.md) の REL-03 / REL-04 / REL-05 / REL-06
**前提決定事項**: [RELEASE_ROADMAP.md](RELEASE_ROADMAP.md)、
[プロジェクトメモリー project-phase5-specs.md]（誕生日変更制限など）

---

## 0. 背景・意思決定の経緯

このリポジトリには既に **メインアプリ**（`mindmap-app/`、Next.js 16 +
Firebase）が実装済みで、Phase 1〜5 の機能開発は完了している
（詳細: [UPGRADE_PLAN.md](UPGRADE_PLAN.md)）。

現在は「作る」フェーズから「出す・運用する」フェーズへ移行中で、
[RELEASE_ROADMAP.md](RELEASE_ROADMAP.md) の **Phase A（公開前必須固め）**
に取り組んでいる。その中の REL-03〜06 について、ユーザーと以下の方針を
確定した：

1. **REL-03（利用規約・プライバシー）・REL-04（問い合わせ導線）・
   REL-05（監視ダッシュボード）を1つの「ポータル」として作る**
2. **ただし、メインアプリ（mindmap-app）とは別リポジトリ/別デプロイに
   完全分離する**
   - 理由: メインアプリ内に組み込むとデプロイの独立性が失われ、
     ポータル側の変更がメインアプリのビルド・デプロイに影響してしまう
   - ユーザーの言葉: 「このアプリ内で作成するとデプロイするときに
     面倒な気がします」
3. **ホスティングは Vercel**（メインアプリと同じプロバイダーで統一）
4. 実装は新しい Claude セッションが行う。**このドキュメントが唯一の
   引き継ぎ手段**なので、迷わず実装できる粒度で仕様を書く。

---

## 1. 全体アーキテクチャ

### 1.1 サービス分割

```
┌─────────────────────────────────────────────────────────┐
│ 1. メインアプリ（既存・変更なし）                          │
│    リポジトリ: このリポジトリの mindmap-app/               │
│    URL: https://mindmap.example.com (仮)                  │
│    デプロイ: Vercel プロジェクト A                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 2. ポータルサイト（新規作成）                               │
│    リポジトリ: 新規（下記 1.2 参照）                        │
│    URL: https://mindmap-portal.example.com (仮)            │
│    デプロイ: Vercel プロジェクト B                          │
│    内容:                                                  │
│      - /terms         利用規約（REL-03）                   │
│      - /privacy       プライバシーポリシー（REL-03）         │
│      - /contact       お問い合わせフォーム（REL-04）         │
│      - /admin/*       管理ダッシュボード（REL-05, 認証必須）  │
└─────────────────────────────────────────────────────────┘
```

**ポータルサイトを「公開ページ」と「管理ダッシュボード」に分けず、
同じ Next.js プロジェクト内でルート分割する**（`/admin` 配下だけ認証を
要求する）。理由: 認証必須ページのためだけに3つ目のプロジェクトを作ると
運用が煩雑になり、Firebase 設定・環境変数を2重管理する必要が生じるため。
`/admin` は robots.txt で crawl 拒否し、ミドルウェアで未認証アクセスを
`/login` にリダイレクトする。

### 1.2 新規リポジトリの置き場所

このリポジトリ（`/Users/matsumotohayato/AIマインドマップ/`）の
**直下に `mindmap-portal/` ディレクトリとして新規 Next.js プロジェクトを
作成する**（`mindmap-app/` と兄弟ディレクトリ）。

```
AIマインドマップ/
├── mindmap-app/       ← 既存メインアプリ（触らない）
├── mindmap-portal/    ← 新規作成（この仕様書の対象）
├── TASKS.md
├── RELEASE_ROADMAP.md
└── PORTAL_ADMIN_SPEC.md  ← この文書
```

Vercel へのデプロイ時は `mindmap-portal/` を **Root Directory** に指定した
別の Vercel プロジェクトとして接続する（モノレポの1ディレクトリを
個別プロジェクト化するのは Vercel の標準機能）。

**Git 管理について**: 現状このリポジトリ自体が git 管理されていない
（`git rev-parse --is-inside-work-tree` が失敗する）。ポータル実装前に
まずリポジトリ全体を git 管理下に置くか、`mindmap-portal/` だけ独立した
git リポジトリにするかをユーザーに確認すること（本書では未決定）。

---

## 2. 技術スタック（メインアプリに合わせる）

| 項目 | 選定 | 理由 |
|------|------|------|
| フレームワーク | Next.js 16 (App Router) | メインアプリと統一。`mindmap-app/AGENTS.md` の注意書きを必ず読むこと（破壊的変更あり） |
| 言語 | TypeScript | メインアプリと統一 |
| スタイリング | Tailwind CSS v4 | メインアプリと統一（`mindmap-app/postcss.config.mjs` 参照） |
| 認証 | Firebase Authentication | メインアプリと**同じ Firebase プロジェクト**を使う（ユーザーDBを分けない） |
| データ保存 | Firestore | 問い合わせフォームの送信内容、監視メトリクスのキャッシュなど |
| ホスティング | Vercel | ユーザー指定 |
| メール送信 | Resend または Firebase Extensions (Trigger Email) | 下記 3.2 参照 |

**重要**: `mindmap-app/package.json` の依存バージョンを参考にすること
（`next@^16.2.10`, `react@19.2.4`, `firebase@^12.15.0`, `tailwindcss@^4`,
`typescript@^5`）。バージョンのズレによる予期せぬ挙動を避けるため、
同じメジャーバージョンで揃える。

---

## 3. REL-03: 利用規約・プライバシーポリシー

### 3.1 ページ

- `/terms` — 利用規約
- `/privacy` — プライバシーポリシー

### 3.2 記載すべき内容（メインアプリの実装から逆算した事実ベース）

以下は「今実際にアプリがやっていること」を元にした記載必須項目。
新しい Claude セッションは `mindmap-app/` のコードを実際に確認して
最新状態と齟齬がないか検証してから文面を作成すること。

**収集する個人情報**:
- メールアドレス（Firebase Auth、`mindmap-app/src/types/index.ts` の
  `UserProfile.email`）
- 表示名（`UserProfile.displayName`、未入力時はランダム生成）
- 誕生日（`UserProfile.birthDate`、年齢帯導出のため。UP-06要件で
  5歳〜120歳を許容。設定は自己変更2回まで、以降は管理者対応
  — `mindmap-app/firestore.rules` の `birthDateEditsOk()` 参照）
- プロフィール画像（Google連携時のみ、`UserProfile.photoURL`）
- マインドマップの内容（ノード・エッジのテキスト、コミュニティ投稿）

**AI（Groq）への送信データ**:
- テーマ・ノード内容（マップ作成のためのAI提案・レビュー生成に使用）
- 年齢帯（`ageBand`、粗い区分のみ。生の誕生日は送信しない）
- パーソナリティ設定（`AIPersonality`）
- **個人を特定する情報（氏名・メールアドレス）はAIに送信しない**

**未成年ユーザーについて**:
- 想定利用者は5歳から（`MIN_BIRTHDATE_AGE=5`、
  `mindmap-app/src/lib/ai-persona.ts` 参照）
- コミュニティ投稿・コメントは15歳以上に制限
  （`mindmap-app/firestore.rules` の `canPublish()` 相当のロジック参照）
- 保護者向けの説明を明記する

**データ保持・削除**:
- 匿名（未ログイン）マップは30日で自動削除（既存実装、
  `mindmap-app/src/lib/repo.ts` や関連 Functions を確認）
- アカウント削除機能は **REL-02（別タスク、未実装）**。現時点では
  「削除をご希望の場合は問い合わせ窓口までご連絡ください」という
  手動対応の文言にしておく（REL-02 実装後に自動化の文言へ更新）

**お問い合わせ・削除請求の窓口**: `/contact`（3.4 参照）へのリンク

### 3.3 スタイル

`mindmap-app/DESIGN_SPEC_V2.md` / `DESIGN_SPEC_V2_JP.md` を参照し、
色味・フォント（Satoshi・ティファニーブルー系トークン）をポータル側にも
流用してブランドの一貫性を保つこと。ただし完全一致は不要、法務文書
なので可読性優先のシンプルなレイアウトで良い。

### 3.4 お問い合わせフォーム（REL-04 と連携）

`/contact` は REL-04 で実装するが、`/terms` と `/privacy` の両方から
リンクする。

---

## 4. REL-04: お問い合わせ導線

### 4.1 要件

- `/contact` にフォームを設置
- 項目: 種別（不具合報告 / 削除請求 / その他）・メールアドレス・本文
- 送信後、運営者にメール通知 + Firestore に記録（管理ダッシュボードで
  一覧表示するため）

### 4.2 実装方針

**送信データの保存先**: Firestore の新規コレクション `inquiries/{id}`

```typescript
interface Inquiry {
  id: string;
  category: "bug" | "deletion" | "other";
  email: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: number;
  updatedAt: number;
}
```

このコレクションは **メインアプリの Firebase プロジェクトを共有する**
（新しい Firebase プロジェクトは作らない）。ポータル側の Firestore
アクセス用に、`mindmap-app/firestore.rules` に以下のルールを追記する
必要がある（メインアプリ側の変更が必要になる数少ない箇所）:

```
match /inquiries/{id} {
  allow create: if true; // 未ログインでも問い合わせ可能にする想定
  allow read, update: if isAdmin(); // 管理ダッシュボードのみ閲覧・更新可
}
```

**スパム対策**: reCAPTCHA v3 または簡易なレート制限
（`mindmap-app/src/lib/rate-limit.ts` の実装パターンを流用可能。
ただし今回はポータル側の API Route に実装するので、コードの参照のみで
コピー移植が必要）。

**メール通知**:
- 選定: Resend（[resend.com](https://resend.com)、Vercel との相性が良く
  無料枠あり）を推奨。ユーザーの承認を得てから API キーを取得する
  必要がある（これは実装セッションでユーザーに確認すること）
- 代替案: Firebase Extensions の "Trigger Email from Firestore" を使えば
  Firestore 書き込みをトリガーにメール送信でき、送信ロジックを
  ポータル側に持たなくて済む。**この代替案の方がインフラがシンプルなので
  優先的に検討すること**

### 4.3 UI

シンプルな1ページフォーム。送信後は成功メッセージを表示。
バリデーション: email形式チェック、本文の最大文字数制限（例: 2000字）。

---

## 5. REL-05: 管理ダッシュボード（システム監視）

### 5.1 認証・アクセス制御

- パス: `/admin/*`
- 認証: メインアプリと同じ Firebase Authentication
- 認可: **Firebase カスタムクレーム `admin: true`** を持つユーザーのみ
  アクセス可能

  **重要**: `mindmap-app/src/types/index.ts` の `UserProfile.role`
  （`"user" | "admin"`）は Firestore 上の**表示用フィールド**であり、
  実際のセキュリティ強制は `mindmap-app/firestore.rules` の
  `isAdmin()` 関数が見ている **カスタムクレーム**
  （`request.auth.token.admin == true`）で行われている
  （Admin SDK の `setCustomUserClaims` でのみ設定可能、クライアントからは
  変更不可）。ポータル側の管理者判定も **必ずカスタムクレームを見ること**。
  `role` フィールドだけを見て認可判断をしてはいけない
  （なりすまし・改ざんのリスクがあるため）。

- 実装: Next.js Middleware または各ページの `getServerSideProps` 相当
  （App Router なので Server Component 内でのトークン検証）で、
  Firebase Admin SDK を使いIDトークンの `admin` カスタムクレームを検証する。
- 未認証・非管理者アクセスは `/login` にリダイレクト。
- `/admin` 配下は `robots.txt` で `Disallow` にする。

### 5.2 監視項目（ダッシュボードに表示する内容）

| カテゴリ | 表示内容 | データソース |
|----------|----------|--------------|
| **Vercel** | メインアプリのデプロイ状態・直近のビルド結果 | Vercel API（[Vercel REST API](https://vercel.com/docs/rest-api)、要 Vercel API トークン） |
| **Firebase使用量** | Firestore読み書き回数・ストレージ使用量 | Firebase Admin SDK では取得不可。Google Cloud Monitoring API 経由、または Firebase コンソールへのリンクで代替（実装コスト次第で判断） |
| **Groq API使用量** | 直近のAPI呼び出し数・キャッシュ命中率 | メインアプリ側で使用ログをFirestoreに記録する仕組みが**現状ない**。実装するなら Cloud Functions 側（`mindmap-app/functions/src/index.ts`）にログ記録を追加する必要がある（スコープ外なら「未実装」として表示） |
| **アプリ利用状況** | ユーザー数・マップ作成数・コミュニティ投稿数 | Firestore の各コレクションを `count()` クエリで集計（`users`, `maps`, `posts`） |
| **エラー** | 直近のエラー | 現状 Sentry 等未導入（REL-09で対応予定）。この段階では「エラートラッキング未導入」の注記のみで良い |
| **お問い合わせ** | REL-04 の `inquiries` コレクション一覧・ステータス変更 | Firestore `inquiries` コレクション |

**優先実装順序（重要）**:
1. **お問い合わせ管理**（`inquiries` の一覧・ステータス更新）— 確実に
   価値があり、データソースも明確
2. **アプリ利用状況の基本集計**（ユーザー数・マップ数・投稿数）—
   Firestore `count()` で実装容易
3. Vercel API 連携（デプロイ状態）— API トークンの取得が必要なので
   ユーザー確認してから着手
4. Groq/Firebase の詳細コスト監視 — 実装コストが高いため、
   後回しでよい。まずは「Firebase Console」「Groq Console」への
   外部リンク集で代替することを推奨

このタスクは**一度に全部作ろうとせず、優先順位順に段階実装すること**。
特に3・4は外部APIキーの取得がユーザー作業として発生するため、
実装前に必ずユーザーに確認する（Notion連携の二の舞にしないこと。
今回のセッションでは「難しそうなので後で」と見送られた経緯がある
[[project-notion-sync-setup]]）。

### 5.3 UI

- ダッシュボードトップ: カード形式でカテゴリごとのサマリー表示
- お問い合わせ管理: テーブル形式、ステータスフィルタ、詳細モーダル
- チャートライブラリ: 必要なら `recharts`（軽量・メインアプリでは
  未使用だが `mindmap-app/src/components/mindmap/AIRatioChart.tsx` の
  ようにSVG手書きでも十分な場合はライブラリ追加不要）

---

## 6. REL-06: 本番セキュリティ有効化との関係

REL-06（App Check・予算アラート・レートリミット再検証）は
**メインアプリ側**の作業であり、ポータルとは直接関係しないが、
以下の点でポータル実装時に考慮が必要:

- ポータルの `/contact` API Route にもレートリミットを実装する
  （4.2 参照）
- Firebase App Check を有効化する場合、ポータル側もクライアント設定に
  reCAPTCHA site key の追加が必要になる可能性がある

REL-06 自体の詳細は [RELEASE_ROADMAP.md](RELEASE_ROADMAP.md) の
該当セクションを参照。ポータル実装のスコープには含めない。

---

## 7. 環境変数（新規 `mindmap-portal/.env.local`）

```bash
# Firebase（メインアプリと同じプロジェクトの値を使う）
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin SDK（サーバー専用、管理ダッシュボードの認可検証に必要）
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# メール送信（4.2 で選定した方式に応じて）
RESEND_API_KEY=

# Vercel API 連携（5.2 の該当機能を実装する場合のみ）
VERCEL_API_TOKEN=
VERCEL_PROJECT_ID=
```

`mindmap-app/.env.local` の Firebase 設定値（`NEXT_PUBLIC_FIREBASE_*`）を
**そのままコピーして使う**（同じFirebaseプロジェクトを共有するため）。
値は `mindmap-app/.env.local` に実在するが、本書には転記しない
（秘密情報のため）。実装者はユーザーに直接確認するか、ローカルの
当該ファイルを参照すること。

**Firebase Admin SDK の秘密鍵**: サービスアカウントの秘密鍵が必要。
Firebase コンソール → プロジェクト設定 → サービスアカウント から
新規生成できる。メインアプリの Cloud Functions
（`mindmap-app/functions/`）で既に Admin SDK を使っているはずなので、
そちらの認証情報の取得方法を参考にできる可能性がある
（Functions は自動的にサービスアカウントが割り当てられるため、
ポータル用に別途キーを発行する必要がある点に注意）。

---

## 8. 実装ステップ（推奨順序）

新しい Claude セッションはこの順序で進めることを推奨する。
各ステップの完了時にユーザーに報告し、次に進んでよいか確認すること
（ユーザーは過去に「1タスクごとに指示を待つ」進め方を好む傾向がある
— [[project-phase5-specs]] 参照）。

1. **プロジェクト初期化**: `mindmap-portal/` を `create-next-app` で作成
   （Next.js 16 / TypeScript / Tailwind v4 / App Router）。
   `mindmap-app/AGENTS.md` の注意書き（Next.js の破壊的変更）を確認し、
   同じ注意書きを `mindmap-portal/AGENTS.md` にも設置する。
2. **Firebase接続確認**: メインアプリと同じプロジェクトに接続できることを
   確認（Auth・Firestoreの疎通テスト）
3. **REL-03**: `/terms`・`/privacy` の静的ページ実装
4. **REL-04**: `/contact` フォーム + `inquiries` コレクション + メール通知
   （メール送信方式はユーザーに確認してから決定）
5. **REL-05 (優先度1)**: `/admin` 認証基盤 + お問い合わせ管理画面
6. **REL-05 (優先度2)**: アプリ利用状況の基本集計表示
7. **REL-05 (優先度3以降)**: Vercel API連携等は、必要なAPIキー取得を
   ユーザーに依頼してから着手
8. **Vercel デプロイ設定**: 新規 Vercel プロジェクトとして接続、
   環境変数登録、ドメイン設定（本番ドメイン確定は REL-05 の
   本体である [RELEASE_ROADMAP.md](RELEASE_ROADMAP.md) の
   Vercelドメイン名未決定事項と合わせて確認）

---

## 9. 未決定事項（実装前にユーザーに確認すべきこと）

- [ ] リポジトリの git 管理方針（1.2 参照。現状 git 管理されていない）
- [ ] ポータルの本番ドメイン名（例: `portal.mindmap.example.com` など）
- [ ] メール送信サービスの選定（Resend か Firebase Extensions か）と
      APIキー取得
- [ ] Vercel API 連携（デプロイ状態監視）をどこまでやるか
- [ ] 会社名・運営者名・問い合わせ用の実メールアドレス
      （利用規約・プライバシーポリシーに記載する実際の連絡先情報。
      本書では仮の情報しか書けない）

---

## 10. 参照ファイル一覧

実装時に参照すべきメインアプリのファイル:

- `mindmap-app/src/types/index.ts` — `UserProfile`, その他の型定義
- `mindmap-app/src/lib/firebase.ts` — Firebase初期化パターン
- `mindmap-app/firestore.rules` — セキュリティルール（`isAdmin()` 等）
- `mindmap-app/src/lib/rate-limit.ts` — レートリミット実装パターン
- `mindmap-app/src/lib/ai-persona.ts` — 年齢帯定数
  （`MIN_BIRTHDATE_AGE` 等）
- `mindmap-app/DESIGN_SPEC_V2.md` / `DESIGN_SPEC_V2_JP.md` — デザイン
  トークン（色・フォント）
- `mindmap-app/AGENTS.md` — Next.js の破壊的変更に関する注意書き
  （**新規プロジェクトでも必読**）
- [TASKS.md](TASKS.md) — REL-03〜06 のタスク定義
- [RELEASE_ROADMAP.md](RELEASE_ROADMAP.md) — Phase A 全体の文脈
