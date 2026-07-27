# デプロイ・障害対応手順書（REL-11）

> **本番は Vercel、Netlify は予備系**（2026-07-28 決定）。
> Firebase（Auth / Firestore / Functions）は両者で共通。
> セキュリティ設定の有効化手順は [SECURITY_PRODUCTION.md](SECURITY_PRODUCTION.md) を参照。

**最終更新**: 2026-07-28

---

## 0. 構成

```
GitHub (main)
   ├─→ Vercel   … 本番（Root Directory = mindmap-app）
   └─→ Netlify  … 予備（netlify.toml の base = mindmap-app）
            ↓ 両方が同じ Firebase を見る
   Firebase: Auth / Firestore / Cloud Functions(asia-northeast1)
```

Next.js のアプリ本体はリポジトリ直下ではなく **`mindmap-app/`** にある。
どちらのホストでもここを起点にする設定が要る（下記）。

---

## 1. Vercel（本番）

### 1-1. 初回セットアップ

1. https://vercel.com/new でこの GitHub リポジトリを Import
2. **Root Directory に `mindmap-app` を指定する**（最重要）
   - ここを設定しないとビルドが通らない。
     Netlify の `base` に相当する設定で、`vercel.json` では指定できない
3. Framework Preset は **Next.js**（自動検出されるはず）
4. Build Command / Output Directory は既定のままでよい
5. 環境変数を登録（下の「3. 環境変数」）
6. Deploy

`mindmap-app/vercel.json` では、サーバー関数の実行リージョンを
**`hnd1`（東京）** に指定している。Cloud Functions（asia-northeast1）と
Firestore に近づけて往復を短くするため。

### 1-2. カスタムドメイン

1. Vercel → Settings → Domains でドメインを追加
2. **追加したドメインを Firebase の承認済みドメインにも登録する**
   （Firebase コンソール → Authentication → Settings → 承認済みドメイン）
   - **これを忘れると本番でログインだけが失敗する**。最も踏みやすい罠
3. App Check を有効化している場合は、reCAPTCHA 側にもドメインを追加

---

## 2. Netlify（予備）

リポジトリ直下の `netlify.toml` に `base = "mindmap-app"` を設定済みなので、
リポジトリを接続すればそのままビルドが通る。環境変数は Vercel と同じものを登録する。

> 予備系として維持する目的は、Vercel 側の障害・アカウント停止時に
> 切り替え先を確保しておくこと。常用しないので、
> **本番ドメインは Vercel に向けたままにする**。

---

## 3. 環境変数

Vercel / Netlify の両方に、同じ値を登録する。
テンプレートと各項目の意味は [mindmap-app/.env.local.example](mindmap-app/.env.local.example) を参照。

### 必須

| 変数 | 用途 |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` 他 6 個 | Firebase クライアント初期化 |
| `NEXT_PUBLIC_AI_BACKEND=functions` | AI を Cloud Functions 経由にする |

### 任意（設定して初めて有効になる）

| 変数 | 用途 | 未設定時 |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` | App Check（REL-06） | App Check 無効 |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | 利用状況の計測（REL-10） | 計測しない |
| `NEXT_PUBLIC_SENTRY_DSN` | エラー収集（REL-09） | Sentry 無効 |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | ソースマップ送信 | 送信しないだけでビルドは通る |

### 本番に入れてはいけないもの

- `NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN`（App Check の検証を素通りできる）
- `GROQ_API_KEY`（Cloud Functions の Secret Manager 管理。Vercel には置かない）
- `AI_PUBLIC_FALLBACK=on`（未認証で AI を叩けるようになる。判断は SECURITY_PRODUCTION.md 参照）

### Cloud Functions 側

`firebase functions:secrets:set GROQ_API_KEY` と
`mindmap-app/functions/.env`（[テンプレート](mindmap-app/functions/.env.example)）で設定する。

---

## 4. デプロイ前チェックリスト

コードを本番に出す前に上から順に確認する。

- [ ] `npm run lint` が通る
- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通る（単体テスト）
- [ ] `npm run test:e2e` が通る（E2E）
- [ ] CI（GitHub Actions）が緑になっている
- [ ] **Firestore rules を変更した場合**: `npm run test:rules:emulator` が通る
- [ ] **Firestore rules / Functions を変更した場合**: 先に Firebase へデプロイする
      （フロントだけ先に出ると、まだ無い機能を呼びに行って壊れる）
      ```bash
      cd mindmap-app && firebase deploy --only firestore:rules,functions
      ```
