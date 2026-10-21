"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { jellyMotion } from "./module-jelly";
import { JellyMedia } from "./jelly-media";
import { NeuralOrb } from "./neural-orb";
import { RollNumber } from "@/components/ui/roll-number";

export type WsHub = {
  /** Built-in hub key ("top"|"left"|"ll"|"right"|"lr") or `custom:<id>`. */
  key: string;
  section: string;
  n: number;
  label: string;
  en: string;
  sub: string;
  rows: { id: string; title: string; a: string; b: string; c?: string }[];
  /** Set for user-created modules: section is the module id, not a section. */
  customId?: string;
  /** Beam colour for custom-module hubs, from the shared assignment. */
  beam?: string;
};

/** Editable workspace header copy (brand suffix / headline / EN line).
 *  Owned + persisted by the studio page (localStorage studio_head_copy_v1);
 *  the stats line under it stays data-derived and is NOT part of this. */
export type WsHeadCopy = { brand: string; headline: string; en: string };

/** Design space matches plate frames ~6.5s / 7.5s (1024x576 → 1600x820 content area). */
const W = 1600;
const H = 820;

/* ── Framework restored (2026-10-21, user ruling): the module map is
 * the landing scene made functional again — NOT an admin two-column
 * layout. Three constituents, same as the landing:
 *   1. CORE — the living orb (NeuralOrb: video loop + breathing bloom)
 *      sits at the visual centre as the anchor; it is also the single
 *      return affordance (tap: fan → panorama; panorama → landing).
 *   2. ORBIT — the 9 modules ring the core as jelly nodes with their
 *      count cards, same slot language as the landing nodes.
 *   3. SILK — the spider silk is the global skeleton: orb→node beams
 *      in the panorama; on selection the ring contracts to a C opening
 *      east and the selected node's rows fan out along silk threads to
 *      solid cards on the right (one source point, one sweep, threads
 *      behind the cards, beads landing on card left edges).
 * Congestion is treated INSIDE the framework (no overlaps, solid row
 * cards, one return affordance) — the two-column detour is gone. */
const PANO_ANGLES_9 = [-90, -52, -14, 24, 62, 96, 140, 178, 216];
const panoAngle = (i: number, n: number) =>
  n === PANO_ANGLES_9.length ? PANO_ANGLES_9[i] : -90 + (306 * i) / Math.max(1, n - 1);
const focusAngle = (i: number, n: number) => 40 + (280 * i) / Math.max(1, n - 1);
const rad = (deg: number) => (deg * Math.PI) / 180;

const BEAM: Record<string, string> = {
  top: "#EEF1FF",
  left: "#C8C0FF",
  ll: "#A6E6EC",
  right: "#93E2D2",
  lr: "#EBC27E",
};
/** Beam colour for user-created module hubs (no plate original). */
const CUSTOM_BEAM = "#C9D4E8";
const beamOf = (h: WsHub) => h.beam ?? BEAM[h.key] ?? CUSTOM_BEAM;

/** Hub jellyfish visual: every hub — built-in or custom — plays the one
 *  shared A animation loop with the A frame as poster (JellyMedia's
 *  defaults). The glass orb with the module's initial is only the
 *  fallback if the poster itself fails to load. */
function WsJellyVisual() {
  const [failed, setFailed] = React.useState(false);
  if (failed) {
    return (
      <span className="ws-jelly-orb" aria-hidden>
        <i>·</i>
      </span>
    );
  }
  return <JellyMedia onStillError={() => setFailed(true)} />;
}

/** Row geometry for n cards in a rowsH viewport: equal gaps, short
 *  lists centred in the viewport, long lists top-aligned and scrolled.
 *  13 rows (the densest hub) fit with no scroll at either head state. */
