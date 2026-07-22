# AIマインドマップ タスク管理

> Shape UP形式で、フェーズと進捗を一元管理

**最終更新**: 2026-07-20  
**リポジトリ**: mindmap-app  
**Notion 同期**: 有効（GitHub Actions）

---

## 📊 進捗サマリー

| フェーズ | 状態 | 完了数 | 合計 | 進捗率 |
|---------|------|--------|------|--------|
| **Phase A** | In Progress | 1/6 | 6 | 17% |
| **Phase B** | To Do | 0/2 | 2 | 0% |
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

### REL-02: アカウント削除機能
- **Status**: To Do
- **Due Date**: TBD
- **Assigned To**: You
- **Scope**: ユーザーが退会時に Auth + profile + bookmarks + maps/posts/comments を削除
- **Ambition**: Medium
- **Known Gaps**: 投稿の削除方針（完全削除 vs 匿名化）未決定
- **Notes**: 個人情報保護法対応のため実質必須

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

### REL-06: 本番セキュリティ有効化
- **Status**: To Do
- **Due Date**: TBD
- **Assigned To**: Claude
- **Scope**: 
  - Firebase App Check（reCAPTCHA v3）を有効化
  - Groq・Firebase の予算アラート設定
  - レートリミット本番再検証
- **Ambition**: Medium
- **Known Gaps**: App Check の閾値設定
- **Notes**: SEC-07 実行時に合わせて設定

---

## 🔬 Phase B: 品質保証体制

**Pitch**: 自動テストと CI で、機能変更時に自動的に壊れたところを検出する。  
**Ambition**: Large | **Scope**: 2週間～ | **Cycle**: 1週間ずつ

### REL-07: 最小限の自動テスト
- **Status**: To Do
- **Due Date**: TBD
- **Assigned To**: Claude
- **Scope**: 
  - `gauge.ts` / `ai-validate.ts` / `merge.ts` の単体テスト
  - Firestore rules のユニットテスト（@firebase/rules-unit-testing）
  - 主要フロー（作成→ノード追加→提案→レビュー）の E2E テスト
- **Ambition**: Large
- **Known Gaps**: テストサーバー環境の整備
- **Notes**: Playwright 推奨

### REL-08: CI 導入
- **Status**: To Do
- **Due Date**: TBD
- **Assigned To**: Claude
- **Scope**: 
  - GitHub Actions で PR ごとに lint → tsc → build → test を自動実行
  - Firestore rules エミュレータ検証
- **Ambition**: Medium
- **Known Gaps**: None
- **Notes**: ローカルで Java 環境がなかった問題を CI 上で解決

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
