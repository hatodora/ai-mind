# 開発計画書

## 技術スタック

### フロントエンド
| 技術 | 選定理由 |
|------|----------|
| **Next.js 14 (App Router)** | SSR/SSG対応・APIルート内包・Vercelとの親和性 |
| **TypeScript** | 型安全・チーム開発への拡張性 |
| **Tailwind CSS** | スマホ対応レスポンシブを素早く実装 |
| **React Flow** | インタラクティブなマインドマップUI（ノード・エッジ操作） |
| **Zustand** | 軽量なグローバル状態管理（マップ状態・ターン管理） |

### バックエンド・AI
| 技術 | 選定理由 |
|------|----------|
| **Next.js API Routes** | フロントと同一リポジトリで管理・デプロイが容易 |
| **Claude API (claude-sonnet-4-6)** | 日本語理解・創造的提案・コスト効率が優秀 |
| **Supabase** | PostgreSQL・認証・リアルタイム機能をオールインワンで提供 |

### インフラ・ツール
| 技術 | 用途 |
|------|------|
| **Vercel** | ホスティング・CI/CD（GitHub連携で自動デプロイ） |
| **GitHub** | ソースコード管理 |
| **pnpm** | 高速パッケージマネージャ |

---

## ディレクトリ構成

```
ai-mindmap/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (main)/
│   │   ├── page.tsx              # ホーム
│   │   ├── new/page.tsx          # テーマ設定
│   │   └── map/[id]/page.tsx     # マインドマップエディタ
│   ├── api/
│   │   ├── ai/suggest/route.ts   # AI提案エンドポイント
│   │   ├── ai/explain/route.ts   # AI説明エンドポイント
│   │   ├── ai/review/route.ts    # AIレビューエンドポイント
│   │   └── maps/route.ts         # マップCRUD
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── mindmap/
│   │   ├── MindMapCanvas.tsx     # React Flowキャンバス
│   │   ├── CustomNode.tsx        # カスタムノードコンポーネント
│   │   ├── TurnIndicator.tsx     # ユーザー/AIターン表示
│   │   └── AISuggestionPanel.tsx # AI提案パネル
│   ├── ui/                       # 共通UIコンポーネント
│   └── layout/
├── lib/
│   ├── claude.ts                 # Claude APIクライアント
│   ├── supabase.ts               # Supabaseクライアント
│   └── mindmap-utils.ts          # マップデータ操作ユーティリティ
├── store/
│   └── mindmap-store.ts          # Zustand状態管理
├── types/
│   └── index.ts                  # 型定義
└── supabase/
    └── migrations/               # DBマイグレーション
```

---

## 開発フェーズ

### Phase 0: 環境構築（1〜2日）
- [ ] Next.js プロジェクト初期化（TypeScript + Tailwind）
- [ ] Supabase プロジェクト作成・接続設定
- [ ] Claude API キー取得・設定
- [ ] Vercel デプロイ設定・GitHub連携
- [ ] ESLint / Prettier / Husky 設定

### Phase 1: MVP（1〜2週間）
**目標**: テーマを入力してAIとターン制でマインドマップを作れる状態

- [ ] **データモデル設計・DBマイグレーション**
  - `maps` テーブル（id, theme, nodes, edges, user_id, created_at）
  - `turns` テーブル（id, map_id, role, content, created_at）

- [ ] **マインドマップUIの実装**
  - React Flow セットアップ
  - カスタムノード（ユーザーノード / AIノード を色分け）
  - ノード追加・削除・移動

- [ ] **テーマ設定画面**
  - テーマ入力フォーム
  - マップ初期化ロジック

- [ ] **ターン制ロジック実装**
  - ユーザーターン：テキスト入力 → ノード追加
  - AIターン：Claude API呼び出し → 提案2〜3個をパネルに表示
  - ユーザーが提案を採用/却下/編集

- [ ] **Claude AI 提案プロンプト設計**
  ```
  システム: あなたはマインドマップの協働パートナーです。
  ユーザーの思考を邪魔せず、行き詰まったときだけサポートします。
  提案は短く・具体的・日常語で2〜3個に絞ってください。
  ```

- [ ] **ローカル保存（localStorage）**

