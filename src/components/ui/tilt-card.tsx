"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Neumorph #1 — 3D tilt + moving light on pointer (light; skips if reduced-motion) */
export function TiltCard({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const ref = React.useRef<HTMLDivElement>(null);
  const raf = React.useRef(0);
  const reduced = React.useRef(false);

  React.useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const onMove = (e: React.PointerEvent) => {
    if (reduced.current) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const rx = (0.5 - y) * 6;
      const ry = (x - 0.5) * 8;
      el.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
      el.style.setProperty("--lx", `${x * 100}%`);
      el.style.setProperty("--ly", `${y * 100}%`);
    });
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(raf.current);
    el.style.transform = "perspective(800px) rotateX(0) rotateY(0)";
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={cn("tilt-card glass card-lift relative rounded-[22px]", className)}
      {...props}
    >
      <span
        className="tilt-shine pointer-events-none absolute inset-0 rounded-[inherit]"
        aria-hidden
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
