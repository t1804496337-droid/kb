"use client";

import * as React from "react";

/** Neumorph #4a — soft magnetic cursor glow (pointer-events none) */
export function MagneticCursor() {
  const ref = React.useRef<HTMLDivElement>(null);
  const pos = React.useRef({ x: -100, y: -100 });
  const target = React.useRef({ x: -100, y: -100 });
  const raf = React.useRef(0);

  React.useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const onMove = (e: PointerEvent) => {
      target.current = { x: e.clientX, y: e.clientY };
    };

    const loop = () => {
      const p = pos.current;
      const t = target.current;
      p.x += (t.x - p.x) * 0.18;
      p.y += (t.y - p.y) * 0.18;
      const el = ref.current;
      if (el) {
        el.style.transform = `translate3d(${p.x - 14}px, ${p.y - 14}px, 0)`;
      }
      raf.current = requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf.current = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="magnetic-cursor pointer-events-none fixed left-0 top-0 z-[60] hidden h-7 w-7 rounded-full md:block"
    />
  );
}
