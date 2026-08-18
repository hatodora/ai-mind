# Vercel デプロイ手順（本番公開前ステップバイステップ）

> Phase C コード完成 → 外部サービス設定 → 本番公開

**このドキュメント用途**: Sentry / Firebase Analytics / Vercel の各外部サービスが用意できた後、
ここに書かれた順序でやれば本番を公開できます。

**最終更新**: 2026-07-28  
**所要時間**: 30分～1時間

---

## 📋 前提チェック

本手順を始める前に、以下が確認できていることを確認：

- [ ] `git status` がクリーン（コミット済み）
- [ ] GitHub リポジトリにアクセス可能
- [ ] Firebase CLI がインストール済み（`firebase --version`）
- [ ] ローカル Firebase プロジェクト接続済み（`firebase projects:list`）
- [ ] **Sentry アカウント作成済み・DSN をコピー済み**
- [ ] **Firebase Analytics 連携済み・measurementId をコピー済み**
- [ ] **reCAPTCHA キー取得済み**（ユーザーは既に取得）
- [ ] **本番ドメイン決定済み**（例: mindmap.example.com）

---

## ステップ1: Cloud Functions・Firestore ルールをデプロイ（Firebase CLI）

**理由**: フロント先行でビルドされると、まだ実装されていない API を呼びに行く。
**所要時間**: 5分

```bash
cd mindmap-app
firebase deploy --only firestore:rules,functions
```

確認事項:
```
✓ Firestore ルール: "Deploy complete!"
✓ Cloud Functions: all functions deployed successfully
```

**トラブル時**:
- `Permission denied` → ローカル Firebase 接続を再設定（`firebase login`）
- 構文エラー → SECURITY_PRODUCTION.md で Firestore ルール設定を見直し

---

## ステップ2: Vercel で GitHub リポジトリをインポート

**所要時間**: 10分

1. https://vercel.com/new にアクセス
2. "Import Git Repository" → GitHub アカウントを選択
3. このリポジトリ（AIマインドマップ）を検索 → "Import"

```
✓ Project Name: (既定のままでOK)
✓ Framework Preset: Next.js（自動検出）
```

---

## ステップ3: Root Directory を設定（**最重要**）

Vercel ダッシュボード上で：

1. Import 画面の下部 → **Root Directory** をクリック
2. `mindmap-app` を選択
3. "Deploy" をクリック

> ⚠️ **ここを設定しないとビルドが通りません**。
> `vercel.json` では指定できないダッシュボード設定です。

ビルド実行中（5～10分待機）

---

## ステップ4: 環境変数を設定

ビルド中に Vercel → Settings → Environment Variables を開き、下表の値を登録。

### 必須（すべてのデプロイメント）

| 変数 | 値 | 出典 |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | | Firebase コンソール → プロジェクト設定 → ウェブアプリ |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | | 同上 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | | 同上 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | | 同上 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | | 同上 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | | 同上 |

> `NEXT_PUBLIC_AI_BACKEND` は設定不要。未設定＝ログイン済みユーザーは
> 自動で Cloud Functions 経由になる（`routes` を入れたときだけ旧経路に固定される）。

### 任意（設定して初めて有効）

| 変数 | 値 | 有効化条件 |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` | reCAPTCHA キー | ユーザー取得済み |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | `G-XXXXXXXXXX` | Firebase Analytics 連携後 |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN | Sentry アカウント作成後 |
| `SENTRY_ORG` | Sentry 組織名 | ソースマップ送信（任意） |
| `SENTRY_PROJECT` | Sentry プロジェクト | ソースマップ送信（任意） |
| `SENTRY_AUTH_TOKEN` | Sentry トークン | ソースマップ送信（任意） |

---

## ステップ5: Cloud Functions 側の環境変数設定

ローカルで実行：

```bash
cd mindmap-app

# Groq API キーは Secret Manager で管理
firebase functions:secrets:set GROQ_API_KEY

