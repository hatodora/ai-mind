# AIマインドマップ（思索 / Mindmap）

> 人間の脳で考えよう。行き詰まったらAIと対話して想像を膨らませよう。

ユーザーとAIが1ターンずつ交互にアイデアを出し合うマインドマップWebアプリ。
実装本体は [`mindmap-app/`](mindmap-app/)（Next.js）。

## ローカル開発

```bash
cd mindmap-app
npm install
npm run dev
```

http://localhost:3000 で起動します。環境変数は `mindmap-app/.env.local` に設定（詳細は各ドキュメント参照）。

## ドキュメント

進捗・タスクは [`TASKS.md`](TASKS.md) が一次情報。その他は [`docs/`](docs/) 配下。

| ドキュメント | 内容 |
|------|------|
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | 要件定義 |
| [docs/DESIGN_SPEC_V2_JP.md](docs/DESIGN_SPEC_V2_JP.md) | UI/UXデザイン仕様（v2） |
| [docs/RELEASE_ROADMAP.md](docs/RELEASE_ROADMAP.md) | 事業化・本番公開ロードマップ |
| [docs/PORTAL_ADMIN_SPEC.md](docs/PORTAL_ADMIN_SPEC.md) | ポータル＆管理ダッシュボード仕様 |
| [docs/PRELAUNCH_CHECKLIST.md](docs/PRELAUNCH_CHECKLIST.md) | 本番公開前チェックリスト |
| [docs/SECURITY_PRODUCTION.md](docs/SECURITY_PRODUCTION.md) | 本番セキュリティ有効化手順 |
| [docs/DEPLOY.md](docs/DEPLOY.md) | デプロイ・障害対応手順 |
| [docs/NOTION_SETUP.md](docs/NOTION_SETUP.md) | TASKS.md ↔ Notion 同期セットアップ |
| [docs/archive/](docs/archive/) | 完了済みフェーズの仕様書・過去の計画書（履歴として保管） |

## デプロイ

本番は Vercel、Netlify は予備系。手順は [docs/DEPLOY.md](docs/DEPLOY.md) を参照。
