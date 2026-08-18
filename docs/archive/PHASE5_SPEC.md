# Phase 5 確定仕様（2026-07-18 ユーザー決定）

スコープ: **実装（NF-04改・NF-05）→ セキュリティ強化（SEC-01〜08 の全数検証）**。
NF-02（3D表現）は実装しない。

---

## NF-04 改: お助け機能（行き詰まり救済）

既存の簡易版（45秒無操作でAI誘導パネル）を以下の確定仕様に**置き換える**。

### 発動条件（すべて満たしたときだけ表示。ポップアップは出さない）
- 最後の活動（ノード追加・入力）から **3分（180秒）** 経過
  - 自分の番でノードが伸びないとき・AIターン終了後に伸びないとき、どちらも同じ計測
- 自分の番で、AI提案が画面に残っていない
- マップの総ノード数 **30以上**
- **AI使用率が5割以下**（root を除く AIノード / (人間+AI) ）
- アシストレベルが off でない・ノードを選択中

### 効果
- ゲージ残量に**関係なく** AI提案を1回無料で使える（spendGauge しない）
- 対象は **AI提案（ノード伸ばし）のみ**。解説・レビューは通常のまま
- aiRequestCount（バッジ用）は通常どおりカウント
- 提案の採用・スキップ・一括採用ペナルティは通常フローと同じ
- **何度でも発動**: 使用でタイマーがリセットされ、再び3分停滞＋条件成立で出現

### AI使用率の円グラフ
- マップ（キャンバス）右上に簡易ドーナツグラフを表示
- **総ノード数30以上のマップのみ表示**（お助け機能の前提を満たすマップ）
- 内容: 人間 vs AI の割合（root 除く）。AI% を中央に表示
- 5割超（お助け対象外）のときは AI% を警告色にする

## NF-05: トピックカテゴライズ

### 実行方式（確定: 結論と同時に取得）
- 全体レビュー（結論）の AI 呼び出し **1回に統合**。追加コスト・追加待ち時間なし
- プロンプト末尾で USED_NODES 行（NF-03）に加えて **CATEGORIES 行**を出力させる:
  ```
  CATEGORIES: [{"name":"トピック名","nodes":["ラベルA","ラベルB"]}]
  ```
  - トピックは 3〜6 個、各ノードは最大1トピックにのみ所属
- サーバー側でパースして本文から除去し `{ review, usedNodeLabels, categories }` を返す
- パース失敗時は categories なしで本文のみ（機能劣化に留める。NF-03 と同じ方針）
- API Route と Cloud Functions の**両方**に適用（splitReviewResponse は複製関係にある）
- プロンプト変更でAIキャッシュキーは自然に変わる

### クライアント表示
- レビュー本文の下にトピックチップを並べる（トピック名 ＋ 全体に占める割合%）
- チップをタップ → 関連ノードが光る（NF-03 の highlightedNodeIds 機構を再利用）
- 同じチップを再タップ or 解除 → 消灯
- ラベル→ノードidはラベル完全一致で引き当て（同名ノードはすべて光らせる）

### 検証（サーバー側）
- トピック数 ≤ 8・トピック名 ≤ 40字・ラベルは既存の MAX_LABEL_LEN
- name / nodes の型が崩れている要素は捨てる

## セキュリティ強化（実装完了後）

SEC-01〜SEC-08 を**1項目ずつ徹底検証**する（項目に抜けがないかの全数確認が目的）。

| ID | 項目 |
|----|------|
| SEC-01 | Firestoreセキュリティルール |
| SEC-02 | APIキー保護 |
| SEC-03 | 入力サニタイズ（XSS） |
| SEC-04 | レートリミット |
| SEC-05 | 認証トークン検証 |
| SEC-06 | 個人情報保護 |
| SEC-07 | 依存パッケージ監査 |
| SEC-08 | 最終横断セキュリティレビュー |

**進め方（ユーザー指示）**: 1項目終わるごとに結果を報告し、
**ユーザーの指示があるまで次の項目へ進まない**。

### SEC-01 検証結果（2026-07-18 完了）

全259行 × 全コレクション × 全操作を精査。基本設計（デフォルト全拒否・メール確認必須・
昇格不可・なりすまし不可・hasOnly・Functions専用コレクションの全面拒否）は健全。
検出6件のうち、ユーザー判断で以下を適用:

- **F-3 修正**: 投稿削除時にコメントを連鎖削除（community.ts の deletePost を
  batch 分割削除に変更＋rules で「親投稿の作者はコメント削除可」を許可。
  副作用として投稿者は自分の投稿に付いた任意のコメントを消せる＝モデレーション権）
- **F-4 修正**: users.email は認証トークンの email と一致必須（rules 1行）

**容認した既知の制限（修正しない）**:

- **F-2**: commentCount の ±1 更新はコメント作成/削除との同時実行をルールで強制
  できない（rules は batch 内の他操作を特定できない）。15歳以上の任意ユーザーが
  カウントだけを増減できるが、表示専用値であり実害は整合性のみ。
  Functions トリガー化は「Functions を使わない」負荷方針と矛盾するため容認。
- **F-5**: maps/posts の nodes・edges 配列の**要素**内容は rules で検証不能
  （rules 言語は配列要素を反復できない）。歯止めは件数上限＋Firestore の
  1MiB 文書上限。表示側の XSS 耐性は SEC-03 で検証する。
