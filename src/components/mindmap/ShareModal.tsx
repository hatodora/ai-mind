"use client";

import { useState } from "react";
import { useMindMapStore } from "@/store/mindmap-store";
import { createMapInvite, inviteUrl } from "@/lib/share";

/**
 * 共同編集の共有モーダル（NF-01a）。所有者のみ開ける。
 * 招待リンクの発行・コピーと、参加者の一覧・削除を行う。
 */
export function ShareModal({ onClose }: { onClose: () => void }) {
  const map = useMindMapStore((s) => s.map);
  const removeCollaborator = useMindMapStore((s) => s.removeCollaborator);
  const [link, setLink] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!map) return null;
  const collaborators = Object.keys(map.sharedWith ?? {});

  const handleCreateLink = async () => {
    setCreating(true);
    setError(null);
    try {
      const token = await createMapInvite(map.id);
      setLink(inviteUrl(token));
    } catch (e) {
      console.error("招待リンクの発行に失敗しました", e);
      setError("招待リンクを発行できませんでした。通信環境を確認してください");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボードが使えない環境では選択コピーしてもらう
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
        <div className="mb-1 font-display text-lg font-bold">共同編集</div>
        <p className="mb-5 text-xs leading-relaxed text-muted">
          招待リンクを送ると、相手はログイン後にこのマップを一緒に
          編集できるようになります（リンクは7日で失効します）。
        </p>

        {link ? (
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-2">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-[10px] border border-line bg-page px-3 py-2.5 text-[11px] text-ink outline-none"
              />
              <button
                onClick={() => void handleCopy()}
                className="btn-lift btn-primary shrink-0 px-4 py-2.5 text-[12px]"
              >
                {copied ? "コピー済み ✓" : "コピー"}
              </button>
            </div>
            <p className="text-[10px] text-muted">
              このリンクを知っている人は誰でも参加できます。扱いには注意してください
            </p>
          </div>
        ) : (
          <button
            onClick={() => void handleCreateLink()}
            disabled={creating}
            className="btn-lift btn-primary mb-5 w-full py-3 text-[13px] disabled:opacity-40"
          >
            {creating ? "発行中…" : "招待リンクを発行する"}
          </button>
        )}

        {error && (
          <div className="mb-4 rounded-[10px] bg-tint-danger px-3.5 py-2.5 text-xs text-danger">
            {error}
          </div>
        )}

        {collaborators.length > 0 && (
          <div className="mb-5">
            <div className="micro-label mb-2.5">参加中のメンバー</div>
            <ul className="space-y-2">
              {collaborators.map((uid) => (
                <li
                  key={uid}
                  className="flex items-center justify-between gap-3 rounded-[10px] border border-line bg-page px-3.5 py-2.5"
                >
                  <span className="min-w-0 truncate text-[13px] text-ink">
                    {map.collaboratorNames?.[uid] || "参加者"}
                  </span>
                  <button
                    onClick={() => {
                      if (confirm("このメンバーを共同編集から外しますか？")) {
                        removeCollaborator(uid);
                      }
                    }}
                    className="shrink-0 rounded-full px-2.5 py-1 text-[11px] text-muted transition-colors hover:bg-tint-danger hover:text-danger"
                  >
                    外す
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={onClose}
          className="btn-lift btn-secondary w-full py-2.5 text-[13px] !text-muted"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
