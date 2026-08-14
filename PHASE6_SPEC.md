# Phase 6 仕様 — テーマ / スケルトン / 2要素認証 / オフライン

決定日: 2026-08-14

4つのアップデートを、指定順にフェーズ分割して進める。
各フェーズは単体で出荷できる状態にしてから次へ移る。

| 順 | フェーズ | 主眼 | 記号 |
|---|---|---|---|
| 1 | ダーク／ライトモード | UX | THM |
| 2 | スケルトンスクリーン | UX（体感速度） | SKL |
| 3 | 2要素認証（メール6桁） | セキュリティ | MFA |
| 4 | オフラインモード | ロジック | OFL |
| 後 | 生体認証 | セキュリティ | BIO |

生体認証（BIO）は上記4つがすべて完了してから着手する。

---

## THM — ダーク／ライトモード

### 現状

`globals.css` の `:root` にダーク固定のトークンが1組だけある。
`--page #2a2a2a` / `--ink #f5f5f5` / アクセントはティファニーブルー。

### 方針

**3状態を持つ**。「システムに従う（既定）」「ライト」「ダーク」。
システム追従が既定なので、初回訪問者は OS の設定どおりの見た目になる。

トークンは二層で定義する。

1. `:root` に**ライトの全色**を書く（どの色も必ずここに定義がある）
2. `@media (prefers-color-scheme: dark)` を `:root:not([data-theme="light"])`
   で守って、ダークの色**だけ**を上書きする
3. `:root[data-theme="dark"]` でも同じ上書きをして、明示選択が常に勝つようにする

この形なら、メディアクエリの中にしか定義が無い色が生まれない。

### ライトパレット

モスがかった暖かい無彩色で組む（キャラクターの紙色と喧嘩させない）。

| トークン | ライト | ダーク（現行） | 備考 |
|---|---|---|---|
| `--canvas` | `#ecebe7` | `#242424` | エディタのくぼんだ面 |
| `--page` | `#f6f5f2` | `#2a2a2a` | ページ地 |
| `--card` | `#ffffff` | `#333333` | |
| `--card-raised` | `#f0efeb` | `#3a3a3a` | ホバー面 |
| `--line` | `#e0dfd9` | `#424242` | |
| `--ink` | `#24261f` | `#f5f5f5` | |
| `--muted` | `#6b6f63` | `#a3a3a3` | |
| `--placeholder` | `#9ba193` | `#6f6f6f` | |
| `--accent` | `#0abab5` | `#0abab5` | 塗り。共通 |
| `--accent-soft` | `#0a8f8b` | `#81d8d0` | **地の上に置く文字色**。役割が同じで明度が逆 |
| `--accent-deep` | `#066e6a` | `#078e8a` | |
| `--on-accent` | `#06302e` | `#10302e` | アクセント塗りの上の文字 |
| `--warm` | `#b7791f` | `#fbbf24` | |
| `--danger` | `#d43d3d` | `#f87171` | |

新規トークン（今までハードコードしていたもの）:

| トークン | 用途 | ライト | ダーク |
|---|---|---|---|
| `--dot` | キャンバスの方眼ドット | `#d8d7d1` | `#3a3a3a` |
| `--shadow-card` | カードの影 | 薄い | 濃い |
| `--shadow-pop` | 浮くパネルの影 | 薄い | 濃い |
| `--edge` | ノードをつなぐ線 | 濃いティール | 淡いティール |
| `--scrim` | モーダルの覆い | `rgba(0,0,0,.35)` | `rgba(0,0,0,.6)` |

`color-scheme` も併せて切り替える（スクロールバーと素のフォーム部品のため）。

### ちらつき対策

`<head>` に同期スクリプトを1つ置き、描画前に
`document.documentElement.dataset.theme` を確定させる。
`<html>` に `suppressHydrationWarning` を付ける（属性をJSが書き換えるため）。

### 保存先

端末（localStorage `mindmap-app:theme`）。
ログイン不要で使える機能なので、プロフィールには保存しない。

### 触るファイル

