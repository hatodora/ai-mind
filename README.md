# 🧠 AIマインドマップ

> 人間の脳で考えよう。行き詰まったらAIと対話して想像を膨らませよう。

ユーザーとAIが1ターンずつ交互にアイデアを出し合うマインドマップWebアプリ。

## 技術スタック

- **Next.js 16** (App Router)
- **TypeScript** + **Tailwind CSS**
- **React Flow** — マインドマップUI
- **Zustand** — 状態管理
- **Gemini API** (`gemini-2.5-flash`) — AI提案・説明・レビュー
- **localStorage** — マップ保存（プロトタイプ）

## ローカル開発

```bash
npm install
echo "GEMINI_API_KEY=your_key_here" > .env.local
npm run dev
```

http://localhost:3000 で起動します。

## 主な機能

| 機能 | 説明 |
|------|------|
| テーマ設定 | 中心テーマを1つ決めてマインドマップ開始 |
| ターン制 | ユーザー → AI の順で交互にノード追加 |
| AI提案 | 選択ノードから派生するアイデアを2〜3個提案 |
| わからない | ノードを小学生でも分かる言葉で解説 |
| AIレビュー | マップ全体を見て次のアクションを提案 |
| ローカル保存 | localStorageに自動保存 |

## デプロイ (Netlify)

1. GitHubリポジトリにpush
2. Netlifyで「Import from Git」
3. 環境変数 `GEMINI_API_KEY` を設定
4. Deploy

`netlify.toml` で `@netlify/plugin-nextjs` を自動使用します。

## 開発状況

- [x] Phase 0: 環境構築
- [x] Phase 1 MVP: テーマ・ターン制・AI提案・説明・レビュー
- [ ] Phase 2: PWA・パーソナライズ・共有
- [ ] Phase 3: ゲーミフィケーション・ネイティブアプリ
