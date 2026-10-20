"use client";

import * as React from "react";

const COUNT_CAP = 1200;
const HOLE_R = 64; // px
const SNAP = 0.42; // snap-in toward rim
const RELAX = 0.11; // relax-out back to home (~4x slower)
const DRIFT = 0.35;

type Seed = { hx: number; hy: number; bri: number };

/**
 * Cyan particle silhouette that answers the cursor:
 * particles inside the hole radius relocate to the rim (circular in screen space).
 * pointer-events: none — behind glass UI only.
 */
export function ParticleCursor({
  className = "pointer-events-none fixed inset-0 z-[1]",
}: {
  className?: string;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let running = true;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let cx = -9999;
    let cy = -9999;
    let seeds: Seed[] = [];
    // interleaved: homeX, homeY, x, y, size, alpha
    let data = new Float32Array(0);
    let n = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layoutHomes();
    };

    const layoutHomes = () => {
      if (!seeds.length) return;
      // Fit silhouette in center-right mid area (behind cards, visible)
      const scale = Math.min(w, h) * 0.52;
      const ox = w * 0.52;
      const oy = h * 0.48;
      for (let i = 0; i < n; i++) {
        const s = seeds[i];
        const hx = ox + s.hx * scale * 0.85;
        const hy = oy + s.hy * scale * 0.95;
        const o = i * 6;
        data[o] = hx;
        data[o + 1] = hy;
        // keep current pos near home on resize
        data[o + 2] = hx;
        data[o + 3] = hy;
        data[o + 4] = 1.2 + s.bri * 2.2;
        data[o + 5] = 0.45 + s.bri * 0.5;
      }
    };

    const onMove = (e: PointerEvent) => {
      cx = e.clientX;
      cy = e.clientY;
    };
    const onLeave = () => {
      cx = -9999;
      cy = -9999;
    };

    const tick = (t: number) => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);

      // subtle ambient field dots
      ctx.fillStyle = "rgba(180,220,230,0.12)";
      for (let i = 0; i < 40; i++) {
        const ax = ((i * 97 + t * 0.01) % w);
        const ay = ((i * 53 + 40) % h);
        ctx.fillRect(ax, ay, 1, 1);
      }

      const hole = HOLE_R;
      const hole2 = hole * hole;
      const sway = Math.sin(t * 0.00035) * DRIFT;

      for (let i = 0; i < n; i++) {
        const o = i * 6;
        let hx = data[o] + sway * (i % 7 === 0 ? 1 : -0.4);
        let hy = data[o + 1];
        let x = data[o + 2];
        let y = data[o + 3];
        const size = data[o + 4];
        const a = data[o + 5];

        // target = home, unless inside cursor hole → snap to rim
        let tx = hx;
        let ty = hy;
        let rate = RELAX;
        const dx = hx - cx;
        const dy = hy - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < hole2 && cx > -1000) {
          const d = Math.sqrt(d2) || 0.0001;
          tx = cx + (dx / d) * hole;
          ty = cy + (dy / d) * hole;
          rate = SNAP;
        }

        x += (tx - x) * rate;
        y += (ty - y) * rate;
        data[o + 2] = x;
        data[o + 3] = y;

        const s = Math.max(1, size);
        ctx.fillStyle = `rgba(80, 255, 210, ${a})`;
        ctx.fillRect(x - s * 0.5, y - s * 0.5, s, s);
      }

      raf = requestAnimationFrame(tick);
    };

    const boot = async () => {
      try {
        const res = await fetch("/particle-seeds.json", { cache: "force-cache" });
        const json = (await res.json()) as {
          points: [number, number, number][];
        };
        const pts = json.points.slice(0, COUNT_CAP);
        seeds = pts.map(([hx, hy, bri]) => ({ hx, hy, bri }));
        n = seeds.length;
        data = new Float32Array(n * 6);
      } catch {
        // procedural fallback: oval face-ish cloud
        n = 1000;
        seeds = [];
        data = new Float32Array(n * 6);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.pow(Math.random(), 0.55);
          const hx = Math.cos(a) * r * 0.55;
          const hy = Math.sin(a) * r * 0.75 - 0.05;
          seeds.push({ hx, hy, bri: 0.4 + Math.random() * 0.6 });
        }
      }
      resize();
      if (!reduced) raf = requestAnimationFrame(tick);
      else {
        // static draw once
        ctx.clearRect(0, 0, w, h);
        for (let i = 0; i < n; i++) {
          const o = i * 6;
          const s = Math.max(1, data[o + 4]);
          ctx.fillStyle = `rgba(80,255,210,${data[o + 5]})`;
          ctx.fillRect(data[o] - s * 0.5, data[o + 1] - s * 0.5, s, s);
        }
      }
    };

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    boot();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden
      style={{ pointerEvents: "none" }}
    />
  );
}
