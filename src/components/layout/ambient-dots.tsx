"use client";

import * as React from "react";

type Dot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  phase: number;
  speed: number;
  tone: 0 | 1 | 2 | 3; // cyan | bright-cyan | white | mint
  layer: 0 | 1 | 2; // trunk | branch | field
};

/** Cap for perf — rich look without Three.js */
const COUNT = 280;

const COLORS = [
  "34, 211, 238", // cyan
  "125, 211, 252", // sky
  "240, 253, 255", // near-white
  "52, 211, 153", // mint
] as const;

/**
 * Full-viewport cyan glow particle tree (rise feel).
 * Behind UI only — never captures clicks.
 */
export function AmbientDots({ className = "pointer-events-none fixed inset-0 z-[1]" }: { className?: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let dots: Dot[] = [];
    let raf = 0;
    let w = 0;
    let h = 0;
    let t = 0;
    let reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const parent = canvas.parentElement;
      const rect = parent?.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect?.width || window.innerWidth));
      h = Math.max(1, Math.floor(rect?.height || window.innerHeight));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /** Tree bias: denser vertical trunk + rising branches + soft field */
    const seed = () => {
      const cx = w * 0.52;
      dots = [];
      for (let i = 0; i < COUNT; i++) {
        const roll = Math.random();
        let layer: 0 | 1 | 2;
        let x: number;
        let y: number;
        if (roll < 0.32) {
          // trunk — center column (behind glass + gap)
          layer = 0;
          const spread = 36 + Math.random() * 56;
          x = cx + (Math.random() - 0.5) * spread;
          y = h * (0.05 + Math.random() * 0.9);
        } else if (roll < 0.62) {
          // branches — fan upward
          layer = 1;
          const along = Math.random();
          const branchY = h * (0.1 + along * 0.75);
          const fan = (50 + along * 200) * (Math.random() < 0.5 ? -1 : 1);
          x = cx + fan * (0.3 + Math.random() * 0.7);
          y = branchY + (Math.random() - 0.5) * 40;
        } else {
          // ambient field — denser near left gap + edges so tree reads outside glass
          layer = 2;
          if (Math.random() < 0.35) {
            x = 8 + Math.random() * Math.min(200, w * 0.18);
            y = Math.random() * h;
          } else {
            x = Math.random() * w;
            y = Math.random() * h;
          }
        }

        const tone = (
          layer === 0 ? (Math.random() < 0.7 ? 0 : 1) : Math.floor(Math.random() * 4)
        ) as 0 | 1 | 2 | 3;

        const rise =
          layer === 0
            ? 0.22 + Math.random() * 0.35
            : layer === 1
              ? 0.14 + Math.random() * 0.28
              : 0.06 + Math.random() * 0.16;

        dots.push({
          x,
          y,
          vx: (Math.random() - 0.5) * (layer === 2 ? 0.12 : 0.08),
          vy: -rise, // upward
          r:
            layer === 0
              ? 1.6 + Math.random() * 2.4
              : layer === 1
                ? 1.2 + Math.random() * 1.8
                : 0.8 + Math.random() * 1.4,
          a:
            layer === 0
              ? 0.7 + Math.random() * 0.3
              : layer === 1
                ? 0.5 + Math.random() * 0.35
                : 0.28 + Math.random() * 0.3,
          phase: Math.random() * Math.PI * 2,
          speed: 0.006 + Math.random() * 0.012,
          tone,
          layer,
        });
      }
    };

    const tick = () => {
      t += 1;
      ctx.clearRect(0, 0, w, h);

      // soft trunk glow (cheap radial, once)
      const g = ctx.createRadialGradient(w * 0.48, h * 0.5, 4, w * 0.5, h * 0.42, h * 0.5);
      g.addColorStop(0, "rgba(34, 211, 238, 0.32)");
      g.addColorStop(0.4, "rgba(34, 211, 238, 0.14)");
      g.addColorStop(1, "rgba(34, 211, 238, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      for (const d of dots) {
        if (!reduced) {
          const sway = Math.sin(t * d.speed + d.phase) * (d.layer === 0 ? 0.25 : 0.45);
          d.x += d.vx + sway * 0.06;
          d.y += d.vy;
          // wrap upward rise
          if (d.y < -10) {
            d.y = h + 10;
            if (d.layer !== 2) {
              const cx = w * 0.52;
              const spread = d.layer === 0 ? 50 : 140;
              d.x = cx + (Math.random() - 0.5) * spread;
            } else {
              d.x = Math.random() * w;
            }
          }
          if (d.x < -12) d.x = w + 12;
          if (d.x > w + 12) d.x = -12;
        }

        const pulse = 0.82 + 0.18 * Math.sin(t * d.speed * 2.2 + d.phase);
        const col = COLORS[d.tone];

        // outer glow halo
        ctx.beginPath();
        ctx.fillStyle = `rgba(${col}, ${Math.min(0.55, d.a * 0.4 * pulse)})`;
        ctx.arc(d.x, d.y, d.r * (d.layer === 0 ? 4.2 : 3.0), 0, Math.PI * 2);
        ctx.fill();

        // core
        ctx.beginPath();
        ctx.fillStyle = `rgba(${col}, ${d.a * pulse})`;
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };

    resize();
    seed();
    tick();

    const onResize = () => {
      resize();
      seed();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
    />
  );
}
