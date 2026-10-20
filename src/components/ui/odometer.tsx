"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Neumorph #4b — scroll/count odometer for metric values */
export function Odometer({
  value,
  className,
}: {
  value: string | number;
  className?: string;
}) {
  const str = String(value);
  const numeric = /^\d+$/.test(str) ? Number(str) : null;
  const [display, setDisplay] = React.useState(numeric === null ? str : "0");

  React.useEffect(() => {
    if (numeric === null) {
      setDisplay(str);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const dur = 700;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(String(Math.round(numeric * eased)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [str, numeric]);

  return (
    <span className={cn("odometer font-mono tabular-nums", className)}>
      {display}
    </span>
  );
}
