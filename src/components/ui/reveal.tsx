"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Soft scroll-in fade — IntersectionObserver, no continuous RAF */
export function Reveal({
  className,
  children,
  delayMs = 0,
  ...props
}: React.ComponentProps<"div"> & { delayMs?: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -24px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("reveal-in", shown && "reveal-in-shown", className)}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
      {...props}
    >
      {children}
    </div>
  );
}
