"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ThemeId = "silver" | "warm" | "neu";

type NodeSpec = {
  /** base position as % of orb box */
  x: number;
  y: number;
  size: number;
  beam: string;
  drift: number;
  phase: number;
};

/** Five jellyfish/brain satellites matching the silver-black reference orb. */
const NODES: NodeSpec[] = [
  { x: 50, y: 14, size: 13, beam: "rgba(200,190,255,0.85)", drift: 1.0, phase: 0.0 },
  { x: 14, y: 42, size: 12, beam: "rgba(140,220,230,0.8)", drift: 1.15, phase: 1.1 },
  { x: 18, y: 68, size: 11, beam: "rgba(230,207,152,0.75)", drift: 0.9, phase: 2.2 },
  { x: 86, y: 40, size: 12, beam: "rgba(190,200,255,0.8)", drift: 1.05, phase: 0.7 },
  { x: 82, y: 66, size: 13, beam: "rgba(230,180,120,0.9)", drift: 1.2, phase: 1.8 },
];

/**
 * Real ~6s neural-orb loop + live animated jellyfish/brain node layer.
 * Theme grades the same loop (silver / warm / neu) without swapping metaphor.
 */

/** Fibonacci-sphere wireframe: denser near core, dark-gray thin edges. */
function SpiderCage({ t }: { t: number }) {
  const pts = React.useMemo(() => {
    const N = 72;
    const out: { x: number; y: number; z: number }[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      out.push({ x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius });
    }
    return out;
  }, []);

  const rot = t * 0.12;
  const projected = pts.map((p) => {
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const x = p.x * cos - p.z * sin;
    const z = p.x * sin + p.z * cos;
    const scale = 28 / (1.55 + z * 0.55);
    return { x: 50 + x * scale, y: 50 + p.y * scale * 0.92, z };
  });

  const edges: [number, number][] = [];
  for (let i = 0; i < projected.length; i++) {
    let nearest: { j: number; d: number }[] = [];
    for (let j = i + 1; j < projected.length; j++) {
      const dx = projected[i].x - projected[j].x;
      const dy = projected[i].y - projected[j].y;
      const d = dx * dx + dy * dy;
      nearest.push({ j, d });
    }
    nearest.sort((a, b) => a.d - b.d);
    for (const n of nearest.slice(0, 4)) {
      if (n.d < 220) edges.push([i, n.j]);
    }
  }

  return (
    <g>
      {edges.map(([a, b], i) => {
        const pa = projected[a];
        const pb = projected[b];
        const depth = (pa.z + pb.z) * 0.5;
        const op = 0.12 + Math.max(0, 0.28 - Math.abs(depth) * 0.12);
        return (
          <line
            key={i}
            x1={pa.x}
            y1={pa.y}
            x2={pb.x}
            y2={pb.y}
            stroke="rgba(160,168,180,0.85)"
            strokeWidth={0.22 + Math.max(0, 0.15 - Math.abs(depth) * 0.06)}
            opacity={op}
          />
        );
      })}
    </g>
  );
}