function rowLayout(n: number, rowsH: number) {
  const cardH = n >= 12 ? 30 : 38;
  if (n <= 0) return { rows: [] as { y: number }[], cardH, content: 0 };
  let gap = n > 1 ? (rowsH - n * cardH) / (n - 1) : 0;
  gap = Math.max(6, Math.min(n <= 6 ? 18 : 14, gap));
  const content = n * cardH + (n - 1) * gap;
  const y0 = content < rowsH ? (rowsH - content) / 2 : 0;
  const rows = Array.from({ length: n }, (_, i) => ({ y: y0 + i * (cardH + gap) }));
  return { rows, cardH, content: Math.max(content, y0 + content) };
}

export function NeuralWorkspace({
  hubs,
  headCopy,
  editMode,
  onHeadCopyChange,
  themeId,
  compact,
  themeLabel,
  themeEn,
  onCycleTheme,
  onOpenSection,
  onPickRow,
  onReturnLanding,
  onSelectHub,
  moduleCount,
  stepCount,
}: {
  hubs: WsHub[];
  headCopy?: WsHeadCopy;
  editMode?: boolean;
  onHeadCopyChange?: (patch: Partial<WsHeadCopy>) => void;
  /** Orb skin follows the site theme (same NeuralOrb as the landing). */
  themeId?: "silver" | "warm" | "neu";
  /** Page chrome collapsed: the plate head hides and the map takes the
   *  full height (panel + ring re-flow to the taller geometry). */
  compact?: boolean;
  themeLabel: string;
  themeEn: string;
  onCycleTheme: () => void;
  onOpenSection: (section: string) => void;
  onPickRow: (row: { id: string; title: string }, hub: WsHub) => void;
  onReturnLanding: () => void;
  onSelectHub?: (key: string) => void;
  /** 数据驱动的模块总数（含用户自建模块） */
  moduleCount?: number;
  /** 数据驱动的流水线步数 */
  stepCount?: number;
}) {
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = React.useState(0.85);
  const [designW, setDesignW] = React.useState(W);
  /** null = panorama (no selection): the map opens on the full orbit. */
  const [sel, setSel] = React.useState<string | null>(null);
  const [replay, setReplay] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [hot, setHot] = React.useState<number | null>(null);

  const selHub = sel ? hubs.find((h) => h.key === sel) ?? null : null;
  const focused = !!selHub;
  // A selected hub can disappear (custom module deleted) — fall back to
  // the panorama instead of pointing at a ghost.
  React.useEffect(() => {
    if (sel && hubs.length && !hubs.some((h) => h.key === sel)) setSel(null);
  }, [hubs, sel]);

  React.useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      // Height-driven fit; the design width then follows the container
      // so the fan panel's right edge lands on the container's right
      // edge (no dead column on wide windows).
      let s = r.height / H;
      let dw = r.width / s;
      if (dw < 1180) {
        dw = 1180;
        s = r.width / dw;
      }
      setScale(Math.max(0.3, s));
      setDesignW(dw);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
    setScrollTop(0);
    setHot(null);
  }, [sel, replay]);

  /* ── Scene geometry (design px, H = 820) ── */
  const n = hubs.length;
  // Panorama: orb centre-left of middle, ring radii follow the width.
  const panoC = {
    x: Math.round(designW / 2 - 40 + (designW < 1350 ? 60 : 0)),
    y: 460,
  };
  const panoRx = Math.max(280, designW / 2 - 300);
  const panoRy = 246;
  const panoOrbSize = Math.round(Math.min(470, Math.max(360, designW * 0.29)));
  // Focused: orb anchors the west, ring contracts to a C opening east.
  const focusC = { x: 452, y: 470 };
  const focusRx = Math.min(350, Math.max(245, designW * 0.225));
  const focusRy = 300;
  const focusOrbSize = 356;
  const orbC = focused ? focusC : panoC;
  const orbSize = focused ? focusOrbSize : panoOrbSize;
  const jellyPano = n > 10 ? 124 : 142;
  const jellyFocus = 100;
  const jellySel = 116;

  const nodePos = (i: number, mode: "pano" | "focus") => {
    if (mode === "pano") {
      const a = rad(panoAngle(i, n));
      return { x: panoC.x + panoRx * Math.cos(a), y: panoC.y + panoRy * Math.sin(a) };
    }
    const a = rad(focusAngle(i, n));
    return { x: focusC.x + focusRx * Math.cos(a), y: focusC.y + focusRy * Math.sin(a) };
  };
  const jellyOf = (h: WsHub) => (focused ? (h.key === sel ? jellySel : jellyFocus) : jellyPano);
  /** Count-card placement in the panorama: radially outward from the
   *  node; top/bottom nodes (|sin| > .55) place theirs horizontally so
   *  cards never ride over the orb or the ring's vertical extremes. */
  const cardPos = (i: number) => {
    const p = nodePos(i, "pano");
    const dx = (p.x - panoC.x) / panoRx;
    const dy = (p.y - panoC.y) / panoRy;
    let ux: number, uy: number, off: number;
    if (Math.abs(dy) > 0.55) {
      // Near-vertical nodes (top/bottom of the ring): the top node's
      // card goes west, the bottom node's east — the other side rides
      // the ring tangent into the next node's jelly box either way.
      ux = Math.abs(dx) < 0.35 ? (dy < 0 ? -1 : 1) : Math.sign(dx) || 1;
      uy = 0;
      off = jellyPano / 2 + 85;
    } else {
      const l = Math.hypot(dx, dy) || 1;
      ux = dx / l;
      uy = dy / l;
      off = jellyPano / 2 + 98;
    }
    let cy = p.y + uy * off;
    if (dy > 0.9) cy += 24;
    if (dy < -0.9) cy += 16;
    return { left: p.x + ux * off - 75, top: cy - 33 };
  };

  /* ── Fan panel geometry (focused only) ── */
  const PANEL_X = Math.round(designW * 0.57);
  const PANEL_TOP = compact ? 44 : 168;
  const ROWS_TOP = PANEL_TOP + 48;
  // Bottom safe pad for the rows viewport: the floating theme switcher
  // (.ws-theme, absolute in the wrap) occupies the bottom-right corner —
  // a ~87 screen-px footprint — while the panel's right edge runs to
  // the wrap's right edge. Reserve 100 screen px, converted to design
  // px at the current plate scale (kept from the two-column fix).
  const ROWS_SAFE_BOTTOM = Math.max(36, Math.ceil(100 / scale));
  const ROWS_H = H - ROWS_TOP - ROWS_SAFE_BOTTOM;
  const PANEL_W = designW - PANEL_X - 40;

  const rows = selHub?.rows ?? [];
  const selIdx = Math.max(0, hubs.findIndex((h) => h.key === selHub?.key));
  const lay = rowLayout(focused ? rows.length : 0, ROWS_H);
  const scrollable = lay.content > ROWS_H + 1;
  const totalItems = hubs.reduce((s, h) => s + h.rows.length, 0);
  // Header stats derive from data: module/step counts update automatically.
  const moduleN = moduleCount ?? hubs.length + 1;
  const stepN = stepCount ?? hubs.find((h) => h.key === "top")?.n ?? 8;
  // Spider-silk source: the selected node's east edge — threads leave
  // the node itself (through the orb's field) and fan to the cards.
  const selPos = focused ? nodePos(selIdx, "focus") : { x: 0, y: 0 };
  const silkSrc: [number, number] = [selPos.x + jellySel / 2 - 2, selPos.y];
  const silkDstX = PANEL_X - 10;
  const rafRef = React.useRef(0);
  const onScroll = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setScrollTop(listRef.current?.scrollTop ?? 0));
  };

  const pickHub = (h: WsHub) => {
    if (h.key === sel) onOpenSection(h.section);
    else {
      setSel(h.key);
      onSelectHub?.(h.key);
    }
  };
  const orbClick = () => {
    if (focused) setSel(null);
    else onReturnLanding();
  };

  return (
    <div
      ref={wrapRef}
      className={cn("ws-wrap", paused && "ws-paused")}
      data-testid="ws-desktop"
      data-selected={sel ?? "none"}
      data-mode={focused ? "focused" : "panorama"}
      data-rows={focused ? rows.length : 0}
      data-scrollable={scrollable ? "1" : "0"}
    >
      <div
        className="ws-plate"
        style={{ width: designW, height: H, transform: `scale(${scale})` }}
        key={replay}
      >
        {/* In-plate backdrop: the plate's transform makes it a stacking
            context, so the nodes' screen blend would otherwise melt
            against transparency (the landing's black-square lesson).
            Repaint the scene wash inside, in plate coordinates. */}
        <div className="ws-backdrop" aria-hidden />

        {/* Silk skeleton: orb→node beams always; the row fan when a hub
            is selected. The svg sits below every card, so threads pass
            behind cards and only their end beads touch card edges. */}
        <svg className="ws-svg" viewBox={`0 0 ${designW} ${H}`} width={designW} height={H} aria-hidden>
          <g key={`beams-${replay}`} className="ws-beams">
            {hubs.map((h, i) => {
              const p = nodePos(i, focused ? "focus" : "pano");
              const j = jellyOf(h);
              const dx = p.x - orbC.x;
              const dy = p.y - orbC.y;
              const dist = Math.hypot(dx, dy) || 1;
              const ax = p.x - (dx / dist) * j * 0.32;
              const ay = p.y - (dy / dist) * j * 0.32;
              const bend = ((i % 2) * 2 - 1) * Math.min(22, dist * 0.06);
              const mx = (orbC.x + ax) / 2 + (-dy / dist) * bend;
              const my = (orbC.y + ay) / 2 + (dx / dist) * bend;
              const on = h.key === sel;
              return (
                <path
                  key={h.key}
                  className="ws-beam"
                  d={`M ${orbC.x} ${orbC.y} Q ${mx} ${my} ${ax} ${ay}`}
                  fill="none"
                  stroke={beamOf(h)}
                  strokeWidth={on ? 1.4 : 1}
                  opacity={focused ? (on ? 0.95 : 0.34) : 0.62}
                  style={{ animationDelay: `${0.1 + i * 0.05}s` }}
                />
              );
            })}
          </g>
          {focused && (
            <g key={`fan-${sel}-${replay}`} className="ws-fan">
              {lay.rows.map((r, i) => {
                const ty = ROWS_TOP + r.y - scrollTop + lay.cardH / 2;
                if (ty < ROWS_TOP - 24 || ty > ROWS_TOP + ROWS_H + 24) return null;
                const d = `M ${silkSrc[0]} ${silkSrc[1]} C ${silkSrc[0] + 64} ${silkSrc[1]}, ${silkDstX - 84} ${ty}, ${silkDstX} ${ty}`;
                const mx = (silkSrc[0] + silkDstX) / 2;
                const my = (silkSrc[1] + ty) / 2;
                return (
                  <g key={i} className={cn(hot === i && "ws-fan-hot")}>
                    <path className="ws-fan-line" d={d} style={{ animationDelay: `${Math.min(i, 14) * 0.035}s` }} />
                    <circle cx={mx} cy={my} r={1.4} className="ws-bead" />
                    <circle cx={silkDstX} cy={ty} r={2.2} className="ws-fan-dot" />
                  </g>
                );
              })}
            </g>
          )}
        </svg>

        {!compact && (
        <div className={cn("ws-head", editMode && "ws-head-edit")} data-testid="ws-head">
          {editMode && headCopy && onHeadCopyChange ? (
            <>
              <p className="ws-kicker">
                TANG · NEURAL STUDIO
                <input
                  className="ws-head-input ws-head-input-brand"
                  aria-label="品牌行后缀"
                  data-testid="ws-head-brand"
                  value={headCopy.brand}
                  onChange={(e) => onHeadCopyChange({ brand: e.target.value })}
                />
              </p>
              <input
                className="ws-head-input ws-head-input-h2"
                aria-label="工作台主标题"
                data-testid="ws-head-headline"
                value={headCopy.headline}
                onChange={(e) => onHeadCopyChange({ headline: e.target.value })}
              />
              <input
                className="ws-head-input ws-head-input-en"
                aria-label="工作台英文副标题"
                data-testid="ws-head-en"
                value={headCopy.en}
                onChange={(e) => onHeadCopyChange({ en: e.target.value })}
              />
            </>
          ) : (
            <>
              <p className="ws-kicker">
                TANG · NEURAL STUDIO <span>{headCopy?.brand}</span>
              </p>
              <h2>{headCopy?.headline}</h2>
              <p className="ws-head-en">{headCopy?.en}</p>
            </>
          )}
          <p className="ws-stats">
            <b><RollNumber value={moduleN} /></b> 个模块 <small>modules</small>
            <i>·</i>
            <b><RollNumber value={totalItems} /></b> 条条目 <small>items</small>
            <i>·</i>
            <b><RollNumber value={stepN} /></b> 步流程 <small>steps</small>
            <i>·</i>
            <b><RollNumber value={hubs.find((h) => h.key === "ll")?.n ?? 0} /></b> Skill
          </p>
        </div>
        )}

        {/* The core: the landing's living orb at anchor size — never a
            thumbnail. It carries the ONLY return affordance: in the fan
            it collapses back to the panorama; in the panorama it
            returns to the landing subject. No caption, no second icon. */}
        <button
          type="button"
          className="ws-orb-core ws-orb-main"
          style={{
            left: orbC.x - orbSize / 2,
            top: orbC.y - orbSize / 2,
            width: orbSize,
            height: orbSize,
          }}
          data-testid="ws-orb-back"
          onClick={orbClick}
          aria-label={focused ? "收起条目 · 回到环绕主体" : "返回神经主体 · 登录页"}
          title={focused ? "回到环绕主体" : "返回主体"}
        >
          <NeuralOrb theme={themeId ?? "silver"} />
        </button>

        {/* Orbiting module nodes + their count cards. The jelly button
            keeps the .ws-hubrow hook (media/press contracts); the card
            is the landing's node card in the same slot language. */}
        {hubs.map((h, i) => {
          const p = nodePos(i, focused ? "focus" : "pano");
          const j = jellyOf(h);
          const card = cardPos(i);
          const on = h.key === sel;
          return (
            <React.Fragment key={h.key}>
              <div
                className={cn("ws-nodewrap", on && "ws-nodewrap-on")}
                style={{
                  left: p.x - j / 2,
                  top: p.y - j * 0.46,
                  width: j,
                  height: j * 0.92,
                  // NO z-index here: a positioned wrapper with z-index
                  // becomes a stacking context and traps the jelly's
                  // screen blend inside it (black-square tiles — the
                  // landing nodes blend because they sit directly in
                  // the stage's context). Paint order comes from DOM.
                  "--hub-beam": beamOf(h),
                } as React.CSSProperties}
              >
                <button
                  type="button"
                  className={cn("ws-node ws-hubrow", on && "ws-node-on")}
                  style={{
                    ...jellyMotion(h.customId ?? h.key),
                    "--jelly-glow": beamOf(h),
                    animationDelay: `${0.15 + i * 0.06}s`,
                  } as React.CSSProperties}
                  data-hub={h.section}
                  data-card={h.key}
                  data-node={h.key}
                  onClick={() => pickHub(h)}
                  aria-label={on ? `打开${h.label}` : `选中${h.label}`}
                >
                  <span className="ws-nodejelly" aria-hidden>
                    <WsJellyVisual />
                  </span>
                </button>
                {focused && (
                  <span className="ws-nodebadge" aria-hidden>
                    <RollNumber value={h.n} />
                  </span>
                )}
              </div>
              <button
                type="button"
                className="ws-nodecard"
                style={{ left: card.left, top: card.top, animationDelay: `${0.55 + i * 0.06}s` }}
                data-nodecard={h.key}
                onClick={() => pickHub(h)}
                tabIndex={focused ? -1 : 0}
                aria-hidden={focused}
                aria-label={`选中${h.label}`}
              >
                <span className="ws-nodecard-top">
                  <span className="ws-card-ico">{h.label.slice(0, 1)}</span>
                  <b>
                    <RollNumber value={h.n} />
                  </b>
                </span>
                <span className="ws-nodecard-zh" style={{ color: beamOf(h) }}>
                  {h.label} <em>{h.en}</em>
                </span>
                <span className="ws-nodecard-sub">{h.sub}</span>
              </button>
              {focused && on && (
                <button
                  type="button"
                  className="ws-nodelabel"
                  style={{
                    left: p.x,
                    // Bottom-arc nodes flip the label above the jelly —
                    // below would clip at the plate's bottom edge.
                    top: p.y + j * 0.46 + 10 > H - 44 ? p.y - j * 0.46 - 40 : p.y + j * 0.46 + 10,
                  }}
                  onClick={() => onOpenSection(h.section)}
                >
                  <b style={{ color: beamOf(h) }}>{h.label}</b>
                  <span>共 {rows.length} 条 · 进入分区 →</span>
                </button>
              )}
            </React.Fragment>
          );
        })}

        {/* Fan panel: the selected hub's rows as solid cards, fed by
            the silk fan. Same rows contract as before (成片槽 + 全站
            待办票, 待办行带 chip). */}
        {focused && selHub && (
          <div className="ws-panel" style={{ left: PANEL_X, top: PANEL_TOP, width: PANEL_W }}>
            <div className="ws-panel-head">
              <b>{selHub.label}</b>
              <span className="ws-panel-count">{rows.length} 条 · {selHub.en}</span>
              <span className="ws-panel-sub">{selHub.sub}</span>
              <button
                type="button"
                className="ws-panel-open"
                onClick={() => onOpenSection(selHub.section)}
              >
                进入分区 →
              </button>
            </div>
            <div
              ref={listRef}
              className={cn("ws-list", scrollable && "ws-list-scroll")}
              style={{ left: 0, top: 36, width: PANEL_W, height: ROWS_H, marginTop: 12 }}
              onScroll={onScroll}
              data-testid="ws-list"
              key={`list-${sel}-${replay}`}
            >
              <ul className="ws-rows ws-rows-d" style={{ height: lay.content }}>
                {rows.map((r, i) => (
                  <li
                    key={r.id}
                    style={{ left: 0, top: lay.rows[i].y, width: "100%", height: lay.cardH, animationDelay: `${0.15 + Math.min(i, 14) * 0.055}s` }}
                    onMouseEnter={() => setHot(i)}
                    onMouseLeave={() => setHot((v) => (v === i ? null : v))}
                  >
                    <button
                      type="button"
                      className={cn("ws-rowcard", hot === i && "ws-rowcard-hot")}
                      onClick={() => onPickRow(r, selHub)}
                      data-row={r.id}
                      data-section={selHub.section}
                    >
                      <span className="ws-row-t">{r.title}</span>
                      <span className="ws-row-m">
                        <i>{r.a}</i>
                        <i>{r.b}</i>
                        {r.c ? <i className="ws-row-chip">{r.c}</i> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {rows.length === 0 && (
                <div className="ws-empty" data-testid="ws-empty">
                  <b>{selHub.label}还没有条目</b>
                  <span>点右上角「新建任务」，目标选「{selHub.label}」就能加第一条。</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="ws-tools">
          <span className="ws-crumb">
            创作空间 <small>Core</small> / 工作台 / <b>{focused ? selHub?.label : "全部模块"}</b>
            {focused && <small className="ws-crumb-n"> · {rows.length} 条</small>}
          </span>
          <span className="ws-actions">
            <button type="button" onClick={() => setReplay((v) => v + 1)}>重播 <small>Replay</small></button>
            <button type="button" onClick={() => setPaused((v) => !v)}>{paused ? "继续" : "暂停"} <small>{paused ? "Play" : "Pause"}</small></button>
            <button type="button" onClick={() => onOpenSection("database")}>数据来源 <small>Source</small></button>
          </span>
        </div>
      </div>

      {!focused && (
        <div className="ws-hint">点选一个模块节点 · 全部条目将沿蜘蛛丝向右扇出 · Select a hub to fan out its items</div>
      )}
      {focused && lay.content < ROWS_H - 40 && (
        <div className="ws-hint">点光球回到环绕主体 · 再点节点进入分区 · Tap the core to return to the orbit</div>
      )}
      <div className="lp-brand ws-brand" aria-hidden>
        <span>TANG</span>
        <span>NEURAL</span>
      </div>
      <div className="lp-theme ws-theme">
        <span className="lp-theme-tag">主题动效</span>
        <button type="button" className="lp-theme-pill" onClick={onCycleTheme}>
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

/* ───────────── Mobile portrait: orb subject on top, never compressed ─────────────
 * The living core returns to the top as the subject (and the single
 * return affordance — the old "← 主体" chip is gone). Below it the
 * module nodes form a horizontal swipe strip; the selected hub's cards
 * stack in one column under a slim silk trunk with a short stub + bead
 * to each card's left edge — the desktop fan's language, kept regular. */
const MW = 400;
const M_ORB_SIZE = 168;
const M_ORB_TOP = 14;
const M_STRIP_TOP = M_ORB_TOP + M_ORB_SIZE + 14;
const M_STRIP_H = 48;
const M_HEAD_Y = M_STRIP_TOP + M_STRIP_H + 14;
const M_ROWS_TOP = M_HEAD_Y + 40;
const M_CARD_H = 54;
const M_GAP = 8;
const M_GUTTER_X = 16;
const M_CARD_X = 44;
const M_CARD_W = MW - M_CARD_X - 14;

export function NeuralWorkspaceMobile({
  hubs,
  themeId,
  onOpenSection,
  onPickRow,
  onReturnLanding,
  onSelectHub,
}: {
  hubs: WsHub[];
  /** Orb skin follows the site theme (same NeuralOrb as the landing). */
  themeId?: "silver" | "warm" | "neu";
  onOpenSection: (section: string) => void;
  onPickRow: (row: { id: string; title: string }, hub: WsHub) => void;
  onReturnLanding: () => void;
  onSelectHub?: (key: string) => void;
}) {
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = React.useState(0.9);
  const [sel, setSel] = React.useState<string>("top");
  const setSelNotify = (k: string) => {
    setSel(k);
    onSelectHub?.(k);
  };
  React.useEffect(() => {
    onSelectHub?.(sel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => {
    if (hubs.length && !hubs.some((h) => h.key === sel)) setSel(hubs[0].key);
  }, [hubs, sel]);

  React.useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => setScale(Math.max(0.6, el.getBoundingClientRect().width / MW));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const selHub = hubs.find((h) => h.key === sel) ?? hubs[0];
  const allRows = selHub?.rows ?? [];
  const shown = allRows.slice(0, 9);
  const extra = allRows.length - shown.length;
  const n = Math.max(1, shown.length + (extra > 0 ? 1 : 0));
  const H = M_ROWS_TOP + n * M_CARD_H + (n - 1) * M_GAP + 18;
  const rowY = (i: number) => M_ROWS_TOP + i * (M_CARD_H + M_GAP);
  const lastCy = rowY(n - 1) + M_CARD_H / 2;
  const tap = (h: WsHub) => (h.key === sel ? onOpenSection(h.section) : setSelNotify(h.key));

  return (
    <div ref={wrapRef} className="wsm-wrap" data-testid="ws-mobile" data-selected={sel} style={{ height: H * scale }}>
      <div className="wsm-plate" style={{ width: MW, height: H, transform: `scale(${scale})` }}>
        <svg className="ws-svg" viewBox={`0 0 ${MW} ${H}`} width={MW} height={H} aria-hidden>
          <g key={sel} className="wsm-fan">
            <path
              className="ws-fan-line"
              d={`M ${M_GUTTER_X} ${M_ROWS_TOP - 8} L ${M_GUTTER_X} ${lastCy}`}
            />
            {Array.from({ length: n }, (_, i) => {
              const cy = rowY(i) + M_CARD_H / 2;
              const d = `M ${M_GUTTER_X} ${cy} C ${M_GUTTER_X + 10} ${cy}, ${M_CARD_X - 12} ${cy}, ${M_CARD_X - 4} ${cy}`;
              return (
                <g key={i}>
                  <path className="ws-fan-line" d={d} style={{ animationDelay: `${0.1 + i * 0.05}s` }} data-fan={i} />
                  <circle cx={M_CARD_X - 4} cy={cy} r={2} className="ws-fan-dot" />
                </g>
              );
            })}
          </g>
        </svg>

        {/* The core as subject: living orb on top, and the map's only
            return affordance (tap → landing subject). */}
        <button
          type="button"
          className="wsm-orb"
          style={{ top: M_ORB_TOP, width: M_ORB_SIZE, height: M_ORB_SIZE }}
          data-testid="ws-orb-back"
          onClick={onReturnLanding}
          aria-label="返回神经主体 · 登录页"
          title="返回主体"
        >
          <NeuralOrb theme={themeId ?? "silver"} />
        </button>

        {/* Hub selector strip: swipe horizontally, one tap selects. */}
        <div className="wsm-strip" style={{ top: M_STRIP_TOP, height: M_STRIP_H }}>
          {hubs.map((h) => {
            const on = h.key === sel;
            return (
              <button
                key={h.key}
                type="button"
                className={cn("wsm-hubchip", on && "wsm-hubchip-on")}
                style={{ "--hub-beam": beamOf(h) } as React.CSSProperties}
                data-chip={h.key}
                data-hub={h.section}
                onClick={() => tap(h)}
                aria-label={on ? `打开${h.label}` : `选中${h.label}`}
              >
                <span className="wsm-hubchip-jelly" aria-hidden>
                  <WsJellyVisual />
                </span>
                <span className="wsm-hubchip-label">{h.label}</span>
                <b className="wsm-hubchip-n"><RollNumber value={h.n} /></b>
              </button>
            );
          })}
        </div>

        <div className="wsm-panel-head" style={{ top: M_HEAD_Y }}>
          <b>{selHub?.label}</b>
          <span>{allRows.length} 条</span>
          <button
            type="button"
            className="ws-panel-open"
            data-card={selHub?.key}
            onClick={() => selHub && onOpenSection(selHub.section)}
          >
            进入分区 →
          </button>
        </div>

        <ul className="ws-rows" key={`m-${sel}`}>
          {shown.map((r, i) => (
            <li key={r.id} style={{ left: M_CARD_X, top: rowY(i), width: M_CARD_W, height: M_CARD_H, animationDelay: `${0.15 + i * 0.055}s` }}>
              <button
                type="button"
                className="ws-rowcard wsm-rowcard"
                onClick={() => selHub && onPickRow(r, selHub)}
                data-row={r.id}
                data-section={selHub?.section}
              >
                <span className="ws-row-t wsm-row-t">{r.title}</span>
                <span className="ws-row-m">
                  <i>{r.a}</i>
                  <i>{r.b}</i>
                  {r.c ? <i className="ws-row-chip">{r.c}</i> : null}
                </span>
              </button>
            </li>
          ))}
          {extra > 0 && (
            <li style={{ left: M_CARD_X, top: rowY(shown.length), width: M_CARD_W, height: M_CARD_H }}>
              <button type="button" className="ws-rowcard wsm-rowcard" onClick={() => selHub && onOpenSection(selHub.section)}>
                <span className="ws-row-t ws-row-more">+{extra} 更多 · 进入{selHub?.label}</span>
              </button>
            </li>
          )}
          {allRows.length === 0 && (
            <li style={{ left: M_CARD_X, top: rowY(0), width: M_CARD_W, height: M_CARD_H }} data-testid="wsm-empty">
              <span className="wsm-empty-t">
                {selHub?.label}还没有条目 · 在「新建任务」里给它加第一条
              </span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
