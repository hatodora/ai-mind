import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import localFont from "next/font/local";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeSync } from "@/components/ThemeSync";
import { TwoFactorGate } from "@/components/TwoFactorGate";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// 見出し用: Satoshi (Fontshare / ITF Free Font License)
const satoshi = localFont({
  variable: "--font-satoshi",
  src: [
    { path: "../fonts/Satoshi-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/Satoshi-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/Satoshi-Bold.woff2", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "思索 / Mindmap — AIマインドマップ",
  description:
    "人間の脳で、考えよう。行き詰まったらAIと対話して想像を膨らませよう。",
  icons: {
    icon: "/favicon.ico?v=2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-theme はスクリプトが描画前に書き込むので、
    // サーバの出力と食い違って当然。警告を止めておく
    <html
      lang="ja"
      suppressHydrationWarning
      className={`${notoSansJP.variable} ${satoshi.variable} h-full antialiased`}
    >
      <head>
        {/*
          最初の描画より前にテーマを確定させる（THM-02）。
          これが無いと、既定のライトで一瞬描かれてから
          ダークへ切り替わるちらつきが出る。
          同期実行が要るので next/script ではなく素の script で置く。
        */}
        <script
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeSync />
        <AuthProvider>
          {/* 2要素認証が済むまでコード入力へ案内する（MFA-03）。
              守り自体はセキュリティルール側にある */}
          <TwoFactorGate />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