export function NeuralOrb({
  className,
  theme = "silver",
}: {
  className?: string;
  theme?: ThemeId;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [seamSoft, setSeamSoft] = React.useState(false);
  const [t, setT] = React.useState(0);
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    const play = () => {
      void v.play().catch(() => {});
    };
    play();

    const onTime = () => {
      const d = v.duration || 6;
      // Tighter seam window (~0.15s) so the loop reads continuous
      const nearEnd = v.currentTime > d - 0.18;
      const nearStart = v.currentTime < 0.14;
      setSeamSoft(nearEnd || nearStart);
    };
    v.addEventListener("timeupdate", onTime);

    const onVis = () => {
      if (document.visibilityState === "visible") play();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  React.useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setT((now - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  const core = { x: 50, y: 50 };

  const isBg = typeof className === "string" && className.includes("studio-orb-bg");
  return (
    <div
      className={cn(
        "studio-orb pointer-events-none select-none",
        `studio-orb-skin-${theme}`,
        className,
      )}
      aria-hidden
      data-orb-theme={theme}
      style={
        isBg
          ? {
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              maxWidth: "none",
              maxHeight: "none",
              zIndex: 0,
              pointerEvents: "none",
            }
          : undefined
      }
    >
      <div className="studio-orb-bloom" />
      <video
        ref={videoRef}
        className={cn("studio-orb-video", seamSoft && "studio-orb-seam")}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      >
        <source src="/studio/neural-orb.webm" type="video/webm" />
        <source src="/studio/neural-orb.mp4" type="video/mp4" />
      </video>

      {/* Dense polygonal spider-web cage around core — match keyframe wireframe */}
      <svg
        className="studio-orb-spider-cage"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <SpiderCage t={t} />
      </svg>

            {/* Live jellyfish/brain node layer (SVG) — pulses & drifts for the ~6s feel */}
      <svg
        className="studio-orb-live-nodes"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="studio-node-glass" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="45%" stopColor="rgba(220,225,240,0.22)" />
            <stop offset="100%" stopColor="rgba(40,42,48,0.05)" />
          </radialGradient>
          <filter id="studio-node-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {NODES.map((n, i) => {
          const ox = Math.sin(t * 0.55 * n.drift + n.phase) * 1.6;
          const oy = Math.cos(t * 0.48 * n.drift + n.phase * 1.3) * 1.4;
          const pulse = 0.78 + 0.22 * Math.sin(t * 1.15 + n.phase);
          const nx = n.x + ox;
          const ny = n.y + oy;
          const r = n.size * (0.92 + 0.08 * Math.sin(t * 0.9 + i));
          return (
            <g key={i} filter="url(#studio-node-glow)">
              {/* tether beam to core */}
              <line
                x1={core.x}
                y1={core.y}
                x2={nx}
                y2={ny}
                stroke={n.beam}
                strokeWidth={0.35 + 0.15 * pulse}
                opacity={0.35 + 0.35 * pulse}
                strokeLinecap="round"
              />
              {/* soft particle trail */}
              <circle
                cx={nx + (core.x - nx) * 0.35}
                cy={ny + (core.y - ny) * 0.35}
                r={0.45}
                fill={n.beam}
                opacity={0.35 * pulse}
              />
              {/* glass brain/jellyfish shell */}
              <ellipse
                cx={nx}
                cy={ny}
                rx={r * 0.55}
                ry={r * 0.48}
                fill="url(#studio-node-glass)"
                stroke="rgba(236,236,233,0.55)"
                strokeWidth={0.25}
                opacity={0.7 + 0.25 * pulse}
              />
              {/* inner neural filaments */}
              <path
                d={`M ${nx - r * 0.28} ${ny} Q ${nx} ${ny - r * 0.35} ${nx + r * 0.28} ${ny} Q ${nx} ${ny + r * 0.3} ${nx - r * 0.28} ${ny}`}
                fill="none"
                stroke="rgba(236,236,233,0.65)"
                strokeWidth={0.2}
                opacity={0.55 + 0.3 * pulse}
              />
              <circle
                cx={nx}
                cy={ny}
                r={r * 0.12}
                fill={n.beam}
                opacity={0.55 + 0.35 * pulse}
              />
              {/* trailing filaments */}
              <path
                d={`M ${nx - r * 0.15} ${ny + r * 0.35} q ${-r * 0.2} ${r * 0.35} ${-r * 0.05} ${r * 0.55}`}
                fill="none"
                stroke="rgba(200,210,230,0.4)"
                strokeWidth={0.18}
                opacity={0.5 * pulse}
              />
              <path
                d={`M ${nx + r * 0.12} ${ny + r * 0.35} q ${r * 0.18} ${r * 0.3} ${r * 0.05} ${r * 0.5}`}
                fill="none"
                stroke="rgba(200,210,230,0.35)"
                strokeWidth={0.16}
                opacity={0.45 * pulse}
              />
            </g>
          );
        })}

        {/* floating dust particles */}
        {Array.from({ length: 14 }).map((_, i) => {
          const a = (i / 14) * Math.PI * 2 + t * 0.12;
          const rad = 28 + (i % 5) * 4 + Math.sin(t * 0.7 + i) * 2;
          const px = 50 + Math.cos(a) * rad;
          const py = 50 + Math.sin(a * 0.92) * rad * 0.9;
          return (
            <circle
              key={`p${i}`}
              cx={px}
              cy={py}
              r={0.35 + (i % 3) * 0.12}
              fill={i % 3 === 0 ? "rgba(230,207,152,0.7)" : "rgba(220,225,255,0.55)"}
              opacity={0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t + i))}
            />
          );
        })}
      </svg>
    </div>
  );
}