- [ ] プライバシーポリシー・利用規約に影響する変更なら
      `src/lib/terms.ts` の `TERMS_VERSION` を上げたか
- [ ] 新しい環境変数を足したなら、Vercel・Netlify の両方に登録したか

---

## 5. ロールバック手順

### 5-1. フロントエンド（Vercel）

1. Vercel → Deployments で直前の正常なデプロイを開く
2. **⋯ → Promote to Production**
3. 数十秒で切り替わる。ビルドし直さないので速い

Netlify の場合は Deploys → 対象デプロイ → **Publish deploy**。

### 5-2. Firestore セキュリティルール

**ルールの巻き戻しはコンソールから行うのが速い**:

1. Firebase コンソール → Firestore → ルール → **履歴**タブ
2. 戻したいバージョンを選び「復元」

コードから戻す場合は、リポジトリを前のコミットに戻して再デプロイ:

```bash
cd mindmap-app && firebase deploy --only firestore:rules
```

> ルールを緩める方向のロールバックは、塞いだ穴を開け直すことになる。
> 復元前に「そのバージョンで何が許可されていたか」を必ず確認すること。

### 5-3. Cloud Functions

Functions には Vercel のようなワンクリック巻き戻しが無い。
**前のコミットをチェックアウトして再デプロイする**のが確実:

```bash
git checkout <前の正常なコミット> -- mindmap-app/functions
cd mindmap-app && firebase deploy --only functions
```

緊急で止めたいだけなら、機能ごとに環境変数で落とす手もある
（例: `AI_GLOBAL_DAILY_LIMIT=0` にすれば AI 呼び出しが全部止まる）。

### 5-4. 判断の目安

| 症状 | まずやること |
|---|---|
| 画面が真っ白・全ページ 500 | Vercel を直前デプロイに Promote |
| ログインだけ失敗する | Firebase の承認済みドメインを確認（デプロイは巻き戻さない） |
| 特定ユーザーだけ権限エラー | Firestore ルールの履歴を確認 |
| AI だけ動かない | Sentry と Cloud Logging を確認。Groq 障害なら待つ |
| 課金が急増している | `AI_GLOBAL_DAILY_LIMIT` を下げて Functions を再デプロイ |

---

## 6. 定常運用

### 6-1. 月次（毎月1回）

- [ ] `npm audit` を実行し、高危険度の脆弱性に対応
      （`mindmap-app` と `mindmap-app/functions` の両方）
- [ ] Groq の使用量を確認（[console.groq.com](https://console.groq.com/)）
- [ ] Firebase の使用量・課金を確認（Firestore 読み書き、Functions 実行回数）
- [ ] Sentry の未解決エラーを棚卸し
- [ ] Google Analytics で主要指標を確認
      （マップ作成数・AI 利用数・完成率・コミュニティ投稿数）

### 6-2. 気づける状態になっているか

コード側の上限が「止める」役、通知が「気づく」役で、**両方必要**。

| 何が起きたか | どこに出るか |
|---|---|
| 全利用者の AI が停止（日次上限到達） | Sentry（error レベル）＋ Cloud Logging |
| Groq 呼び出しの失敗 | Sentry |
| 画面クラッシュ | Sentry |
| 課金の急増 | GCP 予算アラート（要設定・SECURITY_PRODUCTION.md） |

---

## 7. よくあるつまずき

### 依存を追加した直後、開発サーバーだけ「Cannot find module」で落ちる

Turbopack の `.next/dev` キャッシュが、そのパッケージが無かった頃の
解決結果を持ち越していることがある。**本番ビルドは通るのに dev だけ落ちる**のが特徴。

```bash
cd mindmap-app && rm -rf .next && npm run dev
```

（REL-09 で `@sentry/nextjs` を追加した際に実際に踏んだ。
CI は毎回まっさらなので、この症状はローカル限定）

### 本番でログインだけ失敗する

Firebase の**承認済みドメイン**に本番ドメインが入っていない。
Firebase コンソール → Authentication → Settings → 承認済みドメイン。

### Vercel のビルドが「Next.js が見つからない」で落ちる

Vercel の **Root Directory** が `mindmap-app` になっていない。
`vercel.json` では指定できない設定なので、ダッシュボードで直す。

---

## 8. 関連ドキュメント

- [SECURITY_PRODUCTION.md](SECURITY_PRODUCTION.md) — App Check・レートリミット・予算アラート
- [TASKS.md](TASKS.md) — フェーズごとの進捗
- [RELEASE_ROADMAP.md](RELEASE_ROADMAP.md) — リリース戦略
