"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mascot, type MascotPose } from "./Mascot";
import { useMascotStore } from "@/store/mascot-store";
import { useTutorialStore } from "@/store/tutorial-store";

/**
 * 画面の左下に常駐するキャラクター（CHR-02）。
 *
 * ホーム: タップすると反応する。手を振り、しつこいと嫌がり、放っておくと寝る。
 * エディタ: タップするとメニューが開く。ポーズは画面の状況（AI待ちなど）に従う。
 *
 * どちらの画面でも、何もしていないときは待機ポーズをゆっくり巡回する。
 */

/** 待機中に巡回するポーズ */
const IDLE_POSES: MascotPose[] = ["sit", "meditate", "read", "work", "wave"];

/** 待機ポーズを切り替える間隔 */
const IDLE_ROTATE_MS = 8000;
/** これだけタップされないと寝る（ホームのみ） */
const SLEEP_AFTER_MS = 45000;
/** この時間内に…… */
const TAP_WINDOW_MS = 3000;
/** ……これだけタップされると嫌がる */
const ANNOYED_TAPS = 4;
/** 反応ポーズを見せている時間 */
const REACTION_MS = 1900;

export function MascotDock({
  variant,
  className = "",
}: {
  variant: "home" | "editor";
  className?: string;
}) {
  const router = useRouter();
  const contextPose = useMascotStore((s) => s.contextPose);
  const startTutorial = useTutorialStore((s) => s.start);
  const tutorialCleared = useTutorialStore((s) => s.clearedAt !== null);

  const [idleIndex, setIdleIndex] = useState(0);
  const [reaction, setReaction] = useState<MascotPose | null>(null);
  const [asleep, setAsleep] = useState(false);
  const [shake, setShake] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  /** 直近のタップ時刻。連打の判定に使う */
  const tapsRef = useRef<number[]>([]);
  /** 最後にかまってもらった時刻。null = まだ数え始めていない */
  const lastTapRef = useRef<number | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 待機ポーズの巡回。反応中・就寝中は進めない
  useEffect(() => {
    const t = setInterval(() => {
      setIdleIndex((i) => (i + 1) % IDLE_POSES.length);
    }, IDLE_ROTATE_MS);
    return () => clearInterval(t);
  }, []);

  // 放っておくと寝る（ホームだけ。エディタは作業の邪魔になるのでしない）
  useEffect(() => {
    if (variant !== "home") return;
    // 画面を開いた時点から数え始める
    lastTapRef.current = Date.now();
    const t = setInterval(() => {
      const last = lastTapRef.current;
      if (last !== null && Date.now() - last > SLEEP_AFTER_MS) setAsleep(true);
    }, 5000);
    return () => clearInterval(t);
  }, [variant]);

  useEffect(
    () => () => {
      if (reactionTimer.current) clearTimeout(reactionTimer.current);
    },
    [],
  );

  const react = useCallback((pose: MascotPose) => {
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    setReaction(pose);
    reactionTimer.current = setTimeout(() => {
      setReaction(null);
      reactionTimer.current = null;
    }, REACTION_MS);
  }, []);

  const handleTap = () => {
    if (variant === "editor") {
      setMenuOpen((v) => !v);
      return;
    }
    const now = Date.now();
    lastTapRef.current = now;
    setAsleep(false);
    // 時間窓の外に出たタップは忘れる
    tapsRef.current = [...tapsRef.current, now].filter(
      (t) => now - t <= TAP_WINDOW_MS,
    );
    if (tapsRef.current.length >= ANNOYED_TAPS) {
      // 嫌がったら数え直し。連続で嫌がり続けないようにする
      tapsRef.current = [];
      react("annoyed");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } else {
      react("wave");
    }
  };

  // 反応 > 就寝 > 画面の状況 > 待機巡回 の順で決める
  const pose: MascotPose =
    reaction ??
    (asleep ? "sleep" : null) ??
    (variant === "editor" ? contextPose : null) ??
    IDLE_POSES[idleIndex];

  const label =
    variant === "editor"
      ? "キャラクターのメニューを開く"
      : "キャラクターにさわる";

  // エディタでは操作パネル（デスクトップは左310px）を避けて
  // キャンバスの左下に置く
  const place =
    variant === "editor"
      ? "bottom-3 left-3 sm:bottom-5 sm:left-[326px]"
      : "bottom-3 left-3 sm:bottom-5 sm:left-5";

  return (
    <div className={`pointer-events-none fixed z-30 ${place} ${className}`}>
      {menuOpen && (
        <>
          {/* 外側をタップしたら閉じる */}
          <button
            className="pointer-events-auto fixed inset-0 z-0 cursor-default"
            aria-label="メニューを閉じる"
            onClick={() => setMenuOpen(false)}
          />
          <div className="anim-float-up pointer-events-auto relative z-10 mb-2 w-52 overflow-hidden rounded-[14px] border border-line bg-card shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)]">
            <button
              onClick={() => {
                setMenuOpen(false);
                startTutorial();
                router.push("/new");
              }}
              className="block w-full px-4 py-3 text-left text-[13px] font-bold text-accent-soft transition-colors hover:bg-card-raised"
            >
              {tutorialCleared ? "チュートリアルをもう一度" : "使い方をみる"}
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                router.push("/badges");
              }}
              className="block w-full border-t border-line px-4 py-3 text-left text-[13px] text-ink transition-colors hover:bg-card-raised"
            >
              バッジを見る
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                router.push("/");
              }}
              className="block w-full border-t border-line px-4 py-3 text-left text-[13px] text-muted transition-colors hover:bg-card-raised"
            >
              ホームへ戻る
            </button>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={handleTap}
        aria-label={label}
        aria-expanded={variant === "editor" ? menuOpen : undefined}
        className={`pointer-events-auto block w-[62px] text-ink/80 transition-transform hover:scale-105 active:scale-95 sm:w-[80px] ${
          shake ? "mascot-shake" : ""
        }`}
        // キャンバスの上に置くので、塗りつぶし色は下地に合わせる
        style={
          variant === "editor"
            ? ({ "--mascot-fill": "var(--canvas)" } as React.CSSProperties)
            : undefined
        }
      >
        <Mascot pose={pose} />
      </button>
    </div>
  );
}
