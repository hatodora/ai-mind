# AIマインドマップ タスク管理

> Shape UP形式で、フェーズと進捗を一元管理

**最終更新**: 2026-07-28  
**リポジトリ**: mindmap-app  
**Notion 同期**: 有効（GitHub Actions）

---

## 📊 進捗サマリー

| フェーズ | 状態 | 完了数 | 合計 | 進捗率 |
|---------|------|--------|------|--------|
| **Phase A** | In Progress | 2/6 | 6 | 33% |
| **Phase B** | Complete | 2/2 | 2 | 100% |
| **Phase C** | Complete（コード完成、外部設定待ち） | 3/3 | 3 | 100% |
| **Phase D** | On Hold | 0/∞ | - | - |
| **実装済み** | Complete | 48/48 | 48 | 100% |

---

## 🚀 **即時アクション: 本番公開前の残タスク**

### ✅ コード側は完成 → 外部サービス設定が必須

| No. | タスク | 担当 | 期限 | 用途 |
|-----|--------|------|------|------|
| **1** | **Sentry アカウント作成** | **You** | 本番前 | エラー収集（REL-09） |
| **2** | **Firebase Analytics 連携** | **You** | 本番前 | 利用状況計測（REL-10） |
| **3** | **Vercel Root Directory 設定** | **You** | デプロイ時 | Next.js ビルド必須 |
| **4** | **ポータル・管理ダッシュボード完成** | **You** | Phase A 完了後 | ユーザー・運用画面（REL-03〜05） |
| **5** | **Firestore / Cloud Functions デプロイ** | **Claude** | コード + 外部設定後 | 本番ルール・AI 機能の確定 |
| **6** | **本番ドメイン確認・承認済みドメイン登録** | **You** | デプロイ直前 | ログイン有効化（必須） |

---

## 🔧 **Your Action Items（優先順）**

### ステップ1: Sentry 設定（30分）
```
1. sentry.io でアカウント作成
2. 新しい Next.js プロジェクト作成
3. DSN をコピー → Vercel 環境変数に設定
4. SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN も取得（ソースマップ送信用・任意）
```

### ステップ2: Firebase Analytics 連携（20分）
```
1. Firebase コンソール → プロジェクト設定 → 全般
2. ウェブアプリ下部に「Google Analytics を有効にする」（未設定ならクリック）
3. measurementId（G-XXXXXXXXXX）をコピー → Vercel 環境変数に設定
```

### ステップ3: Vercel デプロイ準備（10分）
```
1. https://vercel.com/new で GitHub リポジトリを Import
2. Root Directory = mindmap-app に設定（必須！）
3. 環境変数を登録（下表）
4. Deploy（CI が緑なら通る）
```

### ステップ4: ドメイン確認（10分）
```
1. 本番ドメイン決定 → Firebase コンソール → Authentication → Settings → 承認済みドメイン
   に追加
2. Vercel → Settings → Domains で同じドメインを追加
3. ログインテスト（本番ドメインで実際にログインできるか）
```

### ステップ5: Cloud Functions / Firestore ルールのデプロイ
```
前提: Sentry DSN と Firebase Analytics measurementId が Vercel に設定済み
実行:
  cd mindmap-app
  firebase deploy --only firestore:rules,functions
```

---

## 📋 **Vercel 環境変数チェックリスト**

下表の値を Vercel → Settings → Environment Variables に登録。
詳細は [mindmap-app/.env.local.example](mindmap-app/.env.local.example) 参照。

