"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import {
  displayAuthor,
  fetchBookmarks,
  fetchPosts,
} from "@/lib/community";
import { relativeTime } from "@/lib/format";
import type { Bookmark, CommunityPost } from "@/types";

type Tab = "feed" | "bookmarks";

/**
 * コミュニティ（NF-01b）: X のタイムライン風フィード。
 * 負荷方針: フィードは onSnapshot を張らず、ページネーション付き通常クエリのみ。
 */
export default function CommunityPage() {
  const { user, profile, initializing, needsProfile } = useAuth();
  const [tab, setTab] = useState<Tab>("feed");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loggedIn = !!user && user.emailVerified && !!profile;

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchPosts();
      setPosts(page.posts);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (e) {
      console.error("フィードの取得に失敗しました", e);
      setError("投稿を読み込めませんでした");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const page = await fetchPosts(cursor);
      setPosts((prev) => [...prev, ...page.posts]);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (e) {
      console.error("フィードの取得に失敗しました", e);
      setError("続きを読み込めませんでした");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loggedIn) return;
    // setState を effect 内で直接呼ばない（次のティックで読み込み開始）
    const t = setTimeout(() => void loadFirstPage(), 0);
    return () => clearTimeout(t);
  }, [loggedIn, loadFirstPage]);

  // ブックマークはタブを開いた時に1回だけ読む（非正規化データで1クエリ）
  useEffect(() => {
    if (!loggedIn || tab !== "bookmarks" || bookmarks !== null) return;
    fetchBookmarks(user.uid)
      .then(setBookmarks)
      .catch((e) => {
        console.error("ブックマークの取得に失敗しました", e);
        setError("ブックマークを読み込めませんでした");
      });
  }, [loggedIn, tab, bookmarks, user]);

  if (initializing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page">
        <div className="text-sm text-muted">読み込み中…</div>
      </main>
    );
  }

  if (!loggedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page px-5">
        <div className="anim-float-up w-full max-w-sm rounded-[16px] border border-line bg-card p-8 text-center">
          <div className="mb-2 font-display text-lg font-bold">
            コミュニティ
          </div>
          <p className="mb-5 text-sm leading-relaxed text-muted">
            みんなの思索をのぞくにはログインが必要です
          </p>
          <Link
            href={needsProfile ? "/setup" : "/login"}
            className="btn-lift btn-primary px-6 py-3 text-[13px]"
          >
            {needsProfile ? "プロフィールを登録する" : "ログインする"}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-page px-5 py-10">
      <div className="mx-auto max-w-xl">
        {/* ヘッダー */}
        <div className="anim-float-up mb-8 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-full py-1.5 pl-2 pr-4 text-xs tracking-wide text-muted transition-colors hover:bg-card hover:text-ink"
          >
            <span className="font-display">←</span> ホーム
          </Link>
          <h1 className="font-display text-[20px] font-bold tracking-wide">
            コミュニティ
          </h1>
          <span className="w-[72px]" />
        </div>

        {/* タブ */}
        <div className="anim-float-up mb-6 grid grid-cols-2 gap-1.5">
          {(
            [
              ["feed", "みんなの投稿"],
              ["bookmarks", "ブックマーク"],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-[12px] py-3 text-[13px] font-bold transition-all ${
                tab === t
                  ? "bg-accent text-on-accent"
                  : "border border-line bg-card text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-[12px] bg-tint-danger px-4 py-3 text-[13px] text-danger">
            {error}
          </div>
        )}

        {tab === "feed" ? (
          <>
            {posts.length === 0 && !loading ? (
              <div className="card-soft px-6 py-10 text-center">
                <div className="mb-1.5 font-display text-[15px] font-bold">
                  まだ投稿がありません
                </div>
                <p className="text-xs leading-relaxed text-muted">
                  マップのノードを選んで「このノードを公開」から投稿できます
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {posts.map((p, i) => (
                  <li
                    key={p.id}
                    className="anim-float-up"
                    style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}
                  >
                    <Link
                      href={`/community/${p.id}`}
                      className="card-soft btn-lift block px-5 py-4 hover:border-accent/50"
                    >
                      <div className="mb-1 flex items-center gap-2 text-[11px] text-muted">
                        <span className="font-bold text-accent-soft">
                          {displayAuthor(p.authorName)}
                        </span>
                        <span>·</span>
                        <span>{relativeTime(p.createdAt)}</span>
                      </div>
                      <div className="text-[15px] font-bold leading-snug">
                        {p.title || p.rootLabel}
                      </div>
                      {p.body && (
                        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">
                          {p.body}
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center gap-3 font-display text-xs tracking-wide text-muted">
                        <span className="min-w-0 truncate">
                          テーマ「{p.theme}」
                        </span>
                        <span className="shrink-0">
                          {p.nodes.length} nodes
                        </span>
                        <span className="shrink-0">
                          💬 {p.commentCount}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {loading && (
              <p className="mt-5 text-center text-xs text-muted">
                読み込み中…
              </p>
            )}
            {hasMore && !loading && (
              <button
                onClick={() => void loadMore()}
                className="btn-lift btn-secondary mt-5 w-full py-3 text-[13px] !text-muted"
              >
                もっと見る
              </button>
            )}
          </>
        ) : (
          <>
            {bookmarks === null ? (
              <p className="text-center text-xs text-muted">読み込み中…</p>
            ) : bookmarks.length === 0 ? (
              <div className="card-soft px-6 py-10 text-center">
                <div className="mb-1.5 font-display text-[15px] font-bold">
                  ブックマークはまだありません
                </div>
                <p className="text-xs leading-relaxed text-muted">
                  気になる投稿を開いて 🔖 を押すと、ここに並びます
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {bookmarks.map((b) => (
                  <li key={b.postId} className="anim-float-up">
                    <Link
                      href={`/community/${b.postId}`}
                      className="card-soft btn-lift block px-5 py-4 hover:border-accent/50"
                    >
                      <div className="mb-1 flex items-center gap-2 text-[11px] text-muted">
                        <span className="font-bold text-accent-soft">
                          {displayAuthor(b.authorName)}
                        </span>
                        <span>·</span>
                        <span>{relativeTime(b.postCreatedAt)}</span>
                      </div>
                      <div className="text-[15px] font-bold leading-snug">
                        {b.title || b.rootLabel}
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 font-display text-xs tracking-wide text-muted">
                        <span className="min-w-0 truncate">
                          テーマ「{b.theme}」
                        </span>
                        <span className="shrink-0">{b.nodeCount} nodes</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}
