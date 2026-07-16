# Phase 4 確定仕様（2026-07-16 ユーザー決定）

スコープ: **NF-01（コミュニティ）** と **NF-03（レビュー根拠の可視化）**。
NF-02（3D表現）・NF-05（カテゴライズ）は実装しない。

---

## NF-01a: マインドマップの共同編集

ログインユーザー間でマップを共有し、リアルタイムに共同編集できる。

### 招待
- **招待リンク方式**。所有者がエディタの「共有」からリンクを発行し、相手に送る。
- リンクを開いたユーザーは（ログイン後）自動で editor として参加。
- 実装: Cloud Functions の onCall 2本（Groq は使わないので軽量）
  - `createMapInvite({ mapId })` → 所有者のみ。`invites/{token}` を作成し token を返す（7日で失効）
  - `acceptMapInvite({ token })` → token を検証し、`maps/{mapId}.sharedWith[uid] = "editor"`、
    `visibility = "shared"` に更新して mapId を返す
- invites コレクションはクライアント直アクセス全面禁止（rules で deny）。
- 所有者は共有モーダルから参加者を外せる（sharedWith の直接編集は所有者のみ rules 済み）。

### リアルタイム同期
- Firestore `onSnapshot` で相手の変更を数秒以内に反映（**ノード単位マージ**）。
- 自分の書き込みエコーは `metadata.hasPendingWrites` でスキップ。
- マージ規則（src/lib/merge.ts、純関数）:
  - ノード/エッジを id でマージ。基本はリモートを正とする
  - 直近5秒以内にローカルで触った（追加・編集・移動した）要素はローカルを優先
  - 直近5秒以内にローカルで削除した要素はリモートにあっても復活させない
  - マージ結果がリモートと異なる場合はデバウンス保存で差分を癒す（発散防止）
- リスナーはログイン済み＆Firestoreマップのみ。ローカル（匿名）マップは購読しない。
- ゲージ・ターン等のマップ状態は共同編集者間で共有（1つのマップに1つのゲージ）。

### ホーム一覧
- 自分のマップに加えて「共有されたマップ」も表示（`sharedWith.{uid}` クエリ、
  orderBy はインデックス制約のためクライアント側ソート）。

## NF-01b: コミュニティ公開（タイムライン）

### 投稿
- エディタでノードを選択 → 「このノードを公開」→ プレビュー → 投稿。
- 公開単位は **選択ノード＋その子孫ツリー**。**公開時点のスナップショット**
  （元マップをその後編集しても投稿は変わらない）。位置情報も保存しミニマップ描画に使う。
- 投稿者名はプロフィール設定「コミュニティで名前を表示」に従う（既定オフ＝匿名）。
- 自分の投稿は削除可能。

### コメント
- 投稿詳細画面で入力。**既定は匿名**、プロフィール設定で名前表示に切替可。
- 自分のコメントは削除可能。
- commentCount はクライアントの batch（コメント作成＋投稿の +1）で更新。
  rules で「commentCount のみ・±1 のみ」を強制し、Functions を使わない（負荷・コスト減）。

### ブックマーク
- 投稿をブックマークでき、コミュニティ画面の「ブックマーク」タブで一覧。
- `users/{uid}/bookmarks/{postId}` に theme 等を非正規化して保存
  （一覧表示で投稿を N 回読まない＝負荷減。元投稿が消えたら開いた時に案内）。

### 年齢制限
- **閲覧・ブックマークは全年齢**（ログイン必須）。
- **投稿とコメントは15歳以上**（teenager / worker）。
  クライアントで UI を隠すのに加え、rules の `get(users/{uid}).age >= 15` で強制。

### リアルタイム性と負荷のバランス（ユーザー要件）
- フィード: 通常クエリ＋ページネーション（20件ずつ）。**onSnapshot は張らない**
- 投稿詳細のコメント欄のみ onSnapshot（画面を開いている間だけ）
- ブックマーク一覧: 非正規化データで 1 クエリ
- 共同編集: 開いているマップ 1 件のみ購読

### データモデル
```
posts/{postId}:
  id, authorUid, authorName (string | null=匿名), theme,
  rootLabel（選択ノードのラベル）, nodes[{id,label,role,position}] (≤200),
  edges[{id,source,target}], commentCount, createdAt

posts/{postId}/comments/{commentId}:
  id, authorUid, authorName (string | null=匿名), text (≤500), createdAt

users/{uid}/bookmarks/{postId}:
  postId, theme, rootLabel, nodeCount, authorName, postCreatedAt, createdAt

invites/{token}:
  mapId, ownerUid, role("editor"), createdAt, expiresAt
```

### UserProfile 追加
- `showNameInCommunity?: boolean`（既定 false＝匿名）。設定画面にトグル追加。

## NF-03: レビュー根拠ノードのハイライト

AIの「全体レビュー」がどのノードを根拠にしたかをマップ上でハイライトする
（AI要約の非ブラックボックス化）。

- review プロンプトを変更: 本文の末尾に `USED_NODES: ["ラベル1", ...]` の1行を
  必ず出力させる（Functions / API Route 両方。プロンプト変更でキャッシュキーも自然に変わる）。
- サーバー側でこの行をパースして本文から除去し、`{ review, usedNodeLabels }` を返す。
  パース失敗時は usedNodeLabels 無しで本文のみ返す（機能劣化に留める）。
- クライアントはラベル→ノードid を突き合わせ、ストアの `highlightedNodeIds` に設定。
  CustomNode がハイライト表示（アクセントリング）。
- ハイライトはノード選択や新しいレビューで更新、「解除」ボタンでクリア。

## 実装しない（今回スコープ外）

- プレゼンス表示（誰が今開いているか）・カーソル共有
- 投稿への「いいね」・通報機能（必要になったら追加）
- viewer 権限のUI（データモデルは対応済み。招待は editor のみ発行）
- コメントへの返信ツリー

## デプロイ

Phase 4 完了時に必要:
```
firebase deploy --only firestore:rules,functions
```
（invites Functions 2本＋rules の posts/comments/bookmarks 追加を含む）
