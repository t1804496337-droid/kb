"use client";

import * as React from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { jellyMotion } from "./module-jelly";
import { JellyMedia } from "./jelly-media";
import { RollNumber } from "@/components/ui/roll-number";

/**
 * Landing card tilt + glare (polish batch 2, TILT GLARE): on hover-
 * capable fine pointers the card leans toward the pointer (≤5° per
 * axis) while a glare spot tracks it through the --gx/--gy custom
 * properties. Transform is written straight to the element (rAF-
 * throttled) so React never re-renders for pointer motion; the batch-1
 * transition on buttons smooths both the tracking and the return to
 * rest. The card's entrance animation uses fill backwards so a finished
 * entrance never pins `transform: none` over the tilt.
 *
 * Touch path (2026-10-21): phones have no hover, so the tilt follows a
 * press-and-drag instead — past a 4px threshold the card leans with the
 * finger (≤6° per axis) and the glare tracks the touch point. A drag
 * that travelled >10px suppresses the click it would otherwise fire on
 * release (the finger was steering, not tapping); a plain tap still
 * opens the section. Reduced-motion disables both paths.
 */
function useLpCardTilt() {
  const okRef = React.useRef(false);
  const touchOkRef = React.useRef(false);
  const rafRef = React.useRef(0);
  const dragRef = React.useRef<{
    id: number;
    x0: number;
    y0: number;
    moved: boolean;
  } | null>(null);
  React.useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    okRef.current =
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !reduced;
    touchOkRef.current = !reduced;
  }, []);
  const writeTilt = (
    el: HTMLElement,
    rx: number,
    ry: number,
    gx?: number,
    gy?: number,
  ) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      el.style.transform = `perspective(720px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      if (gx != null && gy != null) {
        el.style.setProperty("--gx", `${gx.toFixed(1)}%`);
        el.style.setProperty("--gy", `${gy.toFixed(1)}%`);
      }
    });
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    if (e.pointerType === "mouse") {
      if (!okRef.current) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      writeTilt(el, (0.5 - y) * 10, (x - 0.5) * 10, x * 100, y * 100);
      return;
    }
    // Touch / pen drag tilt (implicit pointer capture keeps the moves
    // flowing to this card for the whole drag).
    const d = dragRef.current;
    if (!touchOkRef.current || !d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (Math.hypot(dx, dy) > 4) d.moved = true;
    if (!d.moved) return;
    const r = el.getBoundingClientRect();
    const gx = r.width > 0 ? ((e.clientX - r.left) / r.width) * 100 : 50;
    const gy = r.height > 0 ? ((e.clientY - r.top) / r.height) * 100 : 50;
    writeTilt(
      el,
      Math.max(-6, Math.min(6, -dy / 10)),
      Math.max(-6, Math.min(6, dx / 10)),
      gx,
      gy,
    );
  };
  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!touchOkRef.current || e.pointerType === "mouse") return;
    dragRef.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false };
  };
  const endDrag = (e: React.PointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.id) return;
    dragRef.current = null;
    cancelAnimationFrame(rafRef.current);
    e.currentTarget.style.transform = "";
    if (d.moved) e.currentTarget.dataset.tiltDragged = "1";
  };
  const onPointerLeave = (e: React.PointerEvent<HTMLElement>) => {
    cancelAnimationFrame(rafRef.current);
    e.currentTarget.style.transform = "";
  };
  /** Swallow the click a real drag ends with; taps pass through. */
  const onClickCapture = (e: React.SyntheticEvent<HTMLElement>) => {
    if (e.currentTarget.dataset.tiltDragged) {
      delete e.currentTarget.dataset.tiltDragged;
      e.preventDefault();
      e.stopPropagation();
    }
  };
  return {
    onPointerMove,
    onPointerLeave,
    onPointerDown,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onClickCapture,
  };
}

export type LandingNode = {
  key: string;
  section: string;
  n: number;
  label: string;
  en: string;
  sub: string;
  /** Custom-module node: clicking opens the module view, not a section. */
  customId?: string;
  /** Beam color override (custom nodes). */
  beam?: string;
  /** Layout slot index for custom nodes (Layout.slots). */
  slot?: number;
};

type Pt = [number, number];
type NodeGeom = { c: Pt; w: number; anchor: Pt; card: Pt; cardW: number; bend: number };
type Layout = {
  w: number;
  h: number;
  core: Pt;
  orb: number;
  nodes: Record<"top" | "left" | "ll" | "right" | "lr", NodeGeom>;
  /** Extra hub positions for custom-module nodes (slot 0 = upper-left,
   *  slot 1 = upper-right, then top band / lower corners). */
  slots: NodeGeom[];
};

/** Desktop = plate geometry (frame 01, 1024x576 → 1600x900).
 *  2026-10-21 top-band re-pack: the top jelly was clipped by the stage
 *  top edge, the finance jelly grazed its card and the upper-left custom
 *  jelly overlapped its own card; top + slots 0–3 were re-laid (each
 *  jelly/card pair re-verified: no overlap, jelly fully on-stage). */
const DESKTOP: Layout = {
  w: 1600,
  h: 900,
  core: [845, 445],
  orb: 719,
  nodes: {
    top: { c: [903, 158], w: 188, anchor: [906, 180], card: [1010, 96], cardW: 150, bend: -0.05 },
    left: { c: [258, 450], w: 188, anchor: [322, 456], card: [205, 520], cardW: 150, bend: 0.04 },
    ll: { c: [425, 559], w: 156, anchor: [470, 548], card: [330, 650], cardW: 150, bend: 0.12 },
    right: { c: [1453, 425], w: 188, anchor: [1404, 430], card: [1390, 505], cardW: 150, bend: -0.03 },
    lr: { c: [1341, 602], w: 156, anchor: [1298, 588], card: [1290, 672], cardW: 150, bend: -0.12 },
  },
  slots: [
    // 0 · upper-left (health's fixed home) — card centred under the jelly
    { c: [400, 190], w: 156, anchor: [436, 214], card: [325, 278], cardW: 150, bend: 0.1 },
    // 1 · upper-right (finance's fixed home) — jelly clears the card by ~52
    { c: [1468, 232], w: 156, anchor: [1428, 244], card: [1188, 205], cardW: 150, bend: -0.1 },
    // 2 · top band, left of the core
    { c: [600, 132], w: 140, anchor: [622, 158], card: [520, 214], cardW: 150, bend: 0.05 },
    // 3 · top band, right of the core
    { c: [1235, 138], w: 140, anchor: [1206, 163], card: [1322, 52], cardW: 150, bend: -0.05 },
    // 4 · lower-left corner
    { c: [168, 692], w: 140, anchor: [205, 679], card: [262, 758], cardW: 150, bend: -0.08 },
    // 5 · lower-right corner
    { c: [1512, 650], w: 140, anchor: [1475, 639], card: [1330, 756], cardW: 150, bend: 0.08 },
  ],
};

/** Mobile portrait: same angles, composition re-packed into 2:3 so nothing stacks.
 *  2026-10-21 re-pack: the old table grazed in production (works/database
 *  jellies overlapped their own cards, health/works cards sat 1 unit
 *  apart, the finance jelly was squeezed between two foreign cards).
 *  Every jelly/card box below was re-laid with ≥13 units of air between
 *  neighbouring boxes (card height ≈148 units at these widths); anchors
 *  are re-aimed at the core by aimAtCore as before. */
const MOBILE: Layout = {
  w: 1000,
  h: 1560,
  core: [500, 860],
  orb: 680,
  nodes: {
    top: { c: [505, 245], w: 200, anchor: [504, 320], card: [668, 178], cardW: 250, bend: -0.04 },
    left: { c: [130, 722], w: 190, anchor: [190, 690], card: [20, 470], cardW: 230, bend: 0.08 },
    right: { c: [862, 793], w: 190, anchor: [812, 680], card: [724, 540], cardW: 250, bend: -0.08 },
    ll: { c: [205, 1225], w: 175, anchor: [245, 1165], card: [36, 1322], cardW: 250, bend: 0.14 },
    lr: { c: [795, 1270], w: 160, anchor: [765, 1180], card: [700, 1361], cardW: 250, bend: -0.14 },
  },
  slots: [
    // 0 · upper-left (health's fixed home)
    { c: [180, 215], w: 160, anchor: [185, 225], card: [16, 305], cardW: 230, bend: 0.08 },
    // 1 · band under the top jelly, jelly right of its card (finance's fixed home)
    { c: [742, 442], w: 110, anchor: [700, 377], card: [432, 368], cardW: 230, bend: -0.06 },
    // 2 · left edge, mid-height
    { c: [122, 905], w: 130, anchor: [118, 905], card: [16, 981], cardW: 230, bend: 0.1 },
    // 3 · right edge, mid-height
    { c: [868, 955], w: 125, anchor: [882, 905], card: [738, 1030], cardW: 230, bend: -0.1 },
    // 4 · below the orb, left
    { c: [398, 1252], w: 120, anchor: [392, 1242], card: [300, 1321], cardW: 200, bend: 0.12 },
    // 5 · below the orb, right
    { c: [605, 1248], w: 120, anchor: [618, 1242], card: [510, 1324], cardW: 185, bend: -0.12 },
  ],
};

/** Mobile beam stubs: anchor = point on the jelly body facing the core (so floats never show a gap). */
const aimAtCore = (L: Layout, n: NodeGeom) => {
  const dx = L.core[0] - n.c[0];
  const dy = L.core[1] - n.c[1];
  const d = Math.hypot(dx, dy) || 1;
  n.anchor = [Math.round(n.c[0] + (dx / d) * n.w * 0.24), Math.round(n.c[1] + (dy / d) * n.w * 0.24)];
};
for (const key of Object.keys(MOBILE.nodes) as (keyof Layout["nodes"])[]) {
  aimAtCore(MOBILE, MOBILE.nodes[key]);
}
for (const slot of MOBILE.slots) {
  aimAtCore(MOBILE, slot);
}

function geomOf(L: Layout, node: LandingNode): NodeGeom {
  if (node.slot != null) return L.slots[node.slot] ?? L.slots[0];
  return L.nodes[node.key as keyof Layout["nodes"]];
}

const BEAM: Partial<Record<string, string>> = {
  top: "#EEF1FF",
  left: "#C8C0FF",
  ll: "#A6E6EC",
  right: "#93E2D2",
  lr: "#EBC27E",
};

function curve(a: Pt, b: Pt, bend: number) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const qx = mx - dy * bend;
  const qy = my + dx * bend;
  return `M ${a[0]} ${a[1]} Q ${qx.toFixed(1)} ${qy.toFixed(1)} ${b[0]} ${b[1]}`;
}

/** Seeded plexus clusters, offsets in orb-size units relative to core. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const PLEXUS = (() => {
  const r = rng(7);
  const pts: { x: number; y: number; c: string; s: number }[] = [];
  const cluster = (cx: number, cy: number, rx: number, ry: number, n: number, c: string) => {
    for (let i = 0; i < n; i++) {
      pts.push({ x: cx + (r() - 0.5) * rx * 2, y: cy + (r() - 0.5) * ry * 2, c, s: 0.6 + r() * 1.2 });
    }
  };
  cluster(-0.4, -0.06, 0.13, 0.13, 22, "#CFC8FF"); // left lavender
  cluster(0.42, -0.1, 0.09, 0.12, 16, "#A8EEDD"); // right teal
  cluster(0.18, 0.27, 0.12, 0.06, 6, "#EBC27E"); // lower-right amber
  for (let i = 0; i < 34; i++) {
    const a = r() * Math.PI * 2;
    const d = 0.36 + r() * 0.2;
    pts.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.9, c: r() > 0.7 ? "#E6CF98" : "#DCE2F0", s: 0.5 + r() });
  }
  const edges: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (pts[i].c !== pts[j].c) continue;
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      if (d < 0.065) edges.push([i, j]);
    }
  }
  return { pts, edges };
})();

function Web({ L, nodes, className }: { L: Layout; nodes: LandingNode[]; className: string }) {
  const k = L.orb;
  return (
    <svg
      className={cn("lp-web pointer-events-none absolute inset-0 h-full w-full", className)}
      viewBox={`0 0 ${L.w} ${L.h}`}
      aria-hidden
    >
      <defs>
        <filter id={`lp-glow-${L.w}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g className="lp-plexus">
        {PLEXUS.edges.map(([a, b], i) => (
          <line
            key={i}
            x1={L.core[0] + PLEXUS.pts[a].x * k}
            y1={L.core[1] + PLEXUS.pts[a].y * k}
            x2={L.core[0] + PLEXUS.pts[b].x * k}
            y2={L.core[1] + PLEXUS.pts[b].y * k}
            stroke={PLEXUS.pts[a].c}
            strokeOpacity={0.28}
            strokeWidth={0.8}
          />
        ))}
        {PLEXUS.pts.map((p, i) => (
          <circle
            key={i}
            className="lp-dot"
            style={{ animationDelay: `${(i % 9) * -0.7}s` }}
            cx={L.core[0] + p.x * k}
            cy={L.core[1] + p.y * k}
            r={p.s * 2.2}
            fill={p.c}
          />
        ))}
      </g>
      <g filter={`url(#lp-glow-${L.w})`}>
        {nodes.map((node, i) => {
          const n = geomOf(L, node);
          if (!n) return null;
          const d = curve(n.anchor, L.core, n.bend);
          return (
            <g key={node.key}>
              <path className="lp-beam" data-beam={node.key} d={d} stroke={node.beam ?? BEAM[node.key] ?? "#DCE2F0"} strokeWidth={2} fill="none" strokeLinecap="round" />
              <circle r={3.2} className="lp-spark">
                <animateMotion dur={`${3.2 + i * 0.45}s`} repeatCount="indefinite" path={d} keyPoints="1;0" keyTimes="0;1" calcMode="linear" />
              </circle>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export function NeuralLanding({
  nodes,
  themeLabel,
  themeEn,
  onCycleTheme,
  onEnter,
  leaving,
  quick = false,
  stats = [],
  customCards = [],
  onOpenCustom,
}: {
  nodes: LandingNode[];
  themeLabel: string;
  themeEn: string;
  onCycleTheme: () => void;
  onEnter: (section?: string) => void;
  leaving: boolean;
  quick?: boolean;
  stats?: { key?: string; value: number; label: string; en: string }[];
  /** User-created modules, shown as node-style glass cards under the orb. */
  customCards?: {
    id: string;
    label: string;
    en: string;
    count: number;
    /** Beam colour — tints the card's Chinese title, like the node cards. */
    beam?: string;
  }[];
  onOpenCustom?: (id: string) => void;
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const cardTilt = useLpCardTilt();
  // Load choreography (≤1.2s: orb → silk → nodes/cards → rolls) plays
  // on every entry; a pointer-down anywhere inside the first moments
  // skips straight to the settled state (CSS forces the entrance
  // animations to their end, RollNumbers remount with no hold).
  const [introSkip, setIntroSkip] = React.useState(false);
  const mountAtRef = React.useRef(0);
  React.useEffect(() => {
    mountAtRef.current = performance.now();
  }, []);
  const skipIntro = () => {
    if (!introSkip && performance.now() - mountAtRef.current < 1600) {
      setIntroSkip(true);
    }
  };
  // Landing stats overrides: label/en copy + optional manual value, kept per
  // stat key in localStorage (studio_landing_stats_v1). A manual value wins
  // over the live value (marked with a dot); clear it to return to automatic.
  type StatOverride = { label?: string; en?: string; manual?: number };
  const STATS_LS_KEY = "studio_landing_stats_v1";
  const [statOverrides, setStatOverrides] = React.useState<
    Record<string, StatOverride>
  >({});
  const [statsEditMode, setStatsEditMode] = React.useState(false);
  const [editingStatKey, setEditingStatKey] = React.useState<string | null>(null);
  const [draftLabel, setDraftLabel] = React.useState("");
  const [draftEn, setDraftEn] = React.useState("");
  const [draftManual, setDraftManual] = React.useState("");
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STATS_LS_KEY);
      if (raw) setStatOverrides(JSON.parse(raw) as Record<string, StatOverride>);
    } catch {
      /* ignore */
    }
  }, []);
  const persistStatOverrides = (next: Record<string, StatOverride>) => {
    setStatOverrides(next);
    try {
      window.localStorage.setItem(STATS_LS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  const statKeyOf = (s: { key?: string; en: string }) => s.key ?? s.en;
  const beginEditStat = (s: {
    key?: string;
    value: number;
    label: string;
    en: string;
  }) => {
    const k = statKeyOf(s);
    const ov = statOverrides[k];
    setEditingStatKey(k);
    setDraftLabel(ov?.label ?? s.label);
    setDraftEn(ov?.en ?? s.en);
    setDraftManual(ov?.manual != null ? String(ov.manual) : "");
  };
  const saveStatEdit = (s: { key?: string; label: string; en: string }) => {
    const k = statKeyOf(s);
    const next = { ...statOverrides };
    const entry: StatOverride = { ...(next[k] ?? {}) };
    const label = draftLabel.trim();
    const en = draftEn.trim();
    if (label && label !== s.label) entry.label = label;
    else delete entry.label;
    if (en && en !== s.en) entry.en = en;
    else delete entry.en;
    const manualRaw = draftManual.trim();
    if (manualRaw === "") delete entry.manual;
    else {
      const n = Number(manualRaw);
      if (Number.isFinite(n)) entry.manual = n;
    }
    if (Object.keys(entry).length === 0) delete next[k];
    else next[k] = entry;
    persistStatOverrides(next);
    setEditingStatKey(null);
  };
  const resetStat = (key: string) => {
    const next = { ...statOverrides };
    delete next[key];
    persistStatOverrides(next);
    setEditingStatKey(null);
  };
  const resetAllStats = () => {
    persistStatOverrides({});
    setEditingStatKey(null);
    setStatsEditMode(false);
  };
  const displayStats = stats.map((s) => {
    const ov = statOverrides[statKeyOf(s)];
    return {
      ...s,
      statKey: statKeyOf(s),
      label: ov?.label ?? s.label,
      en: ov?.en ?? s.en,
      value: ov?.manual ?? s.value,
      isManual: ov?.manual != null,
    };
  });
  // subtle pointer parallax (desktop pointers only; reduced-motion respected)
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;
        el.style.setProperty("--px", x.toFixed(3));
        el.style.setProperty("--py", y.toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);
  // Touch press feedback: iOS Safari does not reliably paint :active on
  // tap, so mirror the batch-1 press with an .lp-pressing class driven
  // by real pointer events — one delegated listener set on the root
  // covers nodes, cards, enter and theme alike. Reduced-motion keeps
  // presses static, the same gate batch 1 uses for its :active rule.
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const clear = () =>
      el
        .querySelectorAll(".lp-pressing")
        .forEach((n) => n.classList.remove("lp-pressing"));
    const down = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      const b = t?.closest?.('button, a, [role="button"]');
      if (b && el.contains(b)) b.classList.add("lp-pressing");
    };
    const up = () => clear();
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    void v.play().catch(() => {});
  }, []);

  const place = (L: Layout, node: LandingNode) => {
    const n = geomOf(L, node);
    return {
      left: `${((n.c[0] - n.w / 2) / L.w) * 100}%`,
      top: `${((n.c[1] - (n.w * 0.92) / 2) / L.h) * 100}%`,
      width: `${(n.w / L.w) * 100}%`,
    };
  };
  const cardPlace = (L: Layout, node: LandingNode) => {
    const n = geomOf(L, node);
    return {
      left: `${(n.card[0] / L.w) * 100}%`,
      top: `${(n.card[1] / L.h) * 100}%`,
      width: `${(n.cardW / L.w) * 100}%`,
    };
  };
  const toVars = (prefix: string, o: Record<string, string>) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [`--${prefix}-${k}`, v]));

  return (
    <div
      ref={rootRef}
      className={cn(
        "lp-root",
        leaving && "lp-leaving",
        quick && "lp-quick",
        introSkip && "lp-intro-skip",
        customCards.length > 0 && "lp-has-custom",
      )}
      data-testid="studio-landing"
      data-quick={quick ? "1" : "0"}
      onPointerDown={skipIntro}
    >
      <div className="lp-stage" data-testid="lp-stage">
        {/* In-stage backdrop: the stage's centring transform makes it a
            stacking context, which would isolate the node buttons'
            screen blend from the root gradient painted outside it.
            This layer re-paints that same gradient inside the stage
            (geometry mapped into stage coordinates, see globals.css)
            so the blend has a real backdrop everywhere in the stage. */}
        <div className="lp-backdrop" aria-hidden />
        <Web L={DESKTOP} nodes={nodes} className="lp-only-d" />
        <Web L={MOBILE} nodes={nodes} className="lp-only-m" />

        <div
          className="lp-orb halo-aura"
          data-testid="lp-orb"
          style={
            {
              "--d-left": `${((DESKTOP.core[0] - DESKTOP.orb / 2) / DESKTOP.w) * 100}%`,
              "--d-top": `${((DESKTOP.core[1] - DESKTOP.orb / 2) / DESKTOP.h) * 100}%`,
              "--d-width": `${(DESKTOP.orb / DESKTOP.w) * 100}%`,
              "--m-left": `${((MOBILE.core[0] - MOBILE.orb / 2) / MOBILE.w) * 100}%`,
              "--m-top": `${((MOBILE.core[1] - MOBILE.orb / 2) / MOBILE.h) * 100}%`,
              "--m-width": `${(MOBILE.orb / MOBILE.w) * 100}%`,
            } as React.CSSProperties
          }
          aria-hidden
        >
          <div className="lp-orb-rays" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lp-orb-plate" src="/studio/landing/orb-plate.webp" alt="" draggable={false} />
          <span className="pl-shimmer" />
          <video
            ref={videoRef}
            className="lp-orb-loop"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
          >
            <source src="/studio/neural-orb.webm" type="video/webm" />
            <source src="/studio/neural-orb.mp4" type="video/mp4" />
          </video>
        </div>

        {nodes.map((node, i) => {
          const openNode = () =>
            node.customId && onOpenCustom
              ? onOpenCustom(node.customId)
              : onEnter(node.section);
          return (
          <React.Fragment key={node.key}>
            <button
              type="button"
              className="lp-node"
              data-node={node.key}
              data-section={node.section}
              data-custom={node.customId}
              style={
                {
                  ...toVars("d", place(DESKTOP, node)),
                  ...toVars("m", place(MOBILE, node)),
                  ...jellyMotion(node.customId ?? node.key),
                  "--jelly-glow": node.beam ?? BEAM[node.key] ?? "#DCE2F0",
                  animationDelay: `${0.42 + Math.min(i, 8) * 0.045}s`,
                } as React.CSSProperties
              }
              onClick={openNode}
              aria-label={`进入${node.label}`}
            >
              <JellyMedia />
            </button>
            <button
              type="button"
              className="lp-card"
              data-card={node.key}
              data-custom={node.customId}
              style={
                {
                  ...toVars("d", cardPlace(DESKTOP, node)),
                  ...toVars("m", cardPlace(MOBILE, node)),
                  animationDelay: `${0.5 + Math.min(i, 8) * 0.04}s`,
                } as React.CSSProperties
              }
              onClick={openNode}
              onPointerMove={cardTilt.onPointerMove}
              onPointerLeave={cardTilt.onPointerLeave}
              onPointerDown={cardTilt.onPointerDown}
              onPointerUp={cardTilt.onPointerUp}
              onPointerCancel={cardTilt.onPointerCancel}
              onClickCapture={cardTilt.onClickCapture}
            >
              <span className="lp-card-glare" aria-hidden />
              <span className="lp-card-row">
                <span className="lp-card-ico" aria-hidden />
                <span className="lp-card-n">
                  <RollNumber key={introSkip ? "done" : "play"} value={node.n} delay={introSkip ? 0 : 430 + Math.min(i, 5) * 35} />
                </span>
              </span>
              {/* Module distinction lives in the type now: the Chinese
                  title wears the node's beam colour (the <em> English and
                  the number/sub keep their neutral tones via CSS). */}
              <span
                className="lp-card-zh"
                style={{ color: node.beam ?? BEAM[node.key] ?? "#DCE2F0" }}
              >
                {node.label}
                <em>{node.en}</em>
              </span>
              <span className="lp-card-sub">{node.sub}</span>
            </button>
          </React.Fragment>
          );
        })}
      </div>

      <div className="lp-brand" aria-label="TANG NEURAL">
        <span>TANG</span>
        <span>NEURAL</span>
      </div>

      {customCards.length > 0 && (
        <div
          className="lp-custom-cards"
          data-testid="lp-custom-cards"
          aria-label="自定义模块"
        >
          {customCards.map((p) => (
            <button
              key={p.id}
              type="button"
              className="lp-card lp-custom-card"
              data-custom-card={p.id}
              onClick={() => onOpenCustom?.(p.id)}
              onPointerMove={cardTilt.onPointerMove}
              onPointerLeave={cardTilt.onPointerLeave}
              onPointerDown={cardTilt.onPointerDown}
              onPointerUp={cardTilt.onPointerUp}
              onPointerCancel={cardTilt.onPointerCancel}
              onClickCapture={cardTilt.onClickCapture}
            >
              <span className="lp-card-glare" aria-hidden />
              <span className="lp-card-row">
                <span className="lp-card-ico" aria-hidden />
                <span className="lp-card-n">
                  <RollNumber key={introSkip ? "done" : "play"} value={p.count} delay={introSkip ? 0 : 430} />
                </span>
              </span>
              <span
                className="lp-card-zh"
                style={p.beam ? { color: p.beam } : undefined}
              >
                {p.label}
                <em>{p.en}</em>
              </span>
              <span className="lp-card-sub">自定义模块</span>
            </button>
          ))}
        </div>
      )}

      {stats.length > 0 && (
        <div
          className={cn("lp-stats", statsEditMode && "lp-stats-editing")}
          data-testid="lp-stats"
          aria-label="概览"
        >
          <button
            type="button"
            className="lp-stats-edit-btn"
            data-testid="lp-stats-edit-toggle"
            aria-label={statsEditMode ? "完成编辑" : "编辑概览数字"}
            title={statsEditMode ? "完成" : "编辑标签与数字"}
            onClick={() => {
              setStatsEditMode((v) => !v);
              setEditingStatKey(null);
            }}
          >
            <Pencil className="h-3 w-3" />
          </button>
          {displayStats.map((m) => {
            const original =
              stats.find((s) => statKeyOf(s) === m.statKey) ?? m;
            const editing = statsEditMode && editingStatKey === m.statKey;
            return (
              <span
                key={m.statKey}
                data-stat={m.statKey}
                onClick={() => {
                  if (statsEditMode && !editing) beginEditStat(original);
                }}
              >
                {editing ? (
                  <form
                    className="lp-stat-editor"
                    data-testid="lp-stat-editor"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveStatEdit(original);
                    }}
                    onBlur={(e) => {
                      if (
                        !e.currentTarget.contains(
                          e.relatedTarget as Node | null,
                        )
                      )
                        saveStatEdit(original);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      data-testid="lp-stat-label-input"
                      value={draftLabel}
                      onChange={(e) => setDraftLabel(e.target.value)}
                      placeholder="中文标签"
                      autoFocus
                    />
                    <input
                      data-testid="lp-stat-en-input"
                      value={draftEn}
                      onChange={(e) => setDraftEn(e.target.value)}
                      placeholder="EN"
                    />
                    <input
                      data-testid="lp-stat-manual-input"
                      value={draftManual}
                      onChange={(e) => setDraftManual(e.target.value)}
                      placeholder="手动值（空 = 自动）"
                      inputMode="numeric"
                    />
                    <span className="lp-stat-editor-actions">
                      <button type="submit" data-testid="lp-stat-save">
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={() => resetStat(m.statKey)}
                      >
                        <RotateCcw className="mr-0.5 inline h-3 w-3" />
                        本项默认
                      </button>
                    </span>
                  </form>
                ) : (
                  <>
                    <small>
                      {m.label} <em>{m.en}</em>
                    </small>
                    <b>
                      <RollNumber key={introSkip ? "done" : "play"} value={m.value} delay={introSkip ? 0 : 650} />
                      {m.isManual && (
                        <i
                          className="lp-manual-dot"
                          title="手动值 · 清空手动值即回到自动"
                        />
                      )}
                    </b>
                  </>
                )}
              </span>
            );
          })}
          {statsEditMode && (
            <button
              type="button"
              className="lp-stats-restore-all"
              data-testid="lp-stats-restore-all"
              onClick={resetAllStats}
            >
              恢复全部默认
            </button>
          )}
        </div>
      )}

      <button type="button" className="lp-enter halo-rim" data-testid="lp-enter" onClick={() => onEnter("workspace")}>
        进入工作台
        <span>ENTER</span>
      </button>

      <div className="lp-theme">
        <span className="lp-theme-tag">主题动效</span>
        <button type="button" className="lp-theme-pill" onClick={onCycleTheme} data-testid="lp-theme">
          <span className="lp-theme-dot" aria-hidden />
          <span className="lp-theme-text">
            <b>{themeLabel}</b>
            <small>{themeEn}</small>
          </span>
        </button>
      </div>
    </div>
  );
}
