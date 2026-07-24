"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getRepo, purgeExpiredAnonMaps, createFirestoreRepo } from "@/lib/repo";
import { storage } from "@/lib/storage";
import type { MindMap } from "@/types";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return "今日";
  if (diff < 2 * day) return "昨日";
  if (diff < 7 * day) return `${Math.floor(diff / day)}日前`;
  if (diff < 30 * day) return `${Math.floor(diff / (7 * day))}週間前`;
  return new Date(ts).toLocaleDateString("ja-JP");
}

/**
 * 思考のバランスリング（UP-03）。
 * これまでの全ノードのうち、自分の言葉 vs AI提案の割合をドーナツで示す。
 */
function ThinkRing({
  userNodes,
  aiNodes,
}: {
  userNodes: number;
  aiNodes: number;
}) {
  const total = userNodes + aiNodes;
  if (total === 0) return null;
  const R = 48;
  const C = 2 * Math.PI * R;
  const f = userNodes / total;
  const pct = Math.round(f * 100);

  return (
    <div className="card-soft flex flex-wrap items-center gap-x-7 gap-y-5 p-5 sm:p-6">
      <svg
        viewBox="0 0 120 120"
        className="h-28 w-28 shrink-0 sm:h-32 sm:w-32"
        role="img"
        aria-label={`自分の考え ${pct}%、AIの提案 ${100 - pct}%`}
      >
        {/* 下地 */}
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="var(--card-raised)"
          strokeWidth="13"
        />
        {/* AI（残り） */}
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="var(--warm)"
          strokeWidth="13"
          strokeDasharray={`${C * (1 - f)} ${C}`}
          strokeDashoffset={-C * f}
          transform="rotate(-90 60 60)"
        />
        {/* 自分（メイン） */}
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="13"
          strokeLinecap={f > 0 && f < 1 ? "round" : "butt"}
          strokeDasharray={`${C * f} ${C}`}
          transform="rotate(-90 60 60)"
        />
        <text
          x="60"
          y="57"
          textAnchor="middle"
          className="font-display"
          fill="var(--ink)"
          fontSize="22"
          fontWeight="700"
        >
          {pct}%
        </text>
        <text
          x="60"
          y="74"
          textAnchor="middle"
          fill="var(--muted)"
          fontSize="9"
        >
          自分の考え
        </text>
      </svg>

      <div className="min-w-[150px] flex-1">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[13px] text-ink">
              <span className="h-2.5 w-2.5 rounded-full bg-accent" />
              自分の考え
            </span>
            <span className="font-display text-xs tracking-wide text-muted">
              {userNodes} nodes
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[13px] text-ink">
              <span className="h-2.5 w-2.5 rounded-full bg-warm" />
              AIの提案
            </span>
            <span className="font-display text-xs tracking-wide text-muted">
              {aiNodes} nodes
            </span>
          </div>
        </div>
        <Link
          href="/badges"
          className="mt-4 inline-block text-xs text-accent-soft underline-offset-4 hover:underline"
        >
          バッジを見る →
        </Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { user, profile, initializing, needsProfile, needsTermsAccept, signOut } =
    useAuth();
  const [maps, setMaps] = useState<MindMap[]>([]);
  const [localCount, setLocalCount] = useState(0);
  const [migrating, setMigrating] = useState(false);

  // 規約バージョンが上がった既存ユーザーを再合意画面へ誘導する（REL-03）
  useEffect(() => {
    if (!initializing && needsTermsAccept) {
      router.replace("/terms/accept?next=%2F");
    }
  }, [initializing, needsTermsAccept, router]);

  const loggedIn = !!user && user.emailVerified !== false && !!profile;

  const refresh = useCallback(async () => {
    try {
      setMaps(await getRepo().list());
    } catch (e) {
      console.error("マップ一覧の取得に失敗しました", e);
    }
    // ログイン済みのとき、ローカルに残っている匿名マップは移行候補
    setLocalCount(loggedIn ? storage.list().length : 0);
  }, [loggedIn]);

  useEffect(() => {
    if (initializing) return;
    // 匿名マップの保持期限（30日）を過ぎたものを削除してから一覧を出す
    const t = setTimeout(() => {
      purgeExpiredAnonMaps();
      void refresh();
    }, 0);
    return () => clearTimeout(t);
  }, [initializing, refresh]);

  const handleDelete = async (id: string) => {
    if (!confirm("このマップを削除しますか？")) return;
    await getRepo().remove(id);
    void refresh();
  };

  /** 匿名マップをアカウントへ取り込む（INFRA-01c） */
  const handleMigrate = async () => {
    if (!user || migrating) return;
    setMigrating(true);
    try {
      const repo = createFirestoreRepo(user.uid);
      for (const m of storage.list()) {
        await repo.save(m);
        storage.remove(m.id);
      }
      await refresh();
    } catch (e) {
      console.error("マップの移行に失敗しました", e);
      alert("移行に失敗しました。通信環境を確認して再度お試しください。");
    } finally {
      setMigrating(false);
    }
  };

  const handleDiscardLocal = () => {
    if (!confirm("この端末に残っているマップを削除します。よろしいですか？"))
      return;
    for (const m of storage.list()) storage.remove(m.id);
    setLocalCount(0);
  };

  const totalNodes = maps.reduce((sum, m) => sum + m.nodes.length, 0);
  // 思考のバランス（UP-03）: 自分の言葉 vs AI提案（root は数えない）
  const userNodes = maps.reduce(
    (sum, m) => sum + m.nodes.filter((n) => n.data.role === "user").length,
    0,
  );
  const aiNodes = maps.reduce(
    (sum, m) => sum + m.nodes.filter((n) => n.data.role === "ai").length,
    0,
  );

  return (
    <main className="min-h-screen bg-page px-5 py-12 sm:py-20">
      <div className="mx-auto max-w-xl">
        {/* ロゴ ＋ アカウント */}
        <div className="anim-float-up mb-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full border-[1.5px] border-accent bg-card">
              <span className="h-2 w-2 rounded-full bg-accent" />
            </span>
            <span className="font-display text-[20px] font-bold tracking-wide">
              思索
              <span className="font-medium text-muted"> / Mindmap</span>
            </span>
          </div>

          {initializing ? null : loggedIn ? (
            <div className="flex items-center gap-2.5">
              {profile.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.photoURL}
                  alt=""
                  className="h-8 w-8 rounded-full border border-line object-cover"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-tint-accent-strong font-display text-[13px] font-bold text-accent-soft">
                  {profile.displayName.charAt(0)}
                </span>
              )}
              <span className="hidden max-w-[120px] truncate text-xs text-muted sm:block">
                {profile.displayName}
              </span>
              <Link
                href="/settings"
                className="rounded-full border border-line bg-card px-3 py-1.5 text-[11px] text-muted transition-colors hover:text-ink"
              >
                設定
              </Link>
              <button
                onClick={() => void signOut()}
                className="rounded-full border border-line bg-card px-3 py-1.5 text-[11px] text-muted transition-colors hover:text-ink"
              >
                ログアウト
              </button>
            </div>
          ) : (
            <Link
              href={needsProfile ? "/setup" : "/login"}
              className="btn-lift rounded-full border border-line bg-card px-4 py-2 text-[12px] font-bold text-accent-soft"
            >
              {needsProfile ? "プロフィール登録" : "ログイン"}
            </Link>
          )}
        </div>

        <div className="anim-float-up" style={{ animationDelay: "0.06s" }}>
          <h1 className="mb-4 font-display text-[34px] font-bold leading-[1.25] tracking-tight sm:text-[40px]">
            人間の脳で、
            <br />
            考えよう。
          </h1>
          <p className="mb-9 max-w-[400px] text-sm leading-[2] text-muted">
            行き詰まったら AI と対話し、想像を膨らませる。
            主役はいつもあなたの思考です。
          </p>

          {/* CTA — プライマリ（ティファニーブルー） */}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/new"
              className="btn-lift btn-primary inline-flex items-center gap-3 py-4 pl-7 pr-8 text-[15px]"
            >
              <span className="relative inline-block h-[15px] w-[15px]">
                <span className="absolute left-0 top-[6.5px] h-[1.5px] w-[15px] rounded bg-on-accent" />
                <span className="absolute left-[6.5px] top-0 h-[15px] w-[1.5px] rounded bg-on-accent" />
              </span>
              新しいマップを作る
            </Link>
            {loggedIn && (
              <Link
                href="/community"
                className="btn-lift btn-secondary inline-flex items-center gap-2 px-6 py-4 text-[14px] font-bold !text-accent-soft"
              >
                コミュニティ
              </Link>
            )}
          </div>
        </div>

        {/* 匿名マップの移行案内（INFRA-01c） */}
        {loggedIn && localCount > 0 && (
          <div
            className="anim-float-up mt-10 rounded-[12px] border border-dashed border-ai-line bg-tint-accent p-5"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="mb-1.5 text-[14px] font-bold text-accent-soft">
              この端末に {localCount} 件のマップがあります
            </div>
            <p className="mb-4 text-xs leading-relaxed text-muted">
              アカウントに取り込むと、どの端末からでも開けるようになります。
              取り込まない場合、この端末だけに残り30日で削除されます。
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => void handleMigrate()}
                disabled={migrating}
                className="btn-lift btn-primary px-5 py-2.5 text-[13px] disabled:opacity-40"
              >
                {migrating ? "取り込み中…" : "アカウントに取り込む"}
              </button>
              <button
                onClick={handleDiscardLocal}
                disabled={migrating}
                className="btn-lift btn-secondary px-4 py-2.5 text-[13px] !text-muted disabled:opacity-40"
              >
                削除する
              </button>
            </div>
          </div>
        )}

        {/* 未ログインの保存期限の注意 */}
        {!initializing && !user && maps.length > 0 && (
          <p
            className="anim-float-up mt-10 text-[11px] leading-relaxed text-muted"
            style={{ animationDelay: "0.1s" }}
          >
            マップはこの端末のみに保存されています（最終更新から30日で削除）。
            <Link
              href="/login"
              className="text-accent-soft underline underline-offset-4"
            >
              ログイン
            </Link>
            するとクラウドに保存されます。
          </p>
        )}

        {/* 思考のバランスリング（UP-03） */}
        {userNodes + aiNodes > 0 && (
          <div
            className="anim-float-up mt-14"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="mb-4 px-1">
              <span className="micro-label">思考のバランス</span>
            </div>
            <ThinkRing userNodes={userNodes} aiNodes={aiNodes} />
          </div>
        )}

        {/* これまでのマップ */}
        <div
          className="anim-float-up mt-14"
          style={{ animationDelay: "0.12s" }}
        >
          <div className="mb-4 flex items-baseline justify-between px-1">
            <span className="micro-label">これまでのマップ</span>
            {maps.length > 0 && (
              <span className="font-display text-xs tracking-wide text-muted">
                {maps.length} maps · {totalNodes} nodes
              </span>
            )}
          </div>

          {maps.length === 0 ? (
            <div className="card-soft px-6 py-10 text-center">
              <div className="mb-1.5 font-display text-[15px] font-bold text-ink">
                まだマップがありません
              </div>
              <p className="text-xs leading-relaxed text-muted">
                最初のテーマを決めて、考えはじめよう
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {maps.map((m, i) => (
                <li
                  key={m.id}
                  className="anim-float-up"
                  style={{ animationDelay: `${0.15 + i * 0.05}s` }}
                >
                  <Link
                    href={`/map/${m.id}`}
                    className="card-soft btn-lift group flex items-center gap-4 px-5 py-4 hover:border-accent/50"
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-[15px] font-bold ${
                        i === 0
                          ? "bg-accent text-on-accent"
                          : "bg-tint-accent-strong text-accent-soft"
                      }`}
                    >
                      {m.theme.charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 truncate text-[15px] font-bold">
                          {m.theme}
                        </span>
                        {/* 共有されたマップ（NF-01a）の目印 */}
                        {user && m.ownerId && m.ownerId !== user.uid && (
                          <span className="shrink-0 rounded-full bg-tint-accent-strong px-2 py-0.5 text-[9px] font-bold tracking-wider text-accent-soft">
                            共同編集
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block font-display text-xs tracking-wide text-muted">
                        {m.nodes.length}{" "}
                        {m.nodes.length === 1 ? "node" : "nodes"} ·{" "}
                        {relativeTime(m.updatedAt)}
                      </span>
                    </span>
                    {/* 削除できるのは自分のマップだけ（共有マップは所有者のみ） */}
                    {(!m.ownerId || m.ownerId === user?.uid) && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          void handleDelete(m.id);
                        }}
                        className="rounded-full px-3 py-1.5 text-xs tracking-wider text-muted opacity-0 transition-all hover:bg-tint-danger hover:text-danger group-hover:opacity-100"
                      >
                        削除
                      </button>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* フッター: 法務ページへの導線（REL-03/04） */}
        <footer className="mt-16 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-[11px] text-placeholder">
          <Link href="/terms" className="hover:text-muted">
            利用規約
          </Link>
          <span className="opacity-40">·</span>
          <Link href="/privacy" className="hover:text-muted">
            プライバシー
          </Link>
          <span className="opacity-40">·</span>
          <Link href="/contact" className="hover:text-muted">
            お問い合わせ
          </Link>
        </footer>
      </div>
    </main>
  );
}
