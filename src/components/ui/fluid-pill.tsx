"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useMagneticDock } from "./magnetic-dock";

/**
 * Fluid pill group (FLUID MORPH, polish batch 1): a capsule indicator that
 * slides under whichever child carries `data-pill-active="true"` instead of
 * each item painting its own background. The group measures the active
 * child (offsetLeft/Top/Width/Height) on every render + on resize, and the
 * indicator transitions transform/width/height — so switching sections
 * reads as one capsule flowing to the new item, across wrapped rows too.
 * The active child's own active-background is switched off in CSS
 * (.fluid-pill .studio-pill-active) so only the capsule paints.
 */
export function FluidPillGroup({
  as = "div",
  className,
  indicatorClassName,
  magnet = false,
  children,
  ...rest
}: {
  as?: "div" | "nav";
  className?: string;
  indicatorClassName?: string;
  /** Magnetic dock （磁吸）: items swell near the pointer (desktop hover only). */
  magnet?: boolean;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  const ref = React.useRef<HTMLElement | null>(null);
  const magnetRef = useMagneticDock<HTMLElement>(magnet);
  const [ind, setInd] = React.useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  const measure = React.useCallback(() => {
    const root = ref.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>("[data-pill-active='true']");
    if (!el || el.offsetWidth === 0) {
      setInd((prev) => (prev === null ? prev : null));
      return;
    }
    const next = {
      x: el.offsetLeft,
      y: el.offsetTop,
      w: el.offsetWidth,
      h: el.offsetHeight,
    };
    // Bail out on identical geometry — a fresh object every layout pass
    // would re-render the group forever (React #185).
    setInd((prev) =>
      prev &&
      prev.x === next.x &&
      prev.y === next.y &&
      prev.w === next.w &&
      prev.h === next.h
        ? prev
        : next,
    );
  }, []);

  // Re-measure after every render: item sets and labels/counts change as
  // data loads, and the capsule must track the active item's real box.
  React.useLayoutEffect(measure);

  React.useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const Tag = as as "div";
  return (
    <Tag
      ref={(el: HTMLElement | null) => {
        (ref as React.MutableRefObject<HTMLElement | null>).current = el;
        magnetRef.current = el;
      }}
      className={cn("fluid-pill", magnet && "magnet-dock", className)}
      {...rest}
    >
      <span
        aria-hidden
        className={cn("fluid-pill-ind", indicatorClassName)}
        style={{
          width: ind?.w ?? 0,
          height: ind?.h ?? 0,
          transform: ind ? `translate(${ind.x}px, ${ind.y}px)` : undefined,
          opacity: ind ? 1 : 0,
        }}
      />
      {children}
    </Tag>
  );
}