### Phase 2: コア機能拡充（2〜3週間）
**目標**: 使い続けられるプロダクトにする

- [ ] **ユーザー認証**（Supabase Auth）
  - メール/パスワード登録・ログイン
  - Googleソーシャルログイン
  - マップのクラウド保存・一覧表示

- [ ] **「わからない」機能**
  - ノード選択 → 説明ボタン → AIが子供でも分かる言葉で解説

- [ ] **AIレビュー機能**
  - 「完成」ボタン → マップ全体をAIが分析
  - 問題解決のための次のステップを提示

- [ ] **スマートフォン最適化**
  - タッチ操作（ピンチズーム・ドラッグ）最適化
  - ボトムシートUI（AI提案パネル）
  - PWA設定（ホーム画面追加・オフライン基本動作）

- [ ] **AIパーソナライズ（基礎）**
  - ユーザーが採用したノードの傾向をコンテキストとしてAPIに渡す

### Phase 3: 体験向上・成長機能（3〜4週間）
**目標**: 継続使用・口コミ拡散できるプロダクトに

- [ ] **ゲーミフィケーション**
  - ターン数バッジ・連続使用ストリーク
  - マップ完成時の達成演出

- [ ] **共有機能**
  - 公開URLの生成（閲覧専用）
  - PNG/SVGエクスポート

- [ ] **他者意見取り込み**
  - 匿名フィードバック機能
  - コミュニティ提案（オプション）

- [ ] **パフォーマンス最適化**
  - Claude APIのストリーミング対応（体感速度向上）
  - プロンプトキャッシュ活用（コスト削減）

---

## データモデル

### maps テーブル
```sql
CREATE TABLE maps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users,
  theme       TEXT NOT NULL,
  nodes       JSONB NOT NULL DEFAULT '[]',
  edges       JSONB NOT NULL DEFAULT '[]',
  turn_count  INTEGER DEFAULT 0,
  is_public   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

### turns テーブル
```sql
CREATE TABLE turns (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id     UUID REFERENCES maps(id) ON DELETE CASCADE,
  role       TEXT CHECK (role IN ('user', 'ai')),
  content    JSONB NOT NULL,  -- { text, suggested_nodes[] }
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## AIプロンプト設計

### ターン制提案プロンプト
```
あなたはユーザーの思考をサポートするマインドマップパートナーです。

ルール:
- ユーザーが主役。あなたはサポート役
- 提案は必ず日本語で、日常語を使う
- 1ターンで提案するノードは2〜3個まで
- 提案は短いフレーズ（10文字以内が理想）
- ユーザーのこれまでの選択傾向に合わせる

現在のテーマ: {theme}
ユーザーがこれまで追加したノード: {user_nodes}
現在のマップ構造: {map_structure}

次のターンで追加するべき関連キーワードを2〜3個、JSON配列で返してください。
```

### 説明プロンプト
```
マインドマップのノード「{node_text}」について、
小学生でもわかるように2〜3文で説明してください。
難しい言葉は使わず、身近な例えを使ってください。
```

---

## マイルストーン

| マイルストーン | 期間 | 成果物 |
|--------------|------|--------|
| M1: 環境構築完了 | Day 1-2 | 動くNext.jsアプリがVercelにデプロイ済み |
| M2: MVP完成 | Week 1-2 | AIとターン制でマインドマップが作れる |
| M3: 認証・クラウド保存 | Week 3-4 | ログインしてマップを保存・管理できる |
| M4: スマホ最適化 | Week 4-5 | スマホで快適に使えるPWA |
| M5: ベータ版公開 | Week 6 | 外部ユーザーへの公開・フィードバック収集 |

---

## 開発の進め方

1. **このリポジトリで作業**: `/Users/matsumotohayato/AIマインドマップ`
2. **段階的に開発**: Phase 0 → 1 → 2 の順で進める
3. **動くものを最優先**: 完璧より動くことを優先して素早くイテレーション
4. **ユーザーテスト**: M2完成後にまず自分で毎日使い、感触をフィードバック

---

## 次のステップ

**今すぐ始めること**:
```bash
cd '/Users/matsumotohayato/AIマインドマップ'
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir=no
```

準備できたら「Phase 0 を始めて」と指示してください。
