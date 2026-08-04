# 本番公開前ファイナルチェック（Ready-for-Launch Checklist）

**本番ドメイン公開前に、ユーザーと Claude が確認すべきタスク一覧**

**対象**: 2026-08 中旬の初版ベータ公開

---

## 📝 User Action Items（You）

### Phase 1: 外部サービス設定（所要時間: 1.5〜2時間）

必ずこの順序でやる（依存関係あり）

#### ✅ 1-1. Sentry アカウント作成（30分）

```
□ sentry.io にアクセス → アカウント作成
□ 新規プロジェクト → Next.js を選択
□ DSN をコピー（形: https://xxxxx@xxxxx.ingest.sentry.io/xxxxx）
□ DSN を安全な場所に一時保存（メモ帳など）
□ メモ: SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN は「ソースマップ送信用」で任意
      （ビルドの成功には不要。エラーの詳細度が改善するだけ）
```

**確認**: https://sentry.io/projects/ で作成されたプロジェクトが見える

---

#### ✅ 1-2. Firebase Analytics 連携（20分）

```
□ Firebase コンソール → プロジェクト設定（gear アイコン）
□ 「全般」タブ → 下にスクロール
□ ウェブアプリ欄（アプリ名と一緒に表示）
□ 「Google Analytics を有効にする」をクリック（未設定の場合）
□ 数秒待つ → measurementId（G-XXXXXXXXXX）が表示される
□ measurementId をコピー（SENTRY_DSN の下に保存）
```

**確認**: measurementId が `G-` で始まる文字列

---

#### ✅ 1-3. 本番ドメイン決定（10分）

```
□ 本番ドメイン確定（例: mindmap.example.com）
□ DNS ポイント先を確認（その後 Vercel で設定）
□ メモ帳に記録
```

**例**:
- 既存ドメイン活用: company.com の下にサブドメイン（mindmap.company.com）
- 新規取得: お名前.com / Google Domains など

---

### Phase 2: Vercel デプロイ（所要時間: 30分〜1時間）

#### ✅ 2-1. Vercel Import（10分）

```
□ https://vercel.com/new にアクセス
□ "Import Git Repository" → このリポジトリを検索
□ インポート
□ Root Directory = mindmap-app に設定（最重要！）
□ Deploy をクリック
```

**確認**: ビルド中の画面を見守る（5〜10分かかる）
- ✓ Vercel Logs に "Build completed successfully" が出る
- ✓ Deployment が green になる

---

#### ✅ 2-2. 環境変数を Vercel に登録（20分）

ビルド中に Settings → Environment Variables を開いて設定

```
□ NEXT_PUBLIC_FIREBASE_* 6個 を Firebase コンソールからコピペ
（NEXT_PUBLIC_AI_BACKEND は設定不要。未設定＝ログイン済みは Functions 経由）
□ NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY = reCAPTCHA キー
□ NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = さっきコピーした G-XXXXX
□ NEXT_PUBLIC_SENTRY_DSN = さっきコピーした https://xxxxx@...
□ 「Redeploy」をクリック（ビルド再実行）
```

**確認**: ビルド完了後、Deployments で "Production" が green

---

### Phase 3: Firebase / ドメイン設定（所要時間: 20分）

#### ✅ 3-1. Cloud Functions / Firestore ルール をデプロイ（ローカル）

```bash
cd mindmap-app
firebase deploy --only firestore:rules,functions
```

**確認**:
```
✓ Firestore Rules: Deploy complete!
✓ Cloud Functions: all functions deployed successfully
```

> ⚠️ Firebase ローカル認証が必要。
> `firebase login` で接続していることを確認

---

#### ✅ 3-2. Firebase で承認済みドメインに本番ドメインを追加（**必須**）

```
□ Firebase コンソール → Authentication → Settings
□ 「承認済みドメイン」
□ "Add domain" → 本番ドメイン（mindmap.example.com）を入力
□ 保存
```

**これを忘れるとログインが本番で失敗します**（最大の罠）

---

#### ✅ 3-3. Vercel で カスタムドメインを登録

```
□ Vercel → Settings → Domains
□ "Add" → 本番ドメインを入力
□ DNS レコード情報を確認
□ ドメイン登録サービス（お名前.com など）で DNS 設定
□ 数分～数時間待つ（DNS 反映）
```

---

### Phase 4: 本番テスト（所要時間: 15分）

