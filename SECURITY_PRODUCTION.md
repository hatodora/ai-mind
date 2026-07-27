# 本番セキュリティ有効化 手順書（REL-06）

> コードの実装は完了済み。**すべて既定は「無効」**で、
> このドキュメントの手順どおりに環境変数を設定して初めて有効になる。
> 段階的に入れられるので、上から順に1つずつ進めてよい。

**最終更新**: 2026-07-27

---

## 0. 全体像

| 対策 | 何を守るか | 実装 | 有効化の方法 |
|------|-----------|------|-------------|
| App Check | 正規アプリ以外からの Functions 呼び出し | ✅ 済 | 環境変数2つ |
| 未認証AI経路の遮断 | `/api/ai/*` を使った Groq のタダ乗り | ✅ 済 | **本番は既定で遮断** |
| 日次レートリミット | 1アカウントの使いすぎ | ✅ 済 | 既定で有効 |
| 全体サーキットブレーカー | 課金の暴走（実際に止める） | ✅ 済 | 既定で有効 |
| 予算アラート | 課金の異常に気づく（通知のみ） | ⬜ 手動 | GCP / Groq コンソール |

サーキットブレーカーと予算アラートは役割が違う。
**止めるのはコード側の上限、気づくのがアラート**。両方いる。

---

## 1. Firebase App Check（reCAPTCHA v3）

App Check は「このリクエストは本物の自分のアプリから来たか」を検証する。
有効にすると、curl や自作スクリプトから Cloud Functions を叩けなくなる。

### 1-1. reCAPTCHA v3 のサイトキーを取る

1. https://www.google.com/recaptcha/admin/create を開く
2. ラベル: 任意（例 `mindmap-appcheck`）
3. reCAPTCHA タイプ: **スコアベース（v3）** を選択
4. ドメイン: 本番ドメイン（Vercel のドメイン）を追加
   - ローカル確認もしたい場合は `localhost` も追加
5. 作成すると **サイトキー** と **シークレットキー** が出る

### 1-2. Firebase コンソールに登録

1. Firebase コンソール → **App Check** → **アプリ** タブ
2. 対象の Web アプリを選び **reCAPTCHA v3** を選択
3. さきほどの **シークレットキー**（サイトキーではない方）を貼る
4. 保存

### 1-3. クライアントに公開キーを設定

`mindmap-app/.env.local`（および Vercel の環境変数）に追加:

```
NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY=<reCAPTCHA v3 のサイトキー>
```

> サイトキーはブラウザに露出する前提の公開値なので、これで問題ない。
> シークレットキーは Firebase コンソールにだけ入れる。**リポジトリに置かない**。

この時点でクライアントは App Check トークンを送り始めるが、
サーバー側はまだ強制していないので、失敗してもアプリは普通に動く。

### 1-4. しばらく「監視のみ」で様子を見る

Firebase コンソール → App Check → **API** タブで、
Cloud Functions のリクエストのうち何割が検証済みかを見られる。
**検証済みが 100% 近くになるまで待つ**（数日）。
ここで急に強制すると、まだ古いページを開いている利用者が弾かれる。

### 1-5. 強制を有効化

十分に検証済み比率が上がったら、`mindmap-app/functions/.env` を作って:

```
ENFORCE_APP_CHECK=true
```

そして Functions をデプロイ:

```bash
cd mindmap-app && firebase deploy --only functions
```

Firebase コンソール側でも App Check → API → Cloud Functions を **「適用」** に切り替える。

### ローカル開発でどうするか

App Check を強制した状態でローカル開発すると自分も弾かれる。
その場合は Firebase コンソール → App Check → アプリ → **デバッグトークンを管理** で
トークンを発行し、`.env.local` に:

```
NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN=<発行されたトークン>
```

**この行は本番の環境変数には絶対に入れないこと**（検証を素通りできてしまう）。

---

## 2. 未認証 AI 経路（`/api/ai/*`）の扱い

### なぜ塞ぐのか

`/api/ai/suggest` などの Next.js API Routes は **認証を要求しない**。
URL さえ分かれば誰でも Groq を呼べる ＝ こちらの API キーで動く無料 AI プロキシになる。
レートリミットはあるが、IP 単位・プロセス内メモリなので、
サーバーレスでインスタンスが分かれると窓も分かれてしまい、実質ほとんど効かない。

### 現在の挙動（コード実装済み）

| `AI_PUBLIC_FALLBACK` | 開発 | 本番 |
|---|---|---|
| 未設定（既定） | 開く | **閉じる** |
| `on` | 開く | 開く |
| `off` | 閉じる | 閉じる |

閉じている間、未ログインの利用者が AI 機能を使おうとすると
「AI機能を使うにはログインが必要です」というエラーになる。

### 判断が必要な点

**未ログインでも AI を使わせたい**という製品方針なら、`AI_PUBLIC_FALLBACK=on` にできる。
ただしその場合は最低限セットで:

- App Check を `/api/ai/*` にも適用する（現状は Functions のみ）
- レートリミットを Redis 等の共有ストアに移す（プロセス内メモリでは効かない）

何もせず `on` にするのは、Groq の請求を他人に開放するのと同じなので避けること。

---

## 3. レートリミットとサーキットブレーカー

### 現在の上限（Cloud Functions 経路 ＝ ログイン利用者）

