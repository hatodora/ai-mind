"use client";

import { useEffect, useRef, useState } from "react";
import { aiExplain, aiReview, aiSuggest } from "@/lib/ai-client";
import { useMindMapStore } from "@/store/mindmap-store";
import { useAuth } from "@/contexts/AuthContext";
import type { AssistLevel } from "@/types";
import {
  AI_REQUEST_COST,
  UNLOCK_THRESHOLD,
  bulkPenalty,
  bulkPenaltyNodes,
  countUserNodes,
  creditsToTurns,
  effectiveLevel,
  isUnlocked,
  nodesUntilNextTurn,
} from "@/lib/gauge";
import {
  DEFAULT_PERSONALITY,
  ageBandFromProfile,
} from "@/lib/ai-persona";
import { canPostToCommunity } from "@/lib/community";
import { Celebration } from "./Celebration";
import { PublishModal } from "./PublishModal";

/** 行き詰まり検知（NF-04）: この秒数無操作なら AI サポート導線を出す */
const STALL_SECONDS = 45;

/** マイルストーン演出（UP-01）: このノード数に到達したら祝う */
const MILESTONES = [10, 25, 50, 100, 200];

/** アシストレベルの選択肢（UP-02）。off = AI提案を使わない */
const LEVEL_OPTIONS: { value: AssistLevel; label: string; hint: string }[] = [
  { value: "level1", label: "たっぷり", hint: "1ノードで2回" },
  { value: "level2", label: "標準", hint: "1ノードで1回" },
  { value: "level3", label: "ひかえめ", hint: "3ノードで1回" },
  { value: "off", label: "AIなし", hint: "提案を使わない" },
];

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

