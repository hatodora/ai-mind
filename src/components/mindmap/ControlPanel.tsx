"use client";

import { useState } from "react";
import { useMindMapStore } from "@/store/mindmap-store";

export function ControlPanel() {
  const map = useMindMapStore((s) => s.map);
  const selectedNodeId = useMindMapStore((s) => s.selectedNodeId);
  const addNode = useMindMapStore((s) => s.addNode);
  const addNodes = useMindMapStore((s) => s.addNodes);
  const removeNode = useMindMapStore((s) => s.removeNode);
  const setTurn = useMindMapStore((s) => s.setTurn);

  const [input, setInput] = useState("");
  const [aiSuggestions, setAISuggestions] = useState<string[]>([]);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [review, setReview] = useState<string | null>(null);
  const [loading, setLoading] = useState<null | "ai" | "explain" | "review">(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  if (!map) return null;

  const selected = map.nodes.find((n) => n.id === selectedNodeId);
  const isUserTurn = map.currentTurn === "user";

  const handleAddUserNode = () => {
    if (!selected || !input.trim()) return;
    addNode(selected.id, input.trim(), "user");
    setInput("");
  };

  const handleRequestAI = async () => {
    if (!selected) return;
    setLoading("ai");
    setError(null);
    setAISuggestions([]);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: map.theme,
          selectedNodeLabel: selected.data.label,
          contextNodes: map.nodes.map((n) => ({
            id: n.id,
            label: n.data.label,
            role: n.data.role,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "AI request failed");
      setAISuggestions(json.suggestions || []);
      setTurn("ai");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(null);
    }
  };

  const handleAcceptSuggestion = (label: string) => {
    if (!selected) return;
    addNode(selected.id, label, "ai");
    setAISuggestions((prev) => prev.filter((s) => s !== label));
  };

  const handleAcceptAll = () => {
    if (!selected || aiSuggestions.length === 0) return;
    addNodes(selected.id, aiSuggestions, "ai");
    setAISuggestions([]);
    setTurn("user");
  };

  const handleSkipAI = () => {
    setAISuggestions([]);
    setTurn("user");
  };

  const handleExplain = async () => {
    if (!selected) return;
    setLoading("explain");
    setExplanation(null);
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: selected.data.label, theme: map.theme }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "AI request failed");
      setExplanation(json.explanation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(null);
    }
  };

  const handleReview = async () => {
    setLoading("review");
    setReview(null);
    try {
      const res = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: map.theme,
          nodes: map.nodes.map((n) => ({
            label: n.data.label,
            role: n.data.role,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "AI request failed");
      setReview(json.review);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500">テーマ</div>
          <div className="font-bold text-slate-800">{map.theme}</div>
        </div>
        <div
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            isUserTurn
              ? "bg-sky-100 text-sky-700"
              : "bg-purple-100 text-purple-700"
          }`}
        >
          {isUserTurn ? "あなたの番" : "AIの番"}
        </div>
      </div>

      {selected && (
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="mb-1 text-xs text-slate-500">選択中のノード</div>
          <div className="font-medium text-slate-800">
            {selected.data.label}
          </div>
        </div>
      )}

      {!selected && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          ノードをタップして選んでください
        </div>
      )}

      {selected && isUserTurn && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600">
            自分の考えを書いて追加
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddUserNode()}
              placeholder="思いついた言葉..."
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
            />
            <button
              onClick={handleAddUserNode}
              disabled={!input.trim()}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-600 disabled:opacity-40"
            >
              追加
            </button>
          </div>
          <button
            onClick={handleRequestAI}
            disabled={loading === "ai"}
            className="w-full rounded-lg bg-purple-500 px-4 py-2 text-sm font-bold text-white hover:bg-purple-600 disabled:opacity-40"
          >
            {loading === "ai" ? "考え中..." : "🤖 AIにアイデアを聞く"}
          </button>
        </div>
      )}

      {aiSuggestions.length > 0 && (
        <div className="space-y-2 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50 p-3">
          <div className="text-xs font-bold text-purple-700">
            AIの提案 — 採用するものをタップ
          </div>
          {aiSuggestions.map((s) => (
            <button
              key={s}
              onClick={() => handleAcceptSuggestion(s)}
              className="block w-full rounded-lg border border-purple-300 bg-white px-3 py-2 text-left text-sm text-purple-900 hover:bg-purple-100"
            >
              + {s}
            </button>
          ))}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAcceptAll}
              className="flex-1 rounded-lg bg-purple-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-600"
            >
              全部採用
            </button>
            <button
              onClick={handleSkipAI}
              className="flex-1 rounded-lg bg-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-400"
            >
              スキップ
            </button>
          </div>
        </div>
      )}

      {selected && (
        <div className="space-y-2 border-t border-slate-200 pt-3">
          <button
            onClick={handleExplain}
            disabled={loading === "explain"}
            className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-40"
          >
            {loading === "explain"
              ? "考え中..."
              : "❓ このノードがわからない"}
          </button>
          {explanation && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {explanation}
            </div>
          )}
          {selected.data.role !== "root" && (
            <button
              onClick={() => removeNode(selected.id)}
              className="w-full rounded-lg border border-rose-200 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50"
            >
              このノードを削除
            </button>
          )}
        </div>
      )}

      <div className="space-y-2 border-t border-slate-200 pt-3">
        <button
          onClick={handleReview}
          disabled={loading === "review" || map.nodes.length < 3}
          className="w-full rounded-lg bg-gradient-to-r from-orange-400 to-pink-500 px-3 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40"
        >
          {loading === "review"
            ? "レビュー中..."
            : "✨ AIに全体をレビューしてもらう"}
        </button>
        {review && (
          <div className="whitespace-pre-wrap rounded-lg bg-gradient-to-br from-orange-50 to-pink-50 p-3 text-sm text-slate-800">
            {review}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}
    </div>
  );
}