| 項目 | 既定値 | 環境変数 | 意味 |
|---|---|---|---|
| 1ユーザー / 1時間 | 30回 | （固定） | 連打の抑制 |
| 1ユーザー / 1日 | 120回 | `AI_DAILY_LIMIT` | 1アカウントの使いすぎ防止 |
| **全体 / 1日** | **3000回** | `AI_GLOBAL_DAILY_LIMIT` | **課金の暴走を止める最後の砦** |

日次の区切りは **JST の暦日**。カウンタは以下に保存される:

- ユーザー単位: `users/{uid}/private/usage`
- 全体: `system/aiUsage`

どちらもセキュリティルールでクライアントから完全に遮断済み（Admin SDK のみ）。

### 全体上限に達したらどうなるか

全利用者に対して
「本日のAI利用が全体の上限に達しました。時間をおいてお試しください」
が返る。**サービス全体が AI だけ止まる**状態なので、
上限に達したこと自体を検知できるようにしておくのが望ましい（REL-09 のエラートラッキングと合わせて）。

### 想定利用者が増えたら

`mindmap-app/functions/.env` で引き上げる:

```
AI_GLOBAL_DAILY_LIMIT=10000
AI_DAILY_LIMIT=200
```

### API Routes 経路（開けている場合のみ）

| 項目 | 既定値 | 環境変数 |
|---|---|---|
| 1IP / 1時間 | 30回 | （固定） |
| プロセス全体 / 1時間 | 300回 | `AI_PUBLIC_HOURLY_LIMIT` |

---

## 4. 予算アラート

コード側の上限が「止める」役割、こちらは「気づく」役割。

### 4-1. Google Cloud（Firebase）

1. https://console.cloud.google.com/billing → 対象の請求先アカウント
2. **予算とアラート** → **予算を作成**
3. 対象プロジェクト: この Firebase プロジェクト
4. 予算額: 月額の上限（例 3,000円）
5. しきい値: **50% / 90% / 100%** で通知
6. 通知先メールを設定

> Firebase の無料枠（Spark）を超えると Blaze（従量課金）が必要。
> Cloud Functions を使っている時点で Blaze のはずなので、予算アラートは必須。

### 4-2. Groq

1. https://console.groq.com/ → **Settings** → **Billing / Limits**
2. 使用量の上限・アラートを設定（プランにより項目名が異なる）
3. **API キーの利用状況を月次で確認する**（REL-11 の月次レビューに含める）

> Groq 側にハードな支出上限がない場合、`AI_GLOBAL_DAILY_LIMIT` が
> 実質の防波堤になる。想定コストから逆算して値を決めること。

---

## 5. 環境変数まとめ

### `mindmap-app/.env.local` / Vercel

```bash
# Firebase（既存）
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# AI のバックエンド。Functions デプロイ後は functions にする
NEXT_PUBLIC_AI_BACKEND=functions

# App Check（REL-06）
NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY=<reCAPTCHA v3 サイトキー>
# ↓ ローカル専用。本番には入れない
# NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN=<デバッグトークン>

# 未認証 AI 経路（REL-06）。未設定なら本番は自動で閉じる
# AI_PUBLIC_FALLBACK=off
# AI_PUBLIC_HOURLY_LIMIT=300
```

### `mindmap-app/functions/.env`

```bash
# App Check の強制（1-4 の監視で問題ないと確認してから true に）
ENFORCE_APP_CHECK=false

# レートリミット（REL-06）
AI_DAILY_LIMIT=120
AI_GLOBAL_DAILY_LIMIT=3000
```

> `GROQ_API_KEY` は `.env` ではなく **Secret Manager**（`defineSecret`）で管理済み。
> 設定は `firebase functions:secrets:set GROQ_API_KEY`。

---

## 6. 有効化チェックリスト

公開前に上から順に潰していく。

- [ ] Firestore ルールをデプロイ（`firebase deploy --only firestore:rules`）
- [ ] Cloud Functions をデプロイ（`deleteAccount` と新レートリミットを含む）
- [ ] `NEXT_PUBLIC_AI_BACKEND=functions` を本番に設定
- [ ] 未認証 AI 経路が本番で閉じていることを確認（`/api/ai/suggest` に POST して 403）
- [ ] reCAPTCHA v3 のキーを取得し、Firebase App Check に登録
- [ ] `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` を本番に設定
- [ ] App Check の検証済み比率を数日観察（100% 近くになるまで待つ）
- [ ] `ENFORCE_APP_CHECK=true` にして Functions を再デプロイ ＋ コンソールで「適用」
- [ ] GCP の予算アラートを設定（50/90/100%）
- [ ] Groq の使用量アラート・上限を設定
- [ ] `AI_GLOBAL_DAILY_LIMIT` を想定コストから逆算して調整
- [ ] レートリミットの動作を本番で1回実測（上限まで叩いて 429/resource-exhausted を確認）

---

## 7. 関連

- [TASKS.md](TASKS.md) — REL-06 の進捗
- [RELEASE_ROADMAP.md](RELEASE_ROADMAP.md) — リリース戦略
- [mindmap-app/firestore.rules](mindmap-app/firestore.rules) — アクセス制御の本体
- REL-09（エラートラッキング）— 全体上限到達の検知はこちらと合わせて
