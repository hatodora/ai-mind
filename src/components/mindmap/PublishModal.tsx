"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMindMapStore } from "@/store/mindmap-store";
import {
  collectSubtree,
  communityAuthorName,
  publishPost,
} from "@/lib/community";

/**
 * コミュニティへの公開モーダル（NF-01b）。
 * 「選択ノード＋その子孫」を公開時点のスナップショットとして投稿する。
 */
export function PublishModal({
  rootNodeId,
  onClose,
}: {
  rootNodeId: string;
  onClose: () => void;
}) {
  const map = useMindMapStore((s) => s.map);
  const { profile } = useAuth();
  const [publishing, setPublishing] = useState(false);
  const [postId, setPostId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!map || !profile) return null;
  const root = map.nodes.find((n) => n.id === rootNodeId);
  const subtree = collectSubtree(map, rootNodeId);
  if (!root || !subtree) return null;
  const authorName = communityAuthorName(profile);

  const handlePublish = async () => {
    setPublishing(true);
    setError(null);
    try {
      setPostId(await publishPost(map, rootNodeId, profile));
    } catch (e) {
      console.error("投稿に失敗しました", e);
      setError("投稿できませんでした。通信環境を確認してください");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5"
      onClick={onClose}
    >
      <div
        className="anim-float-up w-full max-w-sm rounded-[16px] border border-line bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {postId ? (
          <>
            <div className="mb-1 font-display text-lg font-bold">
              公開しました 🎉
            </div>
            <p className="mb-5 text-xs leading-relaxed text-muted">
              あなたの思索がコミュニティのタイムラインに並びました
            </p>
            <div className="flex gap-2">
              <Link
                href={`/community/${postId}`}
                className="btn-lift btn-primary flex-1 py-3 text-center text-[13px]"
              >
                投稿を見る
              </Link>
              <button
                onClick={onClose}
                className="btn-lift btn-secondary flex-1 py-3 text-[13px] !text-muted"
              >
                閉じる
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-1 font-display text-lg font-bold">
              コミュニティに公開
            </div>
            <p className="mb-4 text-xs leading-relaxed text-muted">
              選択中のノードとその下につながるノードを、いまの状態のまま
              公開します（あとでマップを編集しても投稿は変わりません）。
            </p>

            <div className="mb-4 rounded-[12px] border border-line bg-page px-4 py-3.5">
              <div className="micro-label mb-1">公開する内容</div>
              <div className="text-[14px] font-bold">{root.data.label}</div>
              <div className="mt-1 font-display text-xs tracking-wide text-muted">
                {subtree.nodes.length} nodes · テーマ「{map.theme}」
              </div>
            </div>

            <p className="mb-5 text-[11px] leading-relaxed text-muted">
              投稿者名:{" "}
              <span className="font-bold text-ink">
                {authorName ?? "匿名"}
              </span>
              （設定画面の「コミュニティで名前を表示」で変更できます）
            </p>

            {error && (
              <div className="mb-4 rounded-[10px] bg-tint-danger px-3.5 py-2.5 text-xs text-danger">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => void handlePublish()}
                disabled={publishing}
                className="btn-lift btn-primary flex-1 py-3 text-[13px] disabled:opacity-40"
              >
                {publishing ? "公開中…" : "公開する"}
              </button>
              <button
                onClick={onClose}
                disabled={publishing}
                className="btn-lift btn-secondary flex-1 py-3 text-[13px] !text-muted disabled:opacity-40"
              >
                やめる
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