/** アシストレベルの選択（UP-02） */
function LevelSelector({
  level,
  onChange,
}: {
  level: AssistLevel;
  onChange: (l: AssistLevel) => void;
}) {
  return (
    <div>
      <div className="micro-label mb-2">AIアシスト</div>
      <div className="grid grid-cols-4 gap-1.5">
        {LEVEL_OPTIONS.map((opt) => {
          const active = opt.value === level;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              title={opt.hint}
              className={`rounded-[10px] px-1.5 py-2 text-center transition-all ${
                active
                  ? "bg-accent font-bold text-on-accent"
                  : "border border-line bg-card text-muted hover:border-accent/50 hover:text-accent-soft"
              }`}
            >
              <span className="block text-[12px] leading-tight">
                {opt.label}
              </span>
              <span
                className={`mt-0.5 block text-[9px] leading-tight ${
                  active ? "text-on-accent/80" : "text-placeholder"
                }`}
              >
                {opt.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** AIゲージ表示（UP-02）。解禁前はロック案内を出す */
function GaugeMeter({
  credits,
  level,
  unlocked,
  remainingToUnlock,
}: {
  credits: number;
  level: AssistLevel;
  unlocked: boolean;
  remainingToUnlock: number;
}) {
  const turns = creditsToTurns(credits);
  const dots = Math.min(turns, 5);
  const nodesToNext = nodesUntilNextTurn(credits, level);

  if (!unlocked) {
    return (
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="micro-label">AIゲージ</span>
          <span className="text-[11px] font-bold text-muted">ロック中</span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          あと {remainingToUnlock} 個 自分でノードを作ると、AIに相談できます
        </p>
      </div>
    );
  }

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
          {turns > 5 && (
            <span className="font-display text-xs font-bold text-accent-soft">
              +{turns - 5}
            </span>
          )}
        </span>
      </div>
      {credits < AI_REQUEST_COST && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          あと {nodesToNext} 回 自分で考えると、AIに相談できます
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
  const noteAIRequest = useMindMapStore((s) => s.noteAIRequest);
  const completeMap = useMindMapStore((s) => s.completeMap);
  const setAssistLevel = useMindMapStore((s) => s.setAssistLevel);
  const arrange = useMindMapStore((s) => s.arrange);
  const highlightedNodeIds = useMindMapStore((s) => s.highlightedNodeIds);
  const setHighlightedNodes = useMindMapStore((s) => s.setHighlightedNodes);
  const { profile } = useAuth();

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
  const [celebration, setCelebration] = useState<{
    title: string;
    subtitle?: string;
  } | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const lastActivityRef = useRef<number | null>(null);
  const prevNodeCountRef = useRef<number | null>(null);

  // AIの語り口（UP-04 / UP-06）。未ログインは既定（大人・アドバイザー）
  const ageBand = ageBandFromProfile(profile);
  const personality = profile?.personality ?? DEFAULT_PERSONALITY;

  // イベントハンドラ専用。null = 「直前に操作があった」の印で、
  // 次のインターバル刻みで計測起点が再設定される
  const touch = () => {
    lastActivityRef.current = null;
    setStalled(false);
  };

  const selected = map?.nodes.find((n) => n.id === selectedNodeId) ?? null;
  const isUserTurn = map?.currentTurn === "user";

  // AIアシストの状態（UP-02）
  const level = effectiveLevel(map?.assistLevel);
  const aiEnabled = level !== "off";
  const userNodeCount = map ? countUserNodes(map.nodes) : 0;
  const unlocked = isUnlocked(userNodeCount);
  const gauge = map?.aiGauge ?? 0;
  const canAskAI =
    aiEnabled &&
    unlocked &&
    gauge >= AI_REQUEST_COST &&
    !!selected &&
    loading !== "ai";

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

  // マイルストーン演出（UP-01a）。マップが切り替わったら計測をリセット
  const nodeCount = map?.nodes.length ?? 0;
  const mapId = map?.id ?? null;
  useEffect(() => {
    prevNodeCountRef.current = null;
  }, [mapId]);
  // ノード数が「増えて」しきい値を跨いだ時だけ祝う（読み込み直後は祝わない）
  useEffect(() => {
    const prev = prevNodeCountRef.current;
    prevNodeCountRef.current = nodeCount;
    if (prev === null || nodeCount <= prev) return;
    const hit = MILESTONES.find((t) => prev < t && nodeCount >= t);
    if (hit) {
      setCelebration({
        title: `${hit}ノード到達`,
        subtitle: "思考がどんどん広がっています",
      });
    }
  }, [nodeCount]);

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
    const requestMapId = map.id;
    try {
      const json = await aiSuggest({
        theme: map.theme,
        selectedNodeLabel: selected.data.label,
        contextNodes: map.nodes.map((n) => ({
          id: n.id,
          label: n.data.label,
          role: n.data.role,
        })),
        ageBand,
        personality,
      });
      // 応答待ちの間に別マップへ移動していたら、何も反映しない
      // （別マップのゲージを誤って消費しないため）
      if (useMindMapStore.getState().map?.id !== requestMapId) return;
      // 文字列のみ・重複除去。空ならゲージを消費せずエラー扱いにする
      // （空のまま「AIの番」にすると操作不能になるため）
      const suggestions = Array.from(
        new Set(
          (json.suggestions ?? []).filter(
            (s) => typeof s === "string" && s.trim().length > 0,
          ),
        ),
      );
      if (suggestions.length === 0) {
        setError("AIから提案を得られませんでした。もう一度お試しください");
        return;
      }
      spendGauge(AI_REQUEST_COST);
      noteAIRequest();
      setAISuggestions(suggestions);
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
    // 一括採用は「自分で考える」をスキップした分、大きくゲージで返済する（UP-02）。
    // ペナルティはレベルの回復量を参照し、採用数の3倍のノードで回復する量。
    spendGauge(bulkPenalty(level, aiSuggestions.length));
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
    setError(null);
    setExplanation(null);
    touch();
    try {
      const json = await aiExplain({
        label: selected.data.label,
        theme: map.theme,
        ageBand,
        personality,
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
    setError(null);
    setReview(null);
    setHighlightedNodes([]);
    touch();
    const requestMapId = map.id;
    try {
      const json = await aiReview({
        theme: map.theme,
        nodes: map.nodes.map((n) => ({
          label: n.data.label,
          role: n.data.role,
        })),
        ageBand,
        personality,
      });
      // 応答待ちの間に別マップへ移動していたら反映しない
      const current = useMindMapStore.getState().map;
      if (current?.id !== requestMapId) return;
      setReview(json.review);
      // レビューが根拠にしたノードをハイライト（NF-03）。
      // ラベル一致でノードidへ引き当てる（同名ノードはすべて光らせる）
      const labels = new Set(json.usedNodeLabels ?? []);
      if (labels.size > 0) {
        setHighlightedNodes(
          current.nodes
            .filter((n) => labels.has(n.data.label))
            .map((n) => n.id),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(null);
    }
  };

  // 行き詰まり時、AI提案が使えるならそちらへ、無理ならノード解説へ誘導
  const stallCanSuggest = canAskAI;

  /** 完成フロー（UP-01b）: 結論レビューを読んだ後に一時保存 → 完成演出 */
  const handleComplete = () => {
    completeMap();
    setCelebration({
      title: "マップ完成",
      subtitle: "おつかれさま。良い思索でした",
    });
    touch();
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      {/* 達成演出（UP-01）。操作は妨げない */}
      {celebration && (
        <Celebration
          title={celebration.title}
          subtitle={celebration.subtitle}
          onDone={() => setCelebration(null)}
        />
      )}

      {/* テーマ ＋ ターンバッジ */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="micro-label mb-1">テーマ</div>
          <div className="font-display text-lg font-bold leading-[1.35]">
            {map.theme}
          </div>
        </div>
        <span className="flex flex-col items-end gap-1.5">
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
          {map.completed && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-tint-accent-strong px-3 py-1 text-[10px] font-bold tracking-wide text-accent-soft">
              ✓ 完成
            </span>
          )}
        </span>
      </div>

      {/* アシストレベル選択（UP-02） */}
      <div className="card-soft px-4 py-3.5">
        <LevelSelector level={level} onChange={setAssistLevel} />
      </div>

      {/* AIゲージ（UP-02）。No assist では非表示 */}
      {aiEnabled && (
        <div className="card-soft px-4 py-3.5">
          <GaugeMeter
            credits={gauge}
            level={level}
            unlocked={unlocked}
            remainingToUnlock={UNLOCK_THRESHOLD - userNodeCount}
          />
        </div>
      )}

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
          {aiEnabled && (
            <button
              onClick={handleRequestAI}
              disabled={!canAskAI}
              className="btn-lift btn-secondary mt-2 w-full py-3 text-[13px] font-bold !text-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
              title={
                !unlocked
                  ? `最初の${UNLOCK_THRESHOLD}個は自分でノードを作りましょう`
                  : gauge < AI_REQUEST_COST
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
          )}
        </div>
      )}

      {/* 行き詰まり検知（NF-04） */}
      {stalled && isUserTurn && aiSuggestions.length === 0 && (
        <div className="anim-float-up rounded-[12px] border border-dashed border-ai-line bg-tint-accent px-4 py-3.5">
          <div className="mb-1.5 text-[13px] font-bold text-accent-soft">
            行き詰まっていませんか？
          </div>
          <p className="mb-3 text-xs leading-relaxed text-muted">
            {stallCanSuggest
              ? "AI に相談して、視点を変えてみるのもひとつの手です。"
              : "選択中のノードの意味を AI に聞いてみるのもひとつの手です。"}
          </p>
          <button
            onClick={stallCanSuggest ? handleRequestAI : handleExplain}
            disabled={!selected}
            className="btn-lift btn-primary rounded-[12px] px-4 py-2 text-xs disabled:opacity-40"
          >
            {stallCanSuggest
              ? "AI にアイデアを聞く"
              : "このノードについて聞く"}
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
              title="一括採用はAIゲージを大きく消費します"
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
              ※ 全部採用すると、次にAIへ聞くまで約{" "}
              {bulkPenaltyNodes(aiSuggestions.length)} 個のノード追加が必要です
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

        <div className="flex items-center justify-between gap-2">
          {selected && selected.data.role !== "root" ? (
            <button
              onClick={() => {
                removeNode(selected.id);
                touch();
              }}
              className="rounded-full px-3 py-1.5 text-xs tracking-wider text-muted transition-colors hover:bg-tint-danger hover:text-danger"
            >
              このノードを削除
            </button>
          ) : (
            <span />
          )}
          {/* コミュニティ公開（NF-01b）: 15歳以上・ログイン済みのみ */}
          {selected && canPostToCommunity(profile) && map.ownerId && (
            <button
              onClick={() => {
                setPublishOpen(true);
                touch();
              }}
              className="rounded-full px-3 py-1.5 text-xs tracking-wider text-accent-soft transition-colors hover:bg-tint-accent-strong"
              title="選択ノードとその子孫をコミュニティに公開します"
            >
              このノードを公開
            </button>
          )}
        </div>

        {publishOpen && selected && (
          <PublishModal
            rootNodeId={selected.id}
            onClose={() => setPublishOpen(false)}
          />
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

        {/* レビュー根拠のハイライト（NF-03）: AI要約の非ブラックボックス化 */}
        {highlightedNodeIds.length > 0 && (
          <div className="flex items-center justify-between gap-2 rounded-[12px] bg-tint-warm px-4 py-2.5">
            <span className="text-[11px] leading-relaxed text-warm">
              レビューの根拠になった {highlightedNodeIds.length} 個のノードを
              マップ上でハイライト中
            </span>
            <button
              onClick={() => setHighlightedNodes([])}
              className="shrink-0 rounded-full border border-line bg-card px-3 py-1 text-[10px] font-bold text-muted transition-colors hover:text-ink"
            >
              解除
            </button>
          </div>
        )}

        {/* 完成フロー（UP-01b）: 結論を読んだら一時保存で完成にできる */}
        {review && !map.completed && (
          <button
            onClick={handleComplete}
            className="btn-lift btn-secondary w-full py-3.5 text-[13px] font-bold !text-accent-soft"
            title="このマップを完成として保存します"
          >
            マップを一時的に保存する
          </button>
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
