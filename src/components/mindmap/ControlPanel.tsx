"use client";

import { useEffect, useRef, useState } from "react";
import { aiExplain, aiReview, aiSuggest } from "@/lib/ai-client";
import { useMindMapStore } from "@/store/mindmap-store";

/** 行き詰まり検知（NF-04）: この秒数無操作なら AI サポート導線を出す */
const STALL_SECONDS = 45;

function TypingDots({ dark }: { dark?: boolean }) {
  const color = dark ? "bg-on-accent" : "bg-accent-soft";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`typing-dot ${color}`} style={{ animationDelay: "0s" }} />
      <span
        className={`typing-dot ${color}`}
        style={{ animationDelay: "0.15s" }}
      />
      <span
        className={`typing-dot ${color}`}
        style={{ animationDelay: "0.3s" }}
      />
    </span>
  );
}

/** AIトークンゲージ（UP-02）の表示 */
function GaugeMeter({ value }: { value: number }) {
  const dots = Math.min(Math.max(value, 0), 5);
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="micro-label">AIゲージ</span>
        <span className="flex items-center gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full transition-colors ${
                i < dots ? "bg-accent" : "bg-card-raised"
              }`}
            />
          ))}
          {value > 5 && (
            <span className="font-display text-xs font-bold text-accent-soft">
              +{value - 5}
            </span>
          )}
        </span>
      </div>
      {value < 1 && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          あと{1 - value}回 自分で考えると、AIに相談できます
        </p>
      )}
    </div>
  );
}

export function ControlPanel() {
  const map = useMindMapStore((s) => s.map);
  const selectedNodeId = useMindMapStore((s) => s.selectedNodeId);
  const addNode = useMindMapStore((s) => s.addNode);
  const addNodes = useMindMapStore((s) => s.addNodes);
  const removeNode = useMindMapStore((s) => s.removeNode);
  const setTurn = useMindMapStore((s) => s.setTurn);
  const spendGauge = useMindMapStore((s) => s.spendGauge);
  const arrange = useMindMapStore((s) => s.arrange);

  const [input, setInput] = useState("");
  const [aiSuggestions, setAISuggestions] = useState<string[]>([]);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [review, setReview] = useState<string | null>(null);
  const [loading, setLoading] = useState<null | "ai" | "explain" | "review">(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [adoptedFlash, setAdoptedFlash] = useState(false);
  const [stalled, setStalled] = useState(false);
  const lastActivityRef = useRef<number | null>(null);

  // イベントハンドラ専用。null = 「直前に操作があった」の印で、
  // 次のインターバル刻みで計測起点が再設定される
  const touch = () => {
    lastActivityRef.current = null;
    setStalled(false);
  };

  const selected = map?.nodes.find((n) => n.id === selectedNodeId) ?? null;
  const isUserTurn = map?.currentTurn === "user";
  const gauge = map?.aiGauge ?? 0;
  const canAskAI = gauge >= 1 && !!selected && loading !== "ai";

  // 行き詰まり検知（NF-04）。計測開始はこの effect 内で行う
  useEffect(() => {
    if (!isUserTurn || aiSuggestions.length > 0) return;
    lastActivityRef.current = Date.now();
    const timer = setInterval(() => {
      const last = lastActivityRef.current;
      if (last === null) {
        lastActivityRef.current = Date.now();
        return;
      }
      if (Date.now() - last > STALL_SECONDS * 1000) {
        setStalled(true);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [isUserTurn, aiSuggestions.length]);

  if (!map) return null;

  const flashAdopted = () => {
    setAdoptedFlash(true);
    setTimeout(() => setAdoptedFlash(false), 1200);
  };

  const handleAddUserNode = () => {
    if (!selected || !input.trim()) return;
    addNode(selected.id, input.trim(), "user");
    setInput("");
    touch();
  };

  const handleRequestAI = async () => {
    if (!selected || !canAskAI) return;
    setLoading("ai");
    setError(null);
    setAISuggestions([]);
    touch();
    try {
      const json = await aiSuggest({
        theme: map.theme,
        selectedNodeLabel: selected.data.label,
        contextNodes: map.nodes.map((n) => ({
          id: n.id,
          label: n.data.label,
          role: n.data.role,
        })),
      });
      spendGauge(1);
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
    flashAdopted();
    const rest = aiSuggestions.filter((s) => s !== label);
    setAISuggestions(rest);
    if (rest.length === 0) setTurn("user");
    touch();
  };

  const handleAcceptAll = () => {
    if (!selected || aiSuggestions.length === 0) return;
    addNodes(selected.id, aiSuggestions, "ai");
    // 一括採用は「自分で考える」をスキップした分、ゲージで返済する（UP-02）
    spendGauge(aiSuggestions.length - 1);
    flashAdopted();
    setAISuggestions([]);
    setTurn("user");
    touch();
  };

  const handleSkipAI = () => {
    setAISuggestions([]);
    setTurn("user");
    touch();
  };

  const handleExplain = async () => {
    if (!selected) return;
    setLoading("explain");
    setExplanation(null);
    touch();
    try {
      const json = await aiExplain({
        label: selected.data.label,
        theme: map.theme,
      });
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
    touch();
    try {
      const json = await aiReview({
        theme: map.theme,
        nodes: map.nodes.map((n) => ({
          label: n.data.label,
          role: n.data.role,
        })),
      });
      setReview(json.review);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      {/* テーマ ＋ ターンバッジ */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="micro-label mb-1">テーマ</div>
          <div className="font-display text-lg font-bold leading-[1.35]">
            {map.theme}
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-card px-3.5 py-2 text-[11px] font-bold tracking-wide ${
            isUserTurn ? "text-warm" : "text-accent-soft"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isUserTurn ? "bg-warm" : "bg-accent"
            }`}
          />
          {isUserTurn ? "あなたの番" : "AIの番"}
        </span>
      </div>

      {/* AIトークンゲージ（UP-02） */}
      <div className="card-soft px-4 py-3.5">
        <GaugeMeter value={gauge} />
      </div>

      {/* 選択中のノード */}
      {selected ? (
        <div className="card-soft px-4 py-3.5">
          <div className="micro-label mb-1">選択中のノード</div>
          <div className="text-[15px] font-bold">{selected.data.label}</div>
        </div>
      ) : (
        <div className="rounded-[12px] border border-dashed border-ai-line bg-tint-accent px-4 py-3.5 text-sm text-muted">
          ノードをタップして選んでください
        </div>
      )}

      {/* 採用フラッシュ */}
      {adoptedFlash && (
        <div className="anim-float-up inline-flex items-center gap-2 self-start rounded-full bg-tint-accent-strong px-4 py-2 text-[13px] font-bold text-accent-soft">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent font-display text-[10px] text-on-accent">
            ✓
          </span>
          採用しました
        </div>
      )}

      {/* ユーザーターン: 入力 */}
      {selected && isUserTurn && (
        <div className="card-soft p-4">
          <div className="micro-label mb-2.5">自分の考えを書いて追加</div>
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              touch();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleAddUserNode();
              }
            }}
            placeholder="思いついた言葉…"
            rows={2}
            className="w-full resize-none rounded-[12px] border border-line bg-page px-4 py-3 text-[14px] text-ink outline-none ring-accent/40 transition-shadow placeholder:text-placeholder focus:border-accent/60 focus:ring-2"
          />
          <button
            onClick={handleAddUserNode}
            disabled={!input.trim()}
            className="btn-lift btn-primary mt-2.5 w-full py-3 text-[13px] disabled:opacity-40"
          >
            追加する
          </button>
          <button
            onClick={handleRequestAI}
            disabled={!canAskAI}
            className="btn-lift btn-secondary mt-2 w-full py-3 text-[13px] font-bold !text-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
            title={
              gauge < 1
                ? "まず自分でノードを追加するとAIに相談できます"
                : undefined
            }
          >
            {loading === "ai" ? (
              <span className="inline-flex items-center gap-2.5">
                <TypingDots /> 考え中…
              </span>
            ) : (
              "AI にアイデアを聞く"
            )}
          </button>
        </div>
      )}

      {/* 行き詰まり検知（NF-04） */}
      {stalled && isUserTurn && aiSuggestions.length === 0 && (
        <div className="anim-float-up rounded-[12px] border border-dashed border-ai-line bg-tint-accent px-4 py-3.5">
          <div className="mb-1.5 text-[13px] font-bold text-accent-soft">
            行き詰まっていませんか？
          </div>
          <p className="mb-3 text-xs leading-relaxed text-muted">
            {gauge >= 1
              ? "AI に相談して、視点を変えてみるのもひとつの手です。"
              : "選択中のノードの意味を AI に聞いてみるのもひとつの手です。"}
          </p>
          <button
            onClick={gauge >= 1 ? handleRequestAI : handleExplain}
            className="btn-lift btn-primary rounded-[12px] px-4 py-2 text-xs"
          >
            {gauge >= 1 ? "AI にアイデアを聞く" : "このノードについて聞く"}
          </button>
        </div>
      )}

      {/* AIの提案（破線＝仮） */}
      {aiSuggestions.length > 0 && (
        <div className="anim-float-up rounded-[12px] border border-dashed border-ai-line bg-tint-accent p-4">
          <div className="mb-3.5 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-accent-soft">
              AI の提案 — 採用するものを選ぶ
            </span>
          </div>
          <div className="mb-4 flex flex-col gap-2">
            {aiSuggestions.map((s) => (
              <button
                key={s}
                onClick={() => handleAcceptSuggestion(s)}
                className="btn-lift flex items-center gap-3 rounded-[12px] border border-line bg-card px-4 py-3 text-left text-sm text-ink transition-colors hover:border-accent/50 hover:bg-card-raised"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tint-accent-strong text-sm leading-none text-accent-soft">
                  ＋
                </span>
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAcceptAll}
              className="btn-lift btn-primary flex-1 py-3 text-[13px]"
              title="一括採用はAIゲージを多く消費します"
            >
              全部採用
            </button>
            <button
              onClick={handleSkipAI}
              className="btn-lift btn-secondary flex-1 py-3 text-[13px] !text-muted"
            >
              スキップ
            </button>
          </div>
          {aiSuggestions.length > 1 && (
            <p className="mt-2.5 text-[10px] leading-relaxed text-muted">
              ※ 全部採用するとAIゲージを {aiSuggestions.length - 1} 追加消費します
            </p>
          )}
        </div>
      )}

      <span className="flex-1" />

      {/* 下部アクション */}
      <div className="flex flex-col gap-2.5 pt-2">
        <div className="flex gap-2">
          <button
            onClick={handleExplain}
            disabled={!selected || loading === "explain"}
            className="btn-lift btn-secondary flex-1 py-3 text-[13px] disabled:opacity-40"
          >
            {loading === "explain" ? (
              <span className="inline-flex items-center gap-2">
                <TypingDots /> 考え中…
              </span>
            ) : (
              <>
                <span className="font-display">?</span>
                &nbsp;&nbsp;このノードがわからない
              </>
            )}
          </button>
          <button
            onClick={() => {
              arrange();
              touch();
            }}
            className="btn-lift btn-secondary px-4 py-3 text-[13px]"
            title="ノードをツリー状に整列します"
          >
            整える
          </button>
        </div>

        {explanation && (
          <div className="anim-float-up card-soft px-4 py-3.5 text-[13px] leading-[1.9] text-ink">
            {explanation}
          </div>
        )}

        {selected && selected.data.role !== "root" && (
          <button
            onClick={() => {
              removeNode(selected.id);
              touch();
            }}
            className="self-start rounded-full px-3 py-1.5 text-xs tracking-wider text-muted transition-colors hover:bg-tint-danger hover:text-danger"
          >
            このノードを削除
          </button>
        )}

        <button
          onClick={handleReview}
          disabled={loading === "review" || map.nodes.length < 3}
          className="btn-lift btn-primary w-full py-3.5 text-[13px] disabled:opacity-40"
        >
          {loading === "review" ? (
            <span className="inline-flex items-center gap-2.5">
              <TypingDots dark /> レビュー中…
            </span>
          ) : (
            "AI に全体をレビューしてもらう"
          )}
        </button>

        {review && (
          <div className="anim-float-up card-soft whitespace-pre-wrap px-4 py-3.5 text-[13px] leading-[1.9] text-ink">
            {review}
          </div>
        )}

        {error && (
          <div className="rounded-[12px] bg-tint-danger px-4 py-3 text-[13px] text-danger">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
