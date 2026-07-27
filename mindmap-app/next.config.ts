import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * セキュリティヘッダー（SEC-03）。
 * 全ページ共通で付与する。CSP はインラインスクリプトの nonce 対応が必要なため
 * ここでは設定せず、将来の強化項目とする（PHASE5_SPEC.md 参照）。
 */
const securityHeaders = [
  // MIMEスニッフィング防止
  { key: "X-Content-Type-Options", value: "nosniff" },
  // クリックジャッキング防止（iframe 埋め込みを全面禁止）
  { key: "X-Frame-Options", value: "DENY" },
  // 外部遷移時にURLのパス・クエリを漏らさない
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 使っていない強力なブラウザ機能を明示的に無効化
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

/**
 * Sentry（REL-09）のビルド時設定。
 *
 * ソースマップのアップロードは SENTRY_AUTH_TOKEN・組織・プロジェクトが
 * 揃っているときだけ行う。未設定でもビルドは通る（警告が出るだけ）ので、
 * CI やローカルで Sentry を設定していなくても支障がない。
 */
const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // ビルドログを汚さない。設定漏れの検知は SENTRY_DEBUG=true で行う
  silent: !process.env.SENTRY_DEBUG,
  telemetry: false,
  // 認証情報が無いときはアップロードを試みない（ビルド失敗を避ける）
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
};

export default withSentryConfig(nextConfig, sentryBuildOptions);