- `src/app/globals.css` — トークン二層化・ハードコード色の追い出し
- `src/app/layout.tsx` — 同期スクリプト・`suppressHydrationWarning`
- `src/lib/theme.ts`（新） — 解決ロジック（純粋関数。単体テスト対象）
- `src/store/theme-store.ts`（新）
- `src/components/ThemeToggle.tsx`（新）
- `src/app/settings/page.tsx` — 切替UIの設置
- ハードコード色のあるコンポーネント
  （`MindMapCanvas` / `CustomNode` / `PostMapView` / `Celebration` / `map/[id]`）

### 検証

- 単体: テーマ解決（system/light/dark × OS設定）
- E2E: 切替が効き、再読み込み後も保たれる
- 目視: 両モードで全画面（キャラクターの視認性を含む）

---

## SKL — スケルトンスクリーン

### 目的

**体感待ち時間の短縮のみ**。凝った作りにはしない。
読み込みアニメーション程度の位置づけ。

### 現状の問題

認証の初期化中、各画面が `return null` で真っ白になる。
`initializing` を見ている箇所が7画面ある。

### 方針

- 素片を1つだけ作る（`<Skeleton>`）。角丸の面がゆっくり明滅する
- 画面ごとに、その画面の形に合わせて数個並べるだけ
- `prefers-reduced-motion` では明滅を止める（面は残す）
- **一瞬で終わる読み込みでは出さない**。既定 150ms の遅延を入れる
  （出してすぐ消えるほうが、何も出ないより気が散る）

### 対象画面

| 画面 | 待ち | 出すもの |
|---|---|---|
| ホーム | 認証初期化・マップ一覧 | ヘッダ＋カード3枚 |
| エディタ | マップ読込 | キャンバス面＋操作パネル |
| バッジ | 集計 | バッジ格子 |
| コミュニティ | フィード取得 | 投稿カード3枚 |
| 設定 / 初期設定 / 規約同意 | 認証初期化 | フォーム行 |

### 触るファイル

- `src/components/Skeleton.tsx`（新）
- `src/app/globals.css` — 明滅の keyframes
- 上表の各ページ

Next.js の `loading.tsx` は使わない。
本アプリのページはすべてクライアント側で Firebase から取るので、
サーバ側の Suspense 境界では待ちを捕まえられない。

### 検証

- 単体: 遅延つき表示の判定
- E2E: 低速回線で骨組みが出る
- 目視: 明滅が両テーマで見えること

---

## MFA — 2要素認証（メール6桁コード）

### 前提の確認

Firebase Authentication の多要素認証は Identity Platform（有料）が要る上、
SMS と TOTP しか無く、**メールの6桁コードは提供されていない**。
よってアプリ側で実装する。

画面を隠すだけでは意味がない（IDトークンを直接使えば Firestore を叩ける）ので、
**カスタムクレームとセキュリティルールで実際の境界を作る**。

### 設計

```
①ログイン → ②コード送信 → ③6桁入力 → ④Functionsが検証
   → ⑤カスタムクレーム mfa=<時刻> を付与 → ⑥クライアントがトークン更新
   → ⑦ルールが mfa の鮮度を見て許可
```

クレームは2つ。どちらもトークンに載るので、ルール側で追加の読み取りが要らない。

| クレーム | 型 | 意味 |
|---|---|---|
| `mfaRequired` | bool | この利用者は2要素認証を有効にしている |
| `mfa` | number | 最後に6桁コードを通した時刻（秒） |

ルールの条件:
`request.auth.token.mfaRequired != true || request.auth.token.mfa > (now - 30日)`

有効期限は **30日**。日常的に使うアプリで毎回聞くのは重すぎる。

### コードの保管

`twoFactorChallenges/{uid}` に置き、**クライアントからは読み書き一切不可**
（ルールで全拒否。Admin SDK だけが触る）。

| 項目 | 内容 |
|---|---|
| コード | 6桁。**ハッシュで保存**（平文は保存しない） |
| 有効期限 | 10分 |
| 試行回数 | 5回で打ち止め。再送が必要 |
| 再送間隔 | 60秒 |
| 発行上限 | 1時間あたり5回（既存の rate-limit を流用） |

### Cloud Functions

