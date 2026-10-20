"use client";

import * as React from "react";

/**
 * Full-viewport spotlight that follows the pointer via CSS vars.
 * Soft radial light + slight darken elsewhere; never captures clicks.
 */
export function CursorSpotlight({
  className = "cursor-spotlight pointer-events-none fixed inset-0 z-[2] overflow-hidden",
}: {
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Static soft center when reduced motion — still show the layer
    el.style.setProperty("--spot-x", "50%");
    el.style.setProperty("--spot-y", "38%");
    if (reduced) return;

    const onMove = (e: PointerEvent) => {
      el.style.setProperty("--spot-x", `${e.clientX}px`);
      el.style.setProperty("--spot-y", `${e.clientY}px`);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return <div ref={ref} className={className} aria-hidden />;
}