```
□ https://本番ドメイン にアクセス
□ 画面が表示される（ホームが見える）
□ ログイン → Google でログイン → 成功確認
□ 別のブラウザでメールアドレス新規登録 → メール確認 → 成功
□ マップ作成テスト → テーマを入力 → 「作成」で ルートノード表示
□ ノード追加テスト
□ 「AI に相談」クリック → エラーが出ない
□ 「完成」まで進める → 演出が表示される
□ マップ再度開く → データが保存されている
```

**何か異常があれば** → Vercel ビルドログ or Sentry を確認

---

#### ⚠️ Common Issues

| 症状 | 原因 | 対策 |
|------|------|------|
| 画面が真っ白 | Vercel ビルド失敗 | Settings → Deployments でエラーメッセージ確認 |
| ログイン失敗 | 承認済みドメイン未設定 | Firebase → Authentication → Settings で設定 |
| AI 呼び出し失敗 | GROQ_API_KEY 未設定 or Functions デプロイ未実行 | `firebase deploy --only functions` 実行 |
| 計測・エラー収集なし | DSN / measurementId 未設定 or 古いビルド | Vercel → Redeploy で最新ビルド再実行 |

---

## 🤖 Claude Action Items

### デプロイ前の自動確認

```bash
✓ npm run lint              # ESLint
✓ npm run build             # Next.js type check + build
✓ npm test                  # Vitest 75件（全 PASS）
✓ npm run test:e2e          # Playwright 6件（全 PASS）
✓ firebase deploy --dry-run # Firestore rules 構文チェック
```

**進捗**: すべて ✓ で PASS（2026-07-28）

---

### デプロイ後の確認

（ユーザーが本番テストを完了した後）

```
□ Sentry ダッシュボード → Project settings で
  - DSN が正しく設定されている
  - Environment が検出されている（production）
□ Firebase → Analytics → Realtime で
  - アクセスが記録されている
□ Google Analytics → Real-time で
  - セッション・イベントが上がっている
```

---

## 📊 Go / No-Go 判断

### ✅ Go（公開許可）条件

- [ ] ユーザーが Phase 1〜4 をすべて完了
- [ ] 本番 URL で ログイン・マップ作成・AI 呼び出しが全部動く
- [ ] エラーが Sentry に正常に記録されている
- [ ] Firestore rules・Cloud Functions が本番にデプロイされている
- [ ] Firebase 承認済みドメインに本番ドメインが登録されている

### ❌ No-Go（保留）条件

- [ ] ビルドが通らない
- [ ] ログイン / マップ作成 / AI のいずれかが動かない
- [ ] GROQ_API_KEY が未設定（Firebase Secret Manager に無い）
- [ ] 本番ドメインの DNS が反映されていない

---

## 📢 公開宣言（ボイラープレート）

Go 判定が出たら：

> **思索 / Mindmap ベータ版公開**
> 
> 本日より、思索 / Mindmap（https://本番ドメイン）を一般公開しました。
> 
> - **無料**でマインドマップ作成・AI アシスト機能が使えます
> - ユーザー登録は Google アカウント or メールアドレスで即座に開始
> - 機能は時間をかけてアップデートしていきます
> - 不具合報告・ご意見は お問い合わせ フォームからお願いします
> 
> ご利用ありがとうございます 🙏

---

## 🔄 ロールバック手順（緊急時）

何か問題が出たら以下の順で対応：

1. **Vercel** → Deployments → 直前のデプロイを選択 → "Promote to Production"
   （最も速い。コード変更なく前バージョンに戻る）

2. **Firestore ルール** → Firebase コンソール → Firestore → ルール → 履歴
   （そこから巻き戻し。CLI なしで即座に復元）

3. **Cloud Functions** → ローカルで前コミットをチェックアウト
   ```bash
   git checkout <前の正常なコミット> -- mindmap-app/functions
   cd mindmap-app && firebase deploy --only functions
   ```

---

## 📖 参考ドキュメント

- [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) — ステップバイステップガイド
- [DEPLOY.md](./DEPLOY.md) — ロールバック・月次運用・つまずき集
- [SECURITY_PRODUCTION.md](./SECURITY_PRODUCTION.md) — セキュリティ設定
- [TASKS.md](./TASKS.md) — 実装状況・残りタスク

---

**Go/No-Go 判断後、このファイルを削除してもスムーズな本番運用だけは常に参照**