| 関数 | 役割 |
|---|---|
| `startTwoFactor` | コード発行・メール送信 |
| `verifyTwoFactor` | 照合・`mfa` クレーム付与 |
| `setTwoFactorEnabled` | 有効化／無効化（直前の検証必須） |

### メール送信 ← **要判断**

現状このプロジェクトにメール送信の口が無い。
差し替え可能な形にして、環境変数 `MAIL_PROVIDER` で選ぶ:

- `console` — 開発用。コードをログに出すだけ（既定）
- `resend` — Resend API（無料枠 3,000通/月）
- `smtp` — nodemailer 経由の任意のSMTP

**本番稼働にはどれかの契約とドメイン認証が必要**。
Phase 3 に入る前に決めていただきたい（実装自体は `console` のまま進められる）。

### 触るファイル

- `functions/src/two-factor.ts`（新）・`functions/src/mail.ts`（新）・`index.ts`
- `firestore.rules` — `twoFactorChallenges` 全拒否 ＋ 各所に鮮度条件
- `src/types/index.ts` — `twoFactorEnabled` / `twoFactorEnabledAt`
- `src/contexts/AuthContext.tsx` — クレーム読み取り・`needsTwoFactor`
- `src/app/login/verify/page.tsx`（新） — 6桁入力
- `src/app/settings/page.tsx` — 有効化／無効化

### 検証

- 単体: コードの生成・ハッシュ照合・期限・試行上限
- ルール: 2要素認証が有効な利用者の、期限切れトークンでの拒否
- E2E: 有効化 → ログアウト → 再ログインで6桁を要求される

---

## OFL — オフラインモード

### 方針

**データ層は自作しない**。Firebase SDK の `persistentLocalCache`
（IndexedDB・複数タブ対応）を使う。読み取りのキャッシュも、
書き込みの保留と再送も SDK 側が持っている。自前の同期層より確実。

Service Worker は**アプリの殻（HTML/JS/CSS）だけ**を受け持つ。

| 層 | 手段 |
|---|---|
| 画面の殻 | Service Worker（ナビゲーションはネット優先→キャッシュ退避） |
| マップ・プロフィール | Firestore `persistentLocalCache` |
| 未ログインのマップ | 既存の localStorage（すでにオフラインで動く） |
| AI 機能 | オフラインでは押せなくする（サーバが要る） |

### 衝突の扱い（確定仕様）

Firestore の保留書き込みは復帰時に再送され、**フィールド単位の後勝ち**で
解決される。共同編集のノード単位マージ（`merge.ts`）はそのまま活きる。

具体的には:

- オフライン中の編集は端末に溜まり、つながった時点でまとめて送られる
- 同じマップを別の端末・別の人が触っていた場合、**あとから届いた側が残る**
- ノード単位で見ているので、別々のノードを編集していれば両方残る
- 同じノードの本文を両方が書き換えた場合だけ、片方が消える

「勝手に消えた」と見えるのはこの最後の1件だけで、
共同編集の同時操作でもともと起こりうる範囲に収まっている。

### UI

- オフライン中は帯を出す（「オフラインです。編集は端末に保存され、
  つながったときに同期されます」）
- 未同期の変更があるあいだは、その旨を出す
- AI に関する操作は理由つきで無効化する

### 触るファイル

- `src/lib/firebase.ts` — `initializeFirestore` + `persistentLocalCache`
- `public/sw.js`（新）・`src/components/ServiceWorkerRegistrar.tsx`（新）
- `src/lib/offline.ts`（新） — オンライン判定・保留件数
- `src/components/OfflineBanner.tsx`（新）
- `src/components/mindmap/ControlPanel.tsx` — AI操作の無効化
- `src/app/layout.tsx`

### 注意

`persistentLocalCache` は `getFirestore()` ではなく
`initializeFirestore()` で渡す。既存の `firebaseDb()` の中身を差し替える。

### 検証

- 単体: オフライン判定
- E2E: `context.setOffline(true)` で編集 → 復帰 → 反映
- 目視: 帯の表示、AI操作の無効化

---

## BIO — 生体認証（後回し）

上記4フェーズの完了後に着手する。
WebAuthn / パスキーで、2要素目をメールの代わりに使えるようにする。
`mfa` クレームの仕組みはそのまま流用できる設計にしてある。
