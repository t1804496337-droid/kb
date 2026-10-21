"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ROLL （机械数字滚动， polish batch 2): a counter whose digits roll
 * per-column like a mechanical odometer. Lower positions spin through
 * more turns and settle first; higher positions creep — every column
 * lands with a slight overshoot and spring-back (easeOutBack on the
 * travel distance). Rolls once on mount and again whenever the value
 * changes. Only transform is animated; the strip is two copies of 0–9
 * so the wrap from 9 to 0 is seamless.
 *
 * Deliberately NOT used on live-ticking or money figures — a number
 * that changes on its own would keep the UI shimmering. Call sites are
 * user-driven counts (landing stats, node counts, hub counts, works
 * metrics). Reduced-motion: the final value appears immediately.
 */

const STRIP = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const easeOutBack = (t: number) => {
  const s = 1.35;
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
};
/** Full turns a column makes on first mount, by position from the right:
 *  units spin twice, tens once, hundreds and up just glide to place. */
const mountTurns = (fromRight: number) =>
  fromRight === 0 ? 2 : fromRight === 1 ? 1 : 0;
/** …and on a value change only the units column takes one extra turn. */
const changeTurns = (fromRight: number) => (fromRight === 0 ? 1 : 0);
/** Lower positions settle sooner (they also travel farthest = fastest). */
const colDuration = (fromRight: number) => 460 + fromRight * 130;

export function RollNumber({
  value,
  className,
  delay = 0,
}: {
  value: number;
  className?: string;
  /** Hold the roll for this many ms after mount. Landing cards pass
   *  their entrance delay: without it the roll finished behind the
   *  cards' fade-in and nobody ever saw it. Value changes re-roll
   *  immediately (the hold only applies to the mount roll). */
  delay?: number;
}) {
  const valid = Number.isFinite(value) && value >= 0 && Number.isInteger(value);
  const digits = valid ? String(value).split("").map(Number) : [];
  const [cols, setCols] = React.useState<number[]>(() =>
    digits.map(() => 0),
  );
  const colsRef = React.useRef<number[]>(cols);
  const rafRef = React.useRef(0);
  const mountedRef = React.useRef(false);

  React.useEffect(() => {
    if (!valid) return;
    const target = String(value).split("").map(Number);
    const len = target.length;
    const cur = colsRef.current;
    // Start each column at the digit it currently shows (new leading
    // columns start at 0), then travel forward to the target digit.
    const start = target.map((_, j) => {
      const prevIdx = j - (len - cur.length);
      const prev = prevIdx >= 0 ? cur[prevIdx] : 0;
      return ((prev % 10) + 10) % 10;
    });
    const isMount = !mountedRef.current;
    const turns = isMount ? mountTurns : changeTurns;
    mountedRef.current = true;
    const dest = target.map((d, j) => {
      const fromRight = len - 1 - j;
      let base = Math.floor(start[j] / 10) * 10 + d;
      if (base < start[j] - 1e-6) base += 10;
      return base + turns(fromRight) * 10;
    });
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      dest.every((d, j) => Math.abs(d - start[j]) < 1e-6)
    ) {
      colsRef.current = dest;
      setCols(dest);
      return;
    }
    cancelAnimationFrame(rafRef.current);
    let startTimer = 0;
    const begin = () => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const elapsed = now - t0;
        let done = true;
        const next = dest.map((d, j) => {
          const fromRight = len - 1 - j;
          const t = Math.min(1, elapsed / colDuration(fromRight));
          if (t < 1) done = false;
          return start[j] + (d - start[j]) * easeOutBack(t);
        });
        colsRef.current = next;
        setCols(next);
        if (!done) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };
    // The mount-delay hold applies once; later value changes re-roll now.
    const hold = isMount ? delay : 0;
    if (hold > 0) startTimer = window.setTimeout(begin, hold);
    else begin();
    return () => {
      window.clearTimeout(startTimer);
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, valid]);

  if (!valid) return <span className={className}>{String(value)}</span>;

  return (
    <span
      className={cn("roll-num", className)}
      role="img"
      aria-label={String(value)}
      data-roll-value={value}
    >
      <span aria-hidden className="roll-cols">
        {digits.map((_, j) => {
          const pos = cols[j] ?? digits[j];
          const shift = ((pos % 10) + 10) % 10;
          return (
            <span key={j} className="roll-col">
              <span
                className="roll-strip"
                style={{ transform: `translateY(${-shift}em)` }}
              >
                {STRIP.map((d, k) => (
                  <span key={k} className="roll-digit">
                    {d}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
