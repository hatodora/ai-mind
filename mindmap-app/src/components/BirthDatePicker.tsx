"use client";

import { useEffect, useMemo, useState } from "react";
import { MAX_BIRTHDATE_AGE, MIN_BIRTHDATE_AGE } from "@/lib/ai-persona";

const SELECT_CLASS =
  "w-full rounded-[12px] border border-line bg-card px-3 py-3.5 text-center text-[15px] text-ink outline-none ring-accent/40 transition-shadow focus:border-accent/60 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-40 [color-scheme:dark]";

type Part = number | "";

/** 指定した年月の末日（1〜31）。うるう年を考慮する */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function parseValue(value: string): { year: Part; month: Part; day: Part } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return { year: "", month: "", day: "" };
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/**
 * 誕生日入力（年・月・日の3セレクト）。
 * `<input type="date">` のカレンダーを何十年分もめくる操作が面倒という
 * フィードバックを受けて、直接年を選べる形に置き換えた。
 * 存在しない日付（2/30 等）を選べないよう、日は年月に応じて絞り込む。
 *
 * 年・月・日を選択途中の状態は内部 state で保持する（外部の value は
 * 3つ揃うまで空文字のまま）。これをしないと「年だけ選んだ瞬間 value が
 * 空に戻り、選んだはずの年の表示も消える」という挙動になってしまう。
 */
export function BirthDatePicker({
  value,
  onChange,
  disabled,
}: {
  /** YYYY-MM-DD、または未選択なら空文字 */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [year, setYear] = useState<Part>(() => parseValue(value).year);
  const [month, setMonth] = useState<Part>(() => parseValue(value).month);
  const [day, setDay] = useState<Part>(() => parseValue(value).day);

  // 外部から value が変わったら追従する（プロフィール読み込み・リセット等）。
  // setState を effect 内で直接呼ばない（次のティックで反映）
  useEffect(() => {
    const t = setTimeout(() => {
      const p = parseValue(value);
      setYear(p.year);
      setMonth(p.month);
      setDay(p.day);
    }, 0);
    return () => clearTimeout(t);
  }, [value]);

  const thisYear = new Date().getFullYear();
  // 直近（最年少）から古い方へ。5〜120歳になり得る年をすべて並べる
  const years = useMemo(() => {
    const count = MAX_BIRTHDATE_AGE - MIN_BIRTHDATE_AGE + 1;
    return Array.from(
      { length: count },
      (_, i) => thisYear - MIN_BIRTHDATE_AGE - i,
    );
  }, [thisYear]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const dayCount =
    year !== "" && month !== "" ? daysInMonth(year, month) : 31;
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => i + 1),
    [dayCount],
  );

  const commit = (y: Part, mo: Part, d: Part) => {
    // 3つ揃うまでは選択状態だけ保持し、外部へは通知しない
    if (y === "" || mo === "" || d === "") {
      setYear(y);
      setMonth(mo);
      setDay(d);
      onChange("");
      return;
    }
    // 月を変えて日が範囲外になったら自動的に末日に丸める（2/31→2/28等）
    const clampedDay = Math.min(d, daysInMonth(y, mo));
    setYear(y);
    setMonth(mo);
    setDay(clampedDay);
    const pad = (n: number) => String(n).padStart(2, "0");
    onChange(`${y}-${pad(mo)}-${pad(clampedDay)}`);
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      <select
        aria-label="生まれた年"
        value={year}
        disabled={disabled}
        onChange={(e) =>
          commit(e.target.value ? Number(e.target.value) : "", month, day)
        }
        className={SELECT_CLASS}
      >
        <option value="">年</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}年
          </option>
        ))}
      </select>
      <select
        aria-label="生まれた月"
        value={month}
        disabled={disabled}
        onChange={(e) =>
          commit(year, e.target.value ? Number(e.target.value) : "", day)
        }
        className={SELECT_CLASS}
      >
        <option value="">月</option>
        {months.map((mo) => (
          <option key={mo} value={mo}>
            {mo}月
          </option>
        ))}
      </select>
      <select
        aria-label="生まれた日"
        value={day}
        disabled={disabled}
        onChange={(e) =>
          commit(year, month, e.target.value ? Number(e.target.value) : "")
        }
        className={SELECT_CLASS}
      >
        <option value="">日</option>
        {days.map((d) => (
          <option key={d} value={d}>
            {d}日
          </option>
        ))}
      </select>
    </div>
  );
}
