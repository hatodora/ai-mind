"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  MAX_COMMENT_LEN,
  addBookmark,
  addComment,
  canPostToCommunity,
  deleteComment,
  deletePost,
  displayAuthor,
  fetchPost,
  isBookmarked,
  removeBookmark,
  watchComments,
} from "@/lib/community";
import { relativeTime } from "@/lib/format";
import { PostMapView } from "@/components/community/PostMapView";
import type { CommunityComment, CommunityPost } from "@/types";

/**
 * 投稿詳細（NF-01b）: 公開された部分ツリーのミニマップ＋コメント欄。
 * 負荷方針: onSnapshot はこの画面を開いている間のコメント欄だけ。
 */
export default function PostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = use(params);
  const router = useRouter();
  const { user, profile, initializing } = useAuth();
  const [post, setPost] = useState<CommunityPost | null | undefined>(undefined);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loggedIn = !!user && user.emailVerified && !!profile;
  const canComment = canPostToCommunity(profile);

  // 投稿本体は1回だけ読む（スナップショットなので変わらない）
  useEffect(() => {
    if (initializing || !loggedIn) return;
    fetchPost(postId)
      .then(setPost)
      .catch((e) => {
        console.error("投稿の取得に失敗しました", e);
        setPost(null);
      });
  }, [initializing, loggedIn, postId]);

  // コメント欄のみリアルタイム購読（画面を開いている間だけ）
  useEffect(() => {
    if (initializing || !loggedIn || !post) return;
    return watchComments(postId, setComments);
  }, [initializing, loggedIn, post, postId]);

  // ブックマーク状態
  useEffect(() => {
    if (!loggedIn || !user) return;
    isBookmarked(user.uid, postId)
      .then(setBookmarked)
      .catch(() => {});
  }, [loggedIn, user, postId]);

  const handleToggleBookmark = async () => {
    if (!user || !post) return;
    const next = !bookmarked;
    setBookmarked(next); // 楽観更新
    try {
      if (next) await addBookmark(user.uid, post);
      else await removeBookmark(user.uid, postId);
    } catch (e) {
      console.error("ブックマークの更新に失敗しました", e);
      setBookmarked(!next);
    }
  };

  const handleAddComment = async () => {
    if (!profile || !input.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await addComment(postId, input, profile);
      setInput("");
    } catch (e) {
      console.error("コメントの投稿に失敗しました", e);
      setError("コメントを投稿できませんでした");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("このコメントを削除しますか？")) return;
    try {
      await deleteComment(postId, commentId);
    } catch (e) {
      console.error("コメントの削除に失敗しました", e);
      setError("コメントを削除できませんでした");
    }
  };

  const handleDeletePost = async () => {
    if (!confirm("この投稿を削除しますか？（元に戻せません）")) return;
    try {
      await deletePost(postId);
      router.replace("/community");
    } catch (e) {
      console.error("投稿の削除に失敗しました", e);
      setError("投稿を削除できませんでした");
    }
  };

  if (initializing || (loggedIn && post === undefined)) {
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
          <p className="mb-5 text-sm leading-relaxed text-muted">
            投稿を見るにはログインが必要です
          </p>
          <Link href="/login" className="btn-lift btn-primary px-6 py-3 text-[13px]">
            ログインする
          </Link>
        </div>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page px-5">
        <div className="text-center">
          <div className="mb-4 text-sm text-muted">
            この投稿は削除されたか、見つかりません
          </div>
          <Link
            href="/community"
            className="text-sm text-accent-soft underline underline-offset-4"
          >
            コミュニティへ戻る
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-page px-5 py-10">
      <div className="mx-auto max-w-xl">
        {/* ヘッダー */}
        <div className="anim-float-up mb-6 flex items-center justify-between gap-3">
          <Link
            href="/community"
            className="flex items-center gap-2 rounded-full py-1.5 pl-2 pr-4 text-xs tracking-wide text-muted transition-colors hover:bg-card hover:text-ink"
          >
            <span className="font-display">←</span> コミュニティ
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleToggleBookmark()}
              className={`rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition-colors ${
                bookmarked
                  ? "border-accent/50 bg-tint-accent-strong text-accent-soft"
                  : "border-line bg-card text-muted hover:text-ink"
              }`}
              title={bookmarked ? "ブックマークを外す" : "ブックマークする"}
            >
              {bookmarked ? "🔖 保存済み" : "🔖 保存"}
            </button>
            {user?.uid === post.authorUid && (
              <button
                onClick={() => void handleDeletePost()}
                className="rounded-full px-3 py-1.5 text-xs text-muted transition-colors hover:bg-tint-danger hover:text-danger"
              >
                削除
              </button>
            )}
          </div>
        </div>

        {/* 投稿ヘッダー */}
        <div className="anim-float-up mb-4">
          <div className="mb-1 flex items-center gap-2 text-[12px] text-muted">
            <span className="font-bold text-accent-soft">
              {displayAuthor(post.authorName)}
            </span>
            <span>·</span>
            <span>{relativeTime(post.createdAt)}</span>
          </div>
          <h1 className="font-display text-[22px] font-bold leading-snug">
            {post.title || post.rootLabel}
          </h1>
          <div className="mt-1 font-display text-xs tracking-wide text-muted">
            テーマ「{post.theme}」 · 起点ノード「{post.rootLabel}」 ·{" "}
            {post.nodes.length} nodes
          </div>
          {post.body && (
            <p className="mt-4 whitespace-pre-wrap text-[14px] leading-[1.9] text-ink">
              {post.body}
            </p>
          )}
        </div>

        {/* ミニマップ（読み取り専用スナップショット） */}
        <div className="anim-float-up mb-8 h-72 sm:h-80">
          <PostMapView nodes={post.nodes} edges={post.edges} />
        </div>

        {/* コメント */}
        <div className="anim-float-up">
          <div className="mb-3 px-1">
            <span className="micro-label">
              コメント（{comments.length}）
            </span>
          </div>

          {canComment ? (
            <div className="card-soft mb-5 p-4">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={MAX_COMMENT_LEN}
                placeholder="思ったことをそっと残す…"
                rows={2}
                className="w-full resize-none rounded-[12px] border border-line bg-page px-4 py-3 text-[14px] text-ink outline-none ring-accent/40 transition-shadow placeholder:text-placeholder focus:border-accent/60 focus:ring-2"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[10px] text-muted">
                  {profile?.showNameInCommunity
                    ? `「${profile.displayName}」として表示`
                    : "匿名で投稿されます（設定で変更可）"}
                </span>
                <button
                  onClick={() => void handleAddComment()}
                  disabled={!input.trim() || sending}
                  className="btn-lift btn-primary px-5 py-2.5 text-[12px] disabled:opacity-40"
                >
                  {sending ? "送信中…" : "コメントする"}
                </button>
              </div>
            </div>
          ) : (
            <p className="mb-5 rounded-[12px] border border-dashed border-line px-4 py-3 text-[11px] leading-relaxed text-muted">
              コメントの投稿は15歳から利用できます（閲覧とブックマークはどなたでも）
            </p>
          )}

          {error && (
            <div className="mb-4 rounded-[12px] bg-tint-danger px-4 py-3 text-[13px] text-danger">
              {error}
            </div>
          )}

          {comments.length === 0 ? (
            <p className="px-1 text-xs text-muted">
              まだコメントはありません
            </p>
          ) : (
            <ul className="space-y-2.5">
              {comments.map((c) => (
                <li key={c.id} className="card-soft group px-4 py-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[11px] text-muted">
                      <span className="font-bold text-accent-soft">
                        {displayAuthor(c.authorName)}
                      </span>
                      <span>·</span>
                      <span>{relativeTime(c.createdAt)}</span>
                    </span>
                    {user?.uid === c.authorUid && (
                      <button
                        onClick={() => void handleDeleteComment(c.id)}
                        className="rounded-full px-2 py-0.5 text-[10px] text-muted opacity-0 transition-all hover:bg-tint-danger hover:text-danger group-hover:opacity-100"
                      >
                        削除
                      </button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
                    {c.text}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
