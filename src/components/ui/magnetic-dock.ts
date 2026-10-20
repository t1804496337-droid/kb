"use client";

import * as React from "react";

/**
 * Magnetic dock （磁吸工具坞， polish batch 2): on hover-capable fine
 * pointers, the group's direct button/link children swell as the
 * pointer nears — the scale peaks on the item under the pointer and
 * falls off with a cosine curve, with a small lift; leaving the group
 * eases everything back to rest. Written through the standalone
 * `scale` / `translate` properties so it composes with the batch-1
 * press feedback instead of fighting it: a press folds 0.96 into the
 * magnetic scale. Touch pointers and reduced-motion never engage, and
 * all inline styles are cleared when the hook disables/unmounts.
 */
export function useMagneticDock<T extends HTMLElement>(enabled: boolean) {
  const ref = React.useRef<T | null>(null);

  React.useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduced.matches) return;

    const items = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(":scope > button, :scope > a"),
      );
    let pressed: HTMLElement | null = null;
    let last: { x: number; y: number } | null = null;
    let raf = 0;

    const apply = () => {
      raf = 0;
      const list = items();
      if (!last) {
        list.forEach((el) => {
          el.style.scale = "";
          el.style.translate = "";
        });
        return;
      }
      const RADIUS = 118;
      list.forEach((el) => {
        const r = el.getBoundingClientRect();
        const d = Math.hypot(
          last!.x - (r.left + r.width / 2),
          last!.y - (r.top + r.height / 2),
        );
        const fall =
          d >= RADIUS ? 0 : Math.cos((d / RADIUS) * (Math.PI / 2));
        let scale = 1 + 0.16 * fall;
        if (el === pressed) scale *= 0.96;
        el.style.scale = scale.toFixed(4);
        el.style.translate = `0 ${(-3 * fall).toFixed(2)}px`;
      });
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onMove = (e: PointerEvent) => {
      last = { x: e.clientX, y: e.clientY };
      schedule();
    };
    const onLeave = () => {
      last = null;
      pressed = null;
      schedule();
    };
    const onDown = (e: PointerEvent) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>(
        "button, a",
      );
      pressed = t && root.contains(t) ? t : null;
      schedule();
    };
    const onUp = () => {
      pressed = null;
      schedule();
    };

    root.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      cancelAnimationFrame(raf);
      items().forEach((el) => {
        el.style.scale = "";
        el.style.translate = "";
      });
    };
  }, [enabled]);

  return ref;
}
