# AIマインドマップ タスク管理

> Shape UP形式で、フェーズと進捗を一元管理

**最終更新**: 2026-07-27  
**リポジトリ**: mindmap-app  
**Notion 同期**: 有効（GitHub Actions）

---

## 📊 進捗サマリー

| フェーズ | 状態 | 完了数 | 合計 | 進捗率 |
|---------|------|--------|------|--------|
| **Phase A** | In Progress | 2/6 | 6 | 33% |
| **Phase B** | Complete | 2/2 | 2 | 100% |
| **Phase C** | To Do | 0/3 | 3 | 0% |
| **Phase D** | On Hold | 0/∞ | - | - |
| **実装済み** | Complete | 48/48 | 48 | 100% |

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
- **Notes**: **詳細仕様は [PORTAL_ADMIN_SPEC.md](../PORTAL_ADMIN_SPEC.md) に
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
- **Notes**: **手順は [SECURITY_PRODUCTION.md](SECURITY_PRODUCTION.md) に集約**。
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

### REL-09: エラートラッキング
- **Status**: To Do
- **Due Date**: TBD
- **Assigned To**: Claude
- **Scope**: Sentry 等を導入し、クライアント・API Routes・Functions の例外を収集
- **Ambition**: Medium
- **Known Gaps**: Sentry アカウント設定
- **Notes**: 本番でのインシデント対応に必須

### REL-10: 利用状況モニタリング
- **Status**: To Do
- **Due Date**: TBD
- **Assigned To**: Claude
- **Scope**: Firebase Analytics or GA4 で主要フロー（作成数・AI利用数・完成率・投稿数）を可視化
- **Ambition**: Medium
- **Known Gaps**: コスト管理ダッシュボード
- **Notes**: 月次レビューで判断基準に

### REL-11: 障害対応の型化
- **Status**: To Do
- **Due Date**: TBD
- **Assigned To**: You + Claude
- **Scope**: 
  - デプロイ前チェックリスト（REL-05 と統合）
  - ロールバック手順（Vercel・Firestore）
  - 依存パッケージ監査を月次実行
- **Ambition**: Small
- **Known Gaps**: None
- **Notes**: Phase C 完了時に一般公開許可

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
- [RELEASE_ROADMAP.md](RELEASE_ROADMAP.md) — リリース戦略
- [NOTION_SETUP.md](NOTION_SETUP.md) — Notion セットアップ手順
