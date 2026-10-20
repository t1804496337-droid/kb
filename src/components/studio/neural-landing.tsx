"use client";

import * as React from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export type LandingNode = {
  key: "top" | "left" | "ll" | "right" | "lr";
  section: string;
  n: number;
  label: string;
  en: string;
  sub: string;
};

type Pt = [number, number];
type Layout = {
  w: number;
  h: number;
  core: Pt;
  orb: number;
  nodes: Record<
    LandingNode["key"],
    { c: Pt; w: number; anchor: Pt; card: Pt; cardW: number; bend: number }
  >;
};

/** Desktop = plate geometry (frame 01, 1024x576 → 1600x900). */
const DESKTOP: Layout = {
  w: 1600,
  h: 900,
  core: [845, 445],
  orb: 719,
  nodes: {
    top: { c: [903, 138], w: 188, anchor: [906, 160], card: [1010, 96], cardW: 150, bend: -0.05 },
    left: { c: [258, 450], w: 188, anchor: [322, 456], card: [205, 520], cardW: 150, bend: 0.04 },
    ll: { c: [425, 559], w: 156, anchor: [470, 548], card: [330, 650], cardW: 150, bend: 0.12 },
    right: { c: [1453, 425], w: 188, anchor: [1404, 430], card: [1390, 505], cardW: 150, bend: -0.03 },
    lr: { c: [1341, 602], w: 156, anchor: [1298, 588], card: [1290, 672], cardW: 150, bend: -0.12 },
  },
};

/** Mobile portrait: same angles, composition re-packed into 2:3 so nothing stacks. */
const MOBILE: Layout = {
  w: 1000,
  h: 1560,
  core: [500, 860],
  orb: 680,
  nodes: {
    top: { c: [500, 255], w: 210, anchor: [504, 320], card: [650, 185], cardW: 250, bend: -0.04 },
    left: { c: [125, 665], w: 200, anchor: [190, 690], card: [20, 445], cardW: 230, bend: 0.08 },
    right: { c: [875, 645], w: 210, anchor: [812, 680], card: [750, 425], cardW: 230, bend: -0.08 },
    ll: { c: [200, 1205], w: 180, anchor: [245, 1165], card: [40, 1300], cardW: 250, bend: 0.14 },
    lr: { c: [810, 1220], w: 180, anchor: [765, 1180], card: [715, 1315], cardW: 250, bend: -0.14 },
  },
};

/** Mobile beam stubs: anchor = point on the jelly body facing the core (so floats never show a gap). */
for (const key of Object.keys(MOBILE.nodes) as LandingNode["key"][]) {
  const n = MOBILE.nodes[key];
  const dx = MOBILE.core[0] - n.c[0];
  const dy = MOBILE.core[1] - n.c[1];
  const d = Math.hypot(dx, dy) || 1;
  n.anchor = [Math.round(n.c[0] + (dx / d) * n.w * 0.24), Math.round(n.c[1] + (dy / d) * n.w * 0.24)];
}

const BEAM: Record<LandingNode["key"], string> = {
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

function Web({ L, className }: { L: Layout; className: string }) {
  const keys = Object.keys(L.nodes) as LandingNode["key"][];
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
        {keys.map((key) => {
          const n = L.nodes[key];
          const d = curve(n.anchor, L.core, n.bend);
          return (
            <g key={key}>
              <path className="lp-beam" data-beam={key} d={d} stroke={BEAM[key]} strokeWidth={2} fill="none" strokeLinecap="round" />
              <circle r={3.2} className="lp-spark">
                <animateMotion dur={`${3.2 + keys.indexOf(key) * 0.45}s`} repeatCount="indefinite" path={d} keyPoints="1;0" keyTimes="0;1" calcMode="linear" />
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
  customCards?: { id: string; label: string; en: string; count: number }[];
  onOpenCustom?: (id: string) => void;
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);
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
  const videoRef = React.useRef<HTMLVideoElement>(null);
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    void v.play().catch(() => {});
  }, []);

  const place = (L: Layout, key: LandingNode["key"]) => {
    const n = L.nodes[key];
    return {
      left: `${((n.c[0] - n.w / 2) / L.w) * 100}%`,
      top: `${((n.c[1] - (n.w * 0.92) / 2) / L.h) * 100}%`,
      width: `${(n.w / L.w) * 100}%`,
    };
  };
  const cardPlace = (L: Layout, key: LandingNode["key"]) => {
    const n = L.nodes[key];
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
        customCards.length > 0 && "lp-has-custom",
      )}
      data-testid="studio-landing"
      data-quick={quick ? "1" : "0"}
    >
      <div className="lp-stage" data-testid="lp-stage">
        <Web L={DESKTOP} className="lp-only-d" />
        <Web L={MOBILE} className="lp-only-m" />

        <div
          className="lp-orb"
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

        {nodes.map((node, i) => (
          <React.Fragment key={node.key}>
            <button
              type="button"
              className="lp-node"
              data-node={node.key}
              data-section={node.section}
              style={
                {
                  ...toVars("d", place(DESKTOP, node.key)),
                  ...toVars("m", place(MOBILE, node.key)),
                  animationDelay: `${0.55 + i * 0.12}s`,
                } as React.CSSProperties
              }
              onClick={() => onEnter(node.section)}
              aria-label={`进入${node.label}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/studio/landing/jelly-${node.key}.webp`}
                alt=""
                draggable={false}
                style={{ animationDelay: `${i * -1.3}s` }}
              />
            </button>
            <button
              type="button"
              className="lp-card"
              data-card={node.key}
              style={
                {
                  ...toVars("d", cardPlace(DESKTOP, node.key)),
                  ...toVars("m", cardPlace(MOBILE, node.key)),
                  animationDelay: `${1.25 + i * 0.1}s`,
                } as React.CSSProperties
              }
              onClick={() => onEnter(node.section)}
            >
              <span className="lp-card-row">
                <span className="lp-card-ico" aria-hidden />
                <span className="lp-card-n">{node.n}</span>
              </span>
              <span className="lp-card-zh">
                {node.label}
                <em>{node.en}</em>
              </span>
              <span className="lp-card-sub">{node.sub}</span>
            </button>
          </React.Fragment>
        ))}
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
            >
              <span className="lp-card-row">
                <span className="lp-card-ico" aria-hidden />
                <span className="lp-card-n">{p.count}</span>
              </span>
              <span className="lp-card-zh">
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
                      {m.value}
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

      <button type="button" className="lp-enter" data-testid="lp-enter" onClick={() => onEnter("workspace")}>
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