- **F-6**: maps の visibility=='public' は未ログイン読み取りを許す設計。
  現状クライアントは public を設定しないため露出なし。public 機能を作る際に再確認。
- **F-1 解決（2026-07-18）**: 誕生日の自己変更は**2回まで**許可し、
  3回目以降は管理者への問い合わせが必要（rules の `birthDateEditsOk()` で
  強制。`UserProfile.birthDateEdits` を追加）。既存の誕生日を空にして
  再設定することで回数制限を回避できないよう、rules は「一度設定した
  誕生日は消せない」も強制する。
  UI: 設定画面は残り変更回数を表示し、上限到達時は入力欄を disabled にして
  問い合わせ案内を表示（[settings/page.tsx](mindmap-app/src/app/settings/page.tsx)）。
  同時に誕生日入力を `<input type="date">` から
  [BirthDatePicker](mindmap-app/src/components/BirthDatePicker.tsx)
  （年・月・日の3セレクト）に置き換えた。カレンダーを何十年分もめくる
  操作が面倒というフィードバックに対応。存在しない日付（2/30等）は
  選べないよう日の選択肢を年月に応じて絞り込み、うるう年→非うるう年の
  切替時は末日へ自動クランプする。

### SEC-02〜08 検証結果（2026-07-18 完了）

**SEC-02 APIキー保護 — 問題なし**
- Groq キーはサーバー専用（API Routes / Functions defineSecret）。`.env*` は
  gitignore 済み・git 履歴に混入なし・クライアントバンドル（.next/static）に
  「GROQ」文字列も実キーも不在を確認。
- Firebase の NEXT_PUBLIC 設定は公開前提の設計値（保護はルール＋認証が担う）。

**SEC-03 XSS/入力サニタイズ — ヘッダー追加**
- dangerouslySetInnerHTML / innerHTML / eval 系: 使用ゼロ。表示は全て React の
  自動エスケープ経由。URL 由来の値（招待 token 等）は Functions 検証のみに使用。
- next.config.ts にセキュリティヘッダー4種を追加し実応答で確認
  （nosniff / X-Frame-Options: DENY / Referrer-Policy / Permissions-Policy）。
- **将来の強化**: CSP は nonce 対応が必要なため未設定。photoURL は img src
  にのみ使われ本人にしか表示されない（低リスク容認）。

**SEC-04 レートリミット — 匿名経路に追加**
- Functions: uid ごと 30回/時（Firestore トランザクション）を AI 3関数で確認。
- API Routes（匿名フォールバック）は無制限だったため、src/lib/rate-limit.ts を
  新設し IP ごと 30回/時を3ルートに適用。31回目から 429 になることを実測。
- **既知の限界**: プロセス内メモリのためサーバーレス分散時はインスタンス毎の窓。
  XFF は信頼プロキシ配下でのみ正確。必要になれば共有ストア化。

**SEC-05 認証トークン検証 — 問題なし**
- 全5 Functions（AI 3本＋招待2本）が requireVerifiedUser
  （IDトークン検証＋email_verified）を先頭で実行。createMapInvite は所有者
  チェック、acceptMapInvite は期限・人数上限・visibility 引き上げのみ。
- 招待 token は randomUUID（122bit）で総当たり不可能。
- 観察: 期限切れ invites の掃除処理なし（蓄積のみ・影響なし）。App Check 未使用
  （任意の強化項目）。

**SEC-06 個人情報保護 — 文書化**
- birthDate/age は users/{uid}（本人のみ読める）から出ない。AI へは粗い
  年齢帯（ageBand）のみ送信。コミュニティは既定匿名・表示名はオプトイン。
- collaboratorNames は招待承諾時に表示名を共有（承諾＝同意とみなす）。
- **既知のギャップ**: アカウント削除（退会）機能が未実装。実装時は
  Auth アカウント＋profile＋bookmarks サブコレクション＋自分のマップ・投稿・
  コメントの扱いを設計すること。投稿の authorName は投稿時点のスナップショット
  （後から匿名に切り替えても過去投稿には残る）。

**SEC-07 依存パッケージ監査 — 修正＋容認2件**
- app: npm audit fix（babel/brace-expansion/js-yaml）＋ next 16.2.5→16.2.10
  （high: middleware バイパス。本アプリは middleware 不使用だが更新）。
  ビルド・lint・実画面の動作確認済み。
- 容認: next 同梱 postcss の moderate（ビルド時ツール・ユーザーCSS入力なし、
  修正案が next@9 への破壊的ダウングレードで不合理）。
- functions: npm audit fix 適用。残りは uuid moderate 1系統（firebase-admin の
  推移的依存・当該 API を buf 付きで未使用のため非該当。修正は firebase-admin
  メジャー更新が必要で、次回の計画的更新時に対応）。

**SEC-08 横断 — 問題なし**
- console.log による機微情報出力なし・TODO/FIXME 残置なし・Functions の
  入力検証（asString/asAgeBand/asPersonality の許可リスト）確認。
- tsc / ESLint / 本番ビルド クリーン。

## デプロイ

Phase 4 から持ち越しの `firebase deploy --only firestore:rules,functions` に、
NF-05 の aiReview プロンプト変更（functions）が加わる。実装完了後にまとめてデプロイ。