# functions/.env ファイルを作成
cp functions/.env.example functions/.env
# functions/.env を編集:
#   - SENTRY_DSN=<Sentry DSN>（未設定でも動作）
#   - AI_DAILY_LIMIT / AI_GLOBAL_DAILY_LIMIT をビジネス方針に合わせて調整
```

再度デプロイしてシークレットを反映させる：

```bash
firebase deploy --only functions
```

---

## ステップ6: ドメイン設定・承認済みドメイン登録

### 6-1. Vercel で カスタムドメインを追加

1. Vercel → Settings → Domains
2. "Add" → ドメイン入力（例: `mindmap.example.com`）
3. DNS レコード設定（プロバイダの指示に従う）

### 6-2. Firebase で承認済みドメインに追加（**必須**）

ログインが本番で失敗する最大の原因。

1. Firebase コンソール → Authentication → Settings
2. 「承認済みドメイン」セクション
3. Vercel で設定したドメインを追加（例: `mindmap.example.com`）
4. 保存

### 6-3. App Check リキャプチャ設定（オプション・REL-06 有効時）

App Check を有効化している場合のみ：

1. Google Cloud Console → reCAPTCHA Admin
2. 新しいサイトで「Mindmap」を登録
3. ドメインに `mindmap.example.com` を追加

---

## ステップ7: ログイン動作確認（本番前最後のチェック）

### 7-1. 本番 URL でログインテスト

1. `https://<あなたのドメイン>.com` にアクセス
2. 画面が表示されるか確認
3. ログイン画面で Google / メールアドレスでログイン試行

**失敗時**:
- 画面が真っ白 → Vercel ビルドログを確認（Settings → Deployments）
- ログインだけ失敗 → Firebase 承認済みドメイン未設定（ステップ6-2）
- エラーが Sentry に上がる（設定済みの場合）

### 7-2. 簡単な操作確認

- マップ作成：テーマを入力して「新規作成」
- 保存確認：画面を閉じて、再度開いてマップが残っているか
- AI 呼び出し：「AI に相談」でエラーが出ないか

---

## ステップ8: 本番公開宣言

すべてのテストが通ったら、本番公開。

```bash
git log --oneline -3
# コミット履歴を確認して、最新がフロント・バック両方のコードを含んでいるか確認
```

確認項目チェックリスト:

- [ ] Vercel ビルドが成功している（Deployments → Production）
- [ ] 本番 URL でログイン・マップ作成・AI 呼び出しが動く
- [ ] Firebase コンソール → Firestore でテストデータが作成されている
- [ ] Sentry にエラーが集約されている（設定済みの場合）
- [ ] Google Analytics でアクセスが記録されている（設定済みの場合）

---

## トラブルシューティング

### A. Vercel ビルド失敗

**症状**: "vercel.json で ... が見つかりません"

**原因**: Root Directory が `mindmap-app` になっていない

**対策**:
```
Vercel ダッシュボード → Settings → General → Root Directory
→ mindmap-app に設定し直す → Redeploy
```

### B. ログイン失敗（本番のみ）

**症状**: 「メールアドレスまたはパスワードが無効です」

**原因**: Firebase 承認済みドメイン未登録

**対策**:
```
Firebase コンソール → Authentication → Settings
→ 承認済みドメインに本番ドメインを追加
```

### C. AI 呼び出し失敗

**症状**: 「リクエストに失敗しました」or Sentry にエラー

**原因**: Cloud Functions のシークレット（GROQ_API_KEY）未設定

**対策**:
```bash
firebase functions:secrets:set GROQ_API_KEY
firebase deploy --only functions
```

### D. 計測・エラー収集が記録されない

**症状**: Sentry / Google Analytics に何も上がらない

**原因**: 環境変数未設定

**対策**:
```
Vercel → Settings → Environment Variables
→ NEXT_PUBLIC_SENTRY_DSN / NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID を確認
未設定なら値を追加して Redeploy
```

---

## 次のステップ

本番公開後：

1. **月次運用開始** → [DEPLOY.md#6-1-月次](../DEPLOY.md)
   - `npm audit` 実行
   - Groq / Firebase 使用量確認
   - Sentry エラー棚卸し

2. **ポータル・管理ダッシュボード** → [RELEASE_ROADMAP.md](../RELEASE_ROADMAP.md)
   - REL-03〜05 実装（ユーザー管理・利用統計・公開停止機能）
   - 別リポジトリとしてセットアップ

3. **ユーザーサポート体制** → [SECURITY_PRODUCTION.md](../SECURITY_PRODUCTION.md)
   - GCP 予算アラート確認
   - オンコール体制構築（必要に応じて）

---

## 関連ドキュメント

- [DEPLOY.md](../DEPLOY.md) — ロールバック・月次運用・つまずき集
- [SECURITY_PRODUCTION.md](../SECURITY_PRODUCTION.md) — App Check・レートリミット・予算
- [TASKS.md](../../TASKS.md) — 実装状況・残りタスク
- [RELEASE_ROADMAP.md](../RELEASE_ROADMAP.md) — リリース戦略全体

