import type { NextConfig } from "next";

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

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
