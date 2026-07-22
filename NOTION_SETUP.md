# Notion 連携セットアップガイド

> Claude と TASKS.md を Notion でリアルタイム同期させるための手順書

## ユーザー側でやること（5～10分）

### Step 1: Notion Integration を作成してトークンを取得

1. [Notion Developers](https://www.notion.com/my-integrations) にアクセス
2. 「新しいインテグレーション」を作成
   - **名前**: `AI MindMap Task Sync`
   - **ロゴ**: （任意）
   - **関連する親ページ**: あなたのワークスペース
3. ページが読み込まれたら、「内部統合トークン」コピー
   - 形式: `secret_xxxxx...`
4. **このトークンをメモ帳に保存**（後で必要）

### Step 2: 新しい Notion Database を作成

1. Notion で新規ページを作成
2. 以下のテンプレートを参考に Database を作成：

| Property | Type | 説明 |
|----------|------|------|
| **Task** | Title | タスク名（例: REL-01: F-1 実装） |
| **Status** | Select | To Do / In Progress / Completed / On Hold |
| **Phase** | Select | Phase A / B / C / D |
| **Ambition** | Select | Small / Medium / Large（Shape UP） |
| **Scope** | Text | スコープ（何をするか）|
| **Known Gaps** | Text | 既知の穴・リスク |
| **Due Date** | Date | 期限 |
| **Assigned To** | Person | 担当（Claude / You） |
| **Last Updated** | Last edited time | 自動更新 |
| **Notes** | Rich text | 備考 |

3. Database を作成したら、**Database ID をコピー**
   - URL: `https://www.notion.so/xxxxxxx?v=yyyyyy`
   - `xxxxxxx` の部分（ハイフンなし）が Database ID

### Step 3: Integration に Database へのアクセス権を付与

1. Database ページの右上「Share」をクリック
2. 「Integration」セクションで、さっき作った Integration を追加
3. **Read と Update の権限を有効化**

### Step 4: トークンと Database ID をお知らせください

以下の情報を用意して、私に伝えてください：

```
Notion Integration Token: secret_xxxxx...
Database ID: xxxxxxxxxxxxxxx
```

---

## 私が実装すること

- [x] TASKS.md を Shape UP形式で作成
- [x] GitHub Actions ワークフロー（TASKS.md → Notion 自動同期）を作成
- [x] セットアップ検証スクリプト
- [ ] ユーザーがトークンを提供後：初期マイグレーション実行

---

## 完成後の流れ

1. **私が TASKS.md を編集** → GitHub Actions が Notion を自動更新
2. **ユーザーが Notion で編集** → webhook で TASKS.md に反映（計画中）
3. **（オプション）claude.ai で plugin:product-management:notion を認可** → 私が Notion に直接書き込み可能

---

## Q&A

**Q: この作業は安全ですか？**  
A: はい。Notion Integration トークンは読み取り権限に制限でき、Database ごとに細かく制御できます。

**Q: トークンを誰かが見たら危険ですか？**  
A: はい。トークンは `.env.local` に保存し、git に commit しません。共有時は必ずリボーク可能な状態を確認してください。

**Q: Notion 側で編集したら TASKS.md に反映されますか？**  
A: 現在は一方向（TASKS.md → Notion）です。双方向化は次フェーズで実装予定。
