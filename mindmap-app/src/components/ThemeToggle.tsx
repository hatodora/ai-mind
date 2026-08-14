"use client";

import { THEME_CHOICES, THEME_LABEL, type ThemeChoice } from "@/lib/theme";
import { useThemeStore } from "@/store/theme-store";

/**
 * テーマの切替（THM-03）。3択の並びで、いま選んでいるものを塗って示す。
 *
 * ログイン不要の設定なので、設定画面だけでなくホームのフッターにも置く。
 * compact を渡すと、フッターに収まる小さい見た目になる。
 */

/** 各選択肢の絵。文字だけだと並びを見分けにくい */
function ChoiceIcon({ choice }: { choice: ThemeChoice }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (choice === "light") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
      </svg>
    );
  }
  if (choice === "dark") {
    return (
      <svg {...common}>
        <path d="M20 13.4A8.2 8.2 0 1 1 10.6 4a6.6 6.6 0 0 0 9.4 9.4z" />
      </svg>
    );
  }
  // system: 端末の画面
  return (
    <svg {...common}>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M9 21h6M12 17v4" />
    </svg>
  );
}

export function ThemeToggle({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const choice = useThemeStore((s) => s.choice);
  const setChoice = useThemeStore((s) => s.setChoice);
  // 端末の設定を読む前は、どれも選ばれていない見た目にする。
  // 既定の system を先に塗ると、ダークを選んでいる人の画面で
  // 選択の枠だけが一瞬ずれて見える
  const hydrated = useThemeStore((s) => s.hydrated);

  return (
    <div
      role="radiogroup"
      aria-label="テーマ"
      className={`inline-flex gap-1 rounded-full border border-line bg-card p-1 ${className}`}
    >
      {THEME_CHOICES.map((c) => {
        const selected = hydrated && c === choice;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setChoice(c)}
            title={THEME_LABEL[c]}
            className={`flex items-center gap-1.5 rounded-full transition-colors ${
              compact ? "px-2.5 py-1" : "px-3.5 py-2 text-[13px]"
            } ${
              selected
                ? "bg-accent text-on-accent font-bold"
                : "text-muted hover:bg-card-raised hover:text-ink"
            }`}
          >
            <ChoiceIcon choice={c} />
            {/* 小さい版は絵だけ。読み上げには名前を残す */}
            <span className={compact ? "sr-only" : ""}>{THEME_LABEL[c]}</span>
          </button>
        );
      })}
    </div>
  );
}
