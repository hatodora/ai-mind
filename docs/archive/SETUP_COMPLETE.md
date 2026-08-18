# Notion 連携セットアップ完了ガイド

> 実装完了した内容と、ユーザーが行うべき手順をまとめています

---

## 📦 実装済み（私が完成させたもの）

### ✅ TASKS.md
- **ファイル**: [TASKS.md](TASKS.md)
- **形式**: Shape UP形式（Pitch / Ambition / Scope / Known Gaps）
- **内容**: Phase A〜D の 11 個のリリースタスク（REL-01〜11）
- **進捗**: Phase A 1/6 完了（REL-01: F-1実装済み）、Phase B/C は To Do

### ✅ GitHub Actions ワークフロー
- **ファイル**: [.github/workflows/task-sync.yml](.github/workflows/task-sync.yml)
- **トリガー**: TASKS.md への push 検知 + 手動トリガー（workflow_dispatch）
- **処理**: TASKS.md をパースして Notion Database を自動更新

### ✅ Notion 同期スクリプト
- **ファイル**: [scripts/sync-notion.js](scripts/sync-notion.js)
- **機能**:
  - TASKS.md から REL-01〜11 を正規表現でパース
  - Notion API で既存ページを検索（マージ対象）
  - 新規作成 or 更新を判定して実行
  - マークダウンフィールド → Notion プロパティへの自動変換

### ✅ 環境設定サンプル
- **ファイル**: [.env.local.example](.env.local.example)
- **内容**: NOTION_TOKEN と NOTION_DATABASE_ID のプレースホルダー
- **git 対象外**: `.env.local` は `.gitignore` 済み（秘密情報保護）

---

## 🚀 あなたが今すぐやることリスト

### Step 1: Notion 側の準備（5 分）

📖 **詳細は [NOTION_SETUP.md](NOTION_SETUP.md) を参照**

```
1️⃣ Notion Developers で Integration を作成
   → トークン（secret_xxxxx...）をコピー

2️⃣ Notion で新しい Database を作成
   → NOTION_SETUP.md のテンプレートを参考に

3️⃣ Database に Integration を追加（Share → Integration 追加）

4️⃣ Database ID をコピー
   → URL から抽出: https://www.notion.so/[DATABASE_ID]...
```

### Step 2: ローカル環境の設定（2 分）

```bash
# .env.local.example をコピーして .env.local を作成
cp .env.local.example .env.local

# エディタで編集して以下を入力
# NOTION_TOKEN=secret_xxxxx... （Step 1で取得）
# NOTION_DATABASE_ID=xxxxxxxxxxxxxxx （Step 1で取得）
```

**チェック**: `.env.local` は `.gitignore` に登録済み（git に commit されない）

### Step 3: GitHub Actions シークレット設定（3 分）

1. GitHub リポジトリの **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** をクリック
3. 以下を 2 つ追加：
   - **Name**: `NOTION_TOKEN` | **Value**: `secret_xxxxx...`（Step 1 から）
   - **Name**: `NOTION_DATABASE_ID` | **Value**: `xxxxxxxxxxxxxxx`（Step 1 から）

**チェック**: これで GitHub Actions が TASKS.md 変更時に Notion を自動更新するようになります

### Step 4: 初期マイグレーション実行（1 分）

```bash
# 手動でワークフローをトリガー
# オプション A: GitHub UI から
#   → Actions → Task Sync to Notion → Run workflow

# オプション B: コマンドラインから（gh CLI が必要）
gh workflow run task-sync.yml --ref main
```

**チェック**: 
- GitHub Actions の実行ログを確認
- Notion Database を開いて、REL-01〜11 が登録されたか確認
- 各ページのプロパティ（Status / Phase / Ambition など）が正しく入っているか確認

---

## 🔄 完成後の使い方

### 私が TASKS.md を編集した場合

```
1. 私が TASKS.md を編集（例: REL-02 のステータスを "In Progress" に変更）
2. ファイルを commit & push
3. GitHub Actions が自動検知
4. Notion Database が自動更新
5. あなたは Notion を見て最新の進捗を追跡
```

### あなたが Notion で編集した場合（現在：一方向）

> 現在は TASKS.md → Notion の一方向同期です。
> Notion で編集 → TASKS.md に反映させるには、いったん TASKS.md に戻して push してください。

**将来の拡張**（まだ実装してない）:
- webhook で Notion → TASKS.md の逆流を実装
- 或いは MCP で私が Notion に直接アクセス（plugin:product-management:notion）

---

## 📋 全体フロー図

```
┌─ 私が TASKS.md を編集 ─────┐
│                           ↓
│                  git commit & push
│                           ↓
│         GitHub Actions: task-sync.yml トリガー
│                           ↓
│               scripts/sync-notion.js 実行
│                           ↓
│           Notion API: Database 更新
│                           ↓
└─ Notion Database が自動更新 ◀─┘

┌─ あなたが Notion で編集 ─────┐
│   （現在：一方向のため）     │
│ → TASKS.md に反映したい場合は│
│   TASKS.md を編集してpush   │
└────────────────────────────┘
```

---

## 🔒 セキュリティに関する注意

### Notion トークンの管理

- ✅ **安全**: `.env.local` に保存（.gitignore で除外）
- ✅ **安全**: GitHub Actions の Secrets で管理
- ❌ **危険**: トークンを git に commit しない
- ❌ **危険**: Discord / Slack など公開チャネルに貼り付けない

### もしトークンが漏れたら

1. 直ちに [Notion Integrations](https://www.notion.com/my-integrations) で該当 Integration をリボーク
2. GitHub Secrets を新しいトークンに更新
3. 新しい Integration を作成しなおす

---

## ❓ トラブルシューティング

### GitHub Actions が失敗する場合

**エラー**: `Missing env vars: NOTION_TOKEN or NOTION_DATABASE_ID not set`

**原因**: GitHub Secrets が設定されていない

**解決**:
```
Settings → Secrets and variables → Actions
で NOTION_TOKEN と NOTION_DATABASE_ID が登録されているか確認
```

---

### Notion API エラー

**エラー**: `Failed to query Notion database: Invalid database ID`

**原因**: DATABASE_ID の形式が間違っている（ハイフン混在など）

**解決**:
```
Notion URL: https://www.notion.so/xxxxxxxxxxxxxxxxxxxxxxxx?v=...
↓
DATABASE_ID: xxxxxxxxxxxxxxxxxxxxxxxx （ハイフンなし）

.env.local や Secrets で再確認
```

---

### スクリプトをローカルでテストしたい場合

```bash
# 必要なパッケージをインストール
npm install @notionhq/client

# ローカルで実行（.env.local から自動読み込み）
node scripts/sync-notion.js
```

---

## 📞 次のステップ

### 短期（この後）

- [ ] Step 1〜4 を完了
- [ ] Notion Database に REL-01〜11 が登録されたことを確認
- [ ] 動作確認（TASKS.md を編集 → GitHub Actions で Notion が更新されるか）

### 中期（Phase B 実装時）

- [ ] 双方向同期の実装（Notion → TASKS.md）
- [ ] MCP 統合（plugin:product-management:notion で I が Notion に直接アクセス）

### 長期（Phase C以降）

- [ ] Notion の高度なビュー設定（フィルター・ソート・ロールアップ）
- [ ] タスク進捗に基づく自動化（例: Completed → アーカイブ）

---

**準備が完了したら、以下の情報を教えてください**:

```
✅ Notion Integration Token: secret_xxxxx...
✅ Notion Database ID: xxxxxxxxxxxxxxx
```

その後、私が初期マイグレーション（#1〜48 の完了タスクをコピー）を実行します！