| 変数 | 状態 | 値の出典 |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` 他 6個 | 必須 | Firebase コンソール → プロジェクト設定 → ウェブアプリ |
| `NEXT_PUBLIC_AI_BACKEND` | 必須 | 値: `functions` （既定） |
| `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` | ✅ 設定済み | reCAPTCHA コンソール（ユーザー取得済み） |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | ⬜ You設定待ち | Firebase Analytics 連携時に生成 |
| `NEXT_PUBLIC_SENTRY_DSN` | ⬜ You設定待ち | Sentry プロジェクト設定 |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | 任意 | Sentry（ソースマップ送信・未設定でもビルド通る） |

---

## 🎯 Phase A: 公開前必須固め

**Pitch**: アプリを一般公開する前に、法務・インフラ・ユーザーサポートの土台を整える。  
**Ambition**: Large | **Scope**: 1ヶ月～ | **Cycle**: 2週間ずつ

### REL-01: F-1（誕生日の変更制限）✅ COMPLETED
- **Status**: Completed
- **Due Date**: 2026-07-18
- **Assigned To**: Claude
- **Scope**: 誕生日を2回まで自己変更可。3回目以降は管理者へ。Firestore rules + BirthDatePicker UI
- **Implementation**: 
  - `UserProfile.birthDateEdits` 追加
  - rules の `birthDateEditsOk()` で回数チェック
  - `BirthDatePicker.tsx` コンポーネント（年月日セレクト）
  - settings ページに残り変更回数表示
- **Known Gaps**: None
- **Notes**: うるう年の自動クランプ・既存誕生日の消去禁止も実装済み

### REL-02: アカウント削除機能 ✅ COMPLETED
- **Status**: Completed
- **Due Date**: 2026-07-24
- **Assigned To**: Claude
- **Scope**: ユーザーが退会時に Auth + profile + bookmarks + maps/posts/comments を完全削除
- **Ambition**: Medium
- **Implementation**:
  - Cloud Function `deleteAccount`（asia-northeast1）で所有マップ・共有マップからの離脱・自投稿+コメント・他人投稿への自コメント（commentCount 減算含む）・bookmarks/private サブコレ・users/{uid}・Auth ユーザーを一括削除
  - 設定画面下部に「アカウント削除」セクション（2段階確認：ボタン開閉→「削除」入力）
  - **合わせて REL-03 の一部実装**: `/terms`, `/privacy`, `/contact` ページ、TERMS_VERSION による再合意フロー、setup ページの合意チェックボックス、Firestore rules に inquiries コレクション追加
- **Known Gaps**: None（投稿は完全削除で確定）
- **Notes**: 削除方針は「完全削除」で確定（コメントも残さず消す）

### REL-03〜05: ポータルサイト（統合実装・別リポジトリ）
- **Status**: Spec Ready（実装待ち）
- **Due Date**: TBD
- **Assigned To**: Claude（新規セッション）
- **Scope**:
  - REL-03: 利用規約・プライバシーポリシー（`/terms`, `/privacy`）
  - REL-04: お問い合わせ導線（`/contact` フォーム + メール通知）
  - REL-05: 管理ダッシュボード（`/admin/*`、システム監視・お問い合わせ管理）
  - メインアプリ（mindmap-app）とは**別 Vercel プロジェクト**に分離
    （`mindmap-portal/` を兄弟ディレクトリとして新規作成）
  - Firebase プロジェクトはメインアプリと共有（ユーザーDBを分けない）
- **Ambition**: Large
- **Known Gaps**: 
  - git 未管理（リポジトリ管理方針を先に決める必要あり）
  - 本番ドメイン名未決定
  - メール送信サービス未選定（Resend or Firebase Extensions）
  - Vercel API 連携の要否未確認
- **Notes**: **詳細仕様は [PORTAL_ADMIN_SPEC.md](docs/PORTAL_ADMIN_SPEC.md) に
  分離**（新しい Claude セッションが単独で実装着手できる粒度で記述済み）。
  管理者判定は Firestore の `role` フィールドではなく Firebase カスタム
  クレーム（`admin: true`）で行うこと。段階実装を推奨（お問い合わせ管理
  → 利用状況集計 → Vercel/Groq連携の順）。

### REL-06: 本番セキュリティ有効化 🟡 実装完了・手動設定待ち
- **Status**: Code Ready（コンソール作業待ち）
- **Due Date**: 2026-07-27（実装分）
- **Assigned To**: Claude（実装）/ You（コンソール作業）
- **Scope**:
  - Firebase App Check（reCAPTCHA v3）を有効化
  - Groq・Firebase の予算アラート設定
  - レートリミット本番再検証
- **Ambition**: Medium
- **Implementation**（すべて既定は無効・段階導入できる形）:
  - App Check クライアント初期化（`src/lib/firebase.ts`）。
    `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` を設定したときだけ有効化。
    ローカル用のデバッグトークンにも対応
  - Functions の `enforceAppCheck` を `ENFORCE_APP_CHECK` で切替（既定 false）
  - **未認証AI経路（`/api/ai/*`）を本番で遮断**（`src/lib/ai-guard.ts`）。
    認証なしで Groq を叩ける穴を塞ぐ。`AI_PUBLIC_FALLBACK` で明示的に開閉可
  - レートリミット強化: 1ユーザー日次上限（120）＋
    **全体日次サーキットブレーカー**（3000）＋ API Routes のプロセス全体上限（300/h）
  - `system/{docId}` を rules で完全遮断（全体カウンタの残量漏れ防止）
  - 環境変数テンプレート（`.env.local.example` / `functions/.env.example`）
- **検証済み**:
  - 本番モードで `/api/ai/{suggest,review,explain}` → 403
  - `AI_PUBLIC_FALLBACK=on` で 200（明示解放が効く）
  - 全体上限3に対し4回目から 429
  - 開発モードは従来どおり 200
  - lint / build / functions tsc / ブラウザ（コンソールエラーなし）
- **Known Gaps**（ユーザー作業が必要）:
  - reCAPTCHA v3 キー取得 → Firebase App Check 登録 → 数日監視 → 強制ON
  - GCP 予算アラート（50/90/100%）
  - Groq の使用量アラート・上限
  - 未ログインでも AI を使わせるかの製品判断（既定は本番で不可）
- **Notes**: **手順は [SECURITY_PRODUCTION.md](docs/SECURITY_PRODUCTION.md) に集約**。
  コード側の上限が「止める」役、予算アラートが「気づく」役で、両方必要。

---

## 🔬 Phase B: 品質保証体制

**Pitch**: 自動テストと CI で、機能変更時に自動的に壊れたところを検出する。  
**Ambition**: Large | **Scope**: 2週間～ | **Cycle**: 1週間ずつ

### REL-07: 最小限の自動テスト ✅ COMPLETED
- **Status**: Completed
- **Due Date**: 2026-07-27
- **Assigned To**: Claude
- **Scope**: 
  - `gauge.ts` / `ai-validate.ts` / `merge.ts` の単体テスト
  - Firestore rules のユニットテスト（@firebase/rules-unit-testing）
  - 主要フロー（作成→テーマ入力→マップ作成→ルートノード表示）の E2E テスト
- **Ambition**: Large
- **Implementation**:
  - Vitest 導入（`vitest.config.ts`）。`gauge.test.ts`（27件）・
    `ai-validate.test.ts`（20件）・`merge.test.ts`（16件）で計63件、
    AIゲージ計算・入力検証・共同編集マージの分岐を網羅
  - Firestore rules テスト（`firestore-tests/rules.test.ts`）を
    `@firebase/rules-unit-testing` で作成。users/maps/posts/comments/
    inquiries/invites/aiCache/system の主要な許可・拒否パターンを検証
    （誕生日2回制限・role昇格禁止・15歳未満投稿禁止・なりすまし禁止・
    system完全遮断＝REL-06 で追加した全体レートリミットの残量隠蔽など）
  - Playwright 導入。`e2e/golden-path.spec.ts` でホーム→新規作成→
    ルートノード表示・利用規約/プライバシー（未ログインOK）・
    お問い合わせ（未ログイン→ログイン誘導）・存在しないマップの
    404相当表示を検証
- **検証済み**: `npm test`（63件）・`npm run test:e2e`（6件）はローカルで
  全件パス。`npm run test:rules` はローカルにJavaが無く未実行
  （CI で確認、REL-08 参照）
- **Known Gaps**: ログイン必須フロー（AI提案・レビュー・共有・
  コミュニティ）のE2Eは、Firebase Authエミュレータ連携が必要なため未着手
- **Notes**: Playwright を採用

### REL-08: CI 導入 ✅ COMPLETED
- **Status**: Completed
- **Due Date**: 2026-07-27
- **Assigned To**: Claude
- **Scope**: 
  - GitHub Actions で PR ごとに lint → tsc → build → test を自動実行
  - Firestore rules エミュレータ検証
- **Ambition**: Medium
- **Implementation**: `.github/workflows/ci.yml`（リポジトリルート）に
  5ジョブを並列実行:
  - `lint-typecheck-build`: eslint → tsc → next build
  - `functions-typecheck`: Cloud Functions の tsc
  - `unit-test`: vitest（gauge/ai-validate/merge）
  - `rules-test`: `actions/setup-java` で Java 導入 →
    `firebase emulators:exec` で Firestore rules テスト
    （ローカルでJavaが無かった問題を CI 側で解決）
  - `e2e-test`: Playwright（失敗時はレポートをArtifactでアップロード）
  - `mindmap-app/**` の変更時のみ起動するようpathフィルタ設定
- **Known Gaps**: None
- **Notes**: 本番の Firebase 設定値は使わず、ビルド用のダミー環境変数で
  CI を通す（`isFirebaseConfigured()` により未設定でもビルド自体は失敗しない設計）

---

## 🚀 Phase C: 運用・監視体制

**Pitch**: 本番環境で問題が起きたときに、気づいて対応できる体制を作る。  
**Ambition**: Large | **Scope**: 1週間～ | **最後に完了したら一般公開可**

### REL-09: エラートラッキング 🟡 実装完了・DSN設定待ち
- **Status**: Code Ready（Sentry アカウント作業待ち）
- **Due Date**: 2026-07-28（実装分）
- **Assigned To**: Claude（実装）/ You（Sentry 登録）
- **Scope**: Sentry を導入し、クライアント・サーバー・Functions の例外を収集
- **Ambition**: Medium
- **Implementation**（REL-06 と同じ「既定は完全無効」）:
  - `src/lib/observability.ts` — DSN 未設定なら SDK を読み込まない。
    環境名・リリースは Vercel / Netlify の環境変数から自動判別
  - `src/instrumentation.ts` — サーバー例外（`onRequestError`）
  - `src/instrumentation-client.ts` — クライアント例外
  - `src/app/global-error.tsx` — ルートレイアウトごと落ちたときの復帰画面
    （Next.js 16 では `reset` ではなく `unstable_retry` を受け取る）
  - `functions/src/observability.ts` — Cloud Functions 側。動的 import で
    無効時のコールドスタート影響をゼロにし、送信後は必ず flush
  - **REL-06 の全体サーキットブレーカー到達を error レベルで通知**
    （＝全利用者のAIが止まった状態を検知できる）
  - Groq 呼び出しの失敗を `generate()` で一括捕捉
- **プライバシー設計**（重要）:
  - `scrubEvent()` でリクエストボディ・Cookie・メールアドレス・IPを送信前に除去。
    このアプリが扱うのは「利用者が考えていることそのもの」なので、
    マップ本文は決してエラーレポートに載せない。単体テストで担保（8件）
  - セッションリプレイは思考内容が映るため無効
- **検証済み**: lint / tsc / build / vitest(75件) / E2E(6件) / ブラウザ表示
- **Known Gaps**: Sentry アカウント作成と DSN 設定（未設定でも動作に影響なし）
- **Notes**: 手順は [DEPLOY.md](docs/DEPLOY.md) 参照

### REL-10: 利用状況モニタリング ✅ COMPLETED
- **Status**: Completed（measurementId 設定で有効化）
- **Due Date**: 2026-07-28
- **Assigned To**: Claude
- **Scope**: Firebase Analytics(GA4) で主要フロー（作成数・AI利用数・完成率・投稿数）を可視化
- **Ambition**: Medium
- **Implementation**:
  - `src/lib/analytics.ts` — measurementId 未設定なら SDK を読み込まない。
    非対応ブラウザ・トラッキング防止拡張でも例外を出さない
  - 計測イベント: `map_created` / `map_completed` / `ai_suggest_used` /
    `ai_explain_used` / `ai_review_used` / `helper_used` /
    `community_post_created`
  - 配線箇所: `mindmap-store`（作成・完成）、`ai-client`（AI 3種の単一経路）、
    `ControlPanel`（お助け機能）、`PublishModal`（投稿）
  - **送るのは件数・割合・設定値のみ。テーマ名やノード本文は型で受け取れない
    ようにして誤送信を防いでいる**
- **Known Gaps**: コスト系（Groq 消費量・Firestore 読み書き）はコンソールで
  目視確認する運用（[DEPLOY.md](docs/DEPLOY.md) の月次チェックに記載）
- **Notes**: 計測とエラー収集の追加はデータの扱いが変わるため、
  プライバシーポリシーに第7〜9章を追加し `TERMS_VERSION` を 2 に上げて再合意を求める

### REL-11: 障害対応の型化 ✅ COMPLETED
- **Status**: Completed
- **Due Date**: 2026-07-28
- **Assigned To**: Claude
- **Scope**: 
  - デプロイ前チェックリスト（REL-05 と統合）
  - ロールバック手順（Vercel・Firestore）
  - 依存パッケージ監査を月次実行
- **Ambition**: Small
- **Implementation**: [DEPLOY.md](docs/DEPLOY.md) に集約
  - Vercel（本番）/ Netlify（予備）の初期設定と環境変数一覧
  - デプロイ前チェックリスト（rules/Functions を先に出す順序を明記）
  - ロールバック手順（Vercel の Promote / Firestore ルール履歴 /
    Functions は前コミット再デプロイ）と症状別の初動表
  - 月次運用（npm audit・Groq/Firebase 使用量・Sentry 棚卸し・GA 確認）
  - よくあるつまずき（`.next/dev` キャッシュ・承認済みドメイン・Root Directory）
- **Known Gaps**: None
- **Notes**: Phase C 完了 ＝ 一般公開の判断ができる状態

### INFRA: Vercel デプロイ環境の整備 ✅ COMPLETED
- **Status**: Completed
- **Due Date**: 2026-07-28
- **Scope**: Netlify に加えて Vercel でもデプロイできるようにする
- **Implementation**: `mindmap-app/vercel.json`（framework: nextjs、
  サーバー関数リージョンを東京 `hnd1` に固定＝Firestore/Functions と同居）。
  Netlify は既存の `netlify.toml`（base = mindmap-app）のまま予備系として維持
- **Known Gaps**: **Vercel 側で Root Directory = `mindmap-app` の設定が必須**
  （`vercel.json` では指定できないダッシュボード設定）

---

## 🌱 Phase D: グロース（方向性のみ）

> 公開後の実データを見てから優先順位を再決定

- **ネイティブアプリ化** (UPGRADE_PLAN.md Phase 6)
- **フリーミアム化** (課金基盤設計・Stripe 連携)
- **SEO・LP 整備**
- **NF-02（3D表現）再検討**
- **通知機能**（お助け機能の再訪促進等）

---

## ✅ 実装済み（参考用）

### Phase 1～5 完了タスク一覧

| # | タスク | 状態 |
|----|--------|------|
| 1 | デザイン基盤（フォント・カラー・アニメーション） | ✅ |
| 2 | ホーム・テーマ設定のリデザイン | ✅ |
| 3 | エディタのリデザイン | ✅ |
| 4 | コントロールパネルのリデザイン | ✅ |
| 5 | UP-02: AIトークンゲージ | ✅ |
| 6 | UP-05: ノード自動整列 | ✅ |
| 7 | NF-04: 行き詰まり検知 | ✅ |
| 8-13 | QA・UIリファイン（v1） | ✅ |
| 14-18 | INFRA-01/02: Firebase・認証・Cloud Functions | ✅ |
| 19 | Phase1 QA | ✅ |
| 20-22 | UP-06/04: 年齢帯・パーソナリティ・AI配線 | ✅ |
| 23-26 | UP-01: バッジ・リング・演出 | ✅ |
| 27 | Phase3 QA | ✅ |
| 28 | Phase4 仕様書 | ✅ |
| 29 | NF-03: レビュー根拠ハイライト | ✅ |
| 30-32 | NF-01a: 共有基盤・UI・リアルタイム同期 | ✅ |
| 33-35 | NF-01b: コミュニティ・ブックマーク | ✅ |
| 36 | Phase4 QA | ✅ |
| 37 | NF-04改: お助け機能＋円グラフ | ✅ |
| 38 | NF-05: トピックカテゴライズ | ✅ |
| 39 | Phase5実装 QA | ✅ |
| 40 | SEC-01: ルール検証＋修正（F-2/3/4） | ✅ |
| 41-47 | SEC-02～08: セキュリティ全検証 | ✅ |
| 48 | F-1実装: 誕生日2回制限＋BirthDatePicker | ✅ |

---

## 📌 メタデータ

**Shape UP概念の定義**:
- **Ambition**: Small（1～2日）/ Medium（1週間）/ Large（2週間～）
- **Scope**: 何をするか（「しない」も含めて明示）
- **Known Gaps**: 既知のリスク・判断保留中の項目

**Notion 同期**:
- GitHub Actions ワークフロー（`.github/workflows/task-sync.yml`）
- TASKS.md 変更時に Notion Database を自動更新
- トークン: `.env.local` に `NOTION_TOKEN` で保管（git 無視）

**参考リンク**:
- [PHASE5_SPEC.md](mindmap-app/PHASE5_SPEC.md) — 実装仕様書
- [RELEASE_ROADMAP.md](docs/RELEASE_ROADMAP.md) — リリース戦略
- [NOTION_SETUP.md](docs/NOTION_SETUP.md) — Notion セットアップ手順
