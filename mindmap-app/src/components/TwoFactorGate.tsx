"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * 2要素認証が済むまで、他の画面へ行かせない見張り（MFA-03）。
 *
 * 守り自体はセキュリティルールが担っている（トークンを直接使っても弾かれる）。
 * ここがやるのは «何も出ない画面で固まらせない» ことで、
 * 拒否され続ける画面ではなく、コード入力へ案内するのが役目。
 *
 * 何も描かない。レイアウトに1つ置く。
 */

/** 検証前でも開いてよい場所 */
const ALLOWED = [
  "/login", // /login/verify を含む。別アカウントへの切り替えも要る
  "/terms",
  "/privacy",
];

export function TwoFactorGate() {
  const { initializing, needsTwoFactor } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (initializing || !needsTwoFactor) return;
    if (ALLOWED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return;
    }
    router.replace("/login/verify");
  }, [initializing, needsTwoFactor, pathname, router]);

  return null;
}
