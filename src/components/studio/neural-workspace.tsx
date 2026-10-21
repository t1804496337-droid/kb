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

/* Two-column module map (2026-10-21 rebuild): the duplicated landing
 * hub-graph on the left is gone. Left = one clean hub column (300 wide,
 * one row per module, never compressed — it scrolls instead), crowned
 * by the living core orb (the landing's NeuralOrb: video loop +
 * breathing bloom, doubling as the single "return" affordance).
 * Right = the selected hub's rows as solid cards in one aligned
 * column, with the spider silk kept as the hero: one source point on
 * the selected hub row's right edge, one thread per card, all threads
 * sharing the same sweep, passing BEHIND the cards and ending in a
 * bead on each card's left edge — silk connects cards, never crosses
 * text. The plate is height-fitted and its design width follows the
 * container, so the panel always runs to the right edge (no dead
 * column on wide windows). */
const COL_X = 40;
const COL_W = 300;
const HUB_H = 56;
const HUB_GAP = 8;
const PANEL_X = 452;
const ORB_SIZE = 88;

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
  defaultHub = "ll",
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
   *  full height (hub column + rows re-flow to the taller geometry). */
  compact?: boolean;
  themeLabel: string;
  themeEn: string;
  onCycleTheme: () => void;
  onOpenSection: (section: string) => void;
  onPickRow: (row: { id: string; title: string }, hub: WsHub) => void;
  onReturnLanding: () => void;
  onSelectHub?: (key: string) => void;
  defaultHub?: string;
  /** 数据驱动的模块总数（含用户自建模块） */
  moduleCount?: number;
  /** 数据驱动的流水线步数 */
  stepCount?: number;
}) {
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = React.useState(0.85);
  const [designW, setDesignW] = React.useState(W);
  const [sel, setSel] = React.useState<string>(defaultHub);
  const setSelNotify = (k: string) => {
    setSel(k);
    onSelectHub?.(k);
  };
  React.useEffect(() => {
    onSelectHub?.(sel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A selected hub can disappear (custom module deleted) — fall back safely.
  React.useEffect(() => {
    if (hubs.length && !hubs.some((h) => h.key === sel)) setSel(hubs[0].key);
  }, [hubs, sel]);
  const [replay, setReplay] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [hot, setHot] = React.useState<number | null>(null);

  React.useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      // Height-driven fit; the design width then follows the container
      // so the panel's right edge lands on the container's right edge.
      let s = r.height / H;
      let dw = r.width / s;
      if (dw < 1180) {
        // Tall-narrow window: fall back to a minimum design width and
        // fit by width instead of clipping the panel.
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

  // Vertical geometry follows the head state: with the page chrome
  // collapsed (compact) the orb + columns start near the top and the
  // rows viewport grows by the head's height.
  const ORB_TOP = compact ? 36 : 158;
  const COL_TOP = ORB_TOP + ORB_SIZE + 12;
  const PANEL_HEAD_Y = COL_TOP;
  const ROWS_TOP = COL_TOP + 48;
  const ROWS_H = H - ROWS_TOP - 36;
  const PANEL_W = designW - PANEL_X - 40;

  const selHub = hubs.find((h) => h.key === sel) ?? hubs[0];
  const rows = selHub?.rows ?? [];
  const selIdx = Math.max(0, hubs.findIndex((h) => h.key === selHub?.key));
  const lay = rowLayout(rows.length, ROWS_H);
  const scrollable = lay.content > ROWS_H + 1;
  const totalItems = hubs.reduce((s, h) => s + h.rows.length, 0);
  // Header stats derive from data: module/step counts update automatically.
  const moduleN = moduleCount ?? hubs.length + 1;
  const stepN = stepCount ?? hubs.find((h) => h.key === "top")?.n ?? 8;
  // Spider-silk source: the selected hub row's right edge.
  const silkSrc: [number, number] = [COL_X + COL_W, COL_TOP + selIdx * (HUB_H + HUB_GAP) + HUB_H / 2];
  const silkDstX = PANEL_X - 10;
  const rafRef = React.useRef(0);
  const onScroll = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setScrollTop(listRef.current?.scrollTop ?? 0));
  };

  return (
    <div
      ref={wrapRef}
      className={cn("ws-wrap", paused && "ws-paused")}
      data-testid="ws-desktop"
      data-selected={sel}
      data-rows={rows.length}
      data-scrollable={scrollable ? "1" : "0"}
    >
      <div
        className="ws-plate"
        style={{ width: designW, height: H, transform: `scale(${scale})` }}
        key={replay}
      >
        {/* Spider silk: one thread per row card, drawn from the selected
            hub row. The svg sits below the HTML columns, so threads pass
            behind the cards and only their ends (bead at each card's
            left edge) touch the cards. */}
        <svg className="ws-svg" viewBox={`0 0 ${designW} ${H}`} width={designW} height={H} aria-hidden>
          <g key={`${sel}-${replay}`} className="ws-fan">
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

        {/* The living core orb: same NeuralOrb as the landing (video
            loop + breathing bloom), and the map's ONE return affordance
            — caption sits under it, no centre label, no second button. */}
        <button
          type="button"
          className="ws-orb-core"
          style={{ left: COL_X + 8, top: ORB_TOP, width: ORB_SIZE, height: ORB_SIZE }}
          data-testid="ws-orb-back"
          onClick={onReturnLanding}
          aria-label="返回神经主体 · 登录页"
          title="返回主体"
        >
          <NeuralOrb theme={themeId ?? "silver"} />
          <span className="ws-orb-core-cap">返回主体</span>
        </button>

        {/* Hub column: one row per module, fixed height, never compressed. */}
        <div
          className="ws-hubcol"
          style={{ left: COL_X, top: COL_TOP, width: COL_W, maxHeight: H - COL_TOP - 36 }}
        >
          {hubs.map((h, i) => {
            const on = h.key === sel;
            return (
              <button
                key={h.key}
                type="button"
                className={cn("ws-hubrow", on && "ws-hubrow-on")}
                style={{ "--hub-beam": beamOf(h), animationDelay: `${0.05 + i * 0.04}s` } as React.CSSProperties}
                data-hub={h.section}
                data-card={h.key}
                onClick={() => (on ? onOpenSection(h.section) : setSelNotify(h.key))}
                aria-label={on ? `打开${h.label}` : `选中${h.label}`}
              >
                <span className="ws-hubrow-jelly" style={jellyMotion(h.customId ?? h.key)} aria-hidden>
                  <WsJellyVisual />
                </span>
                <span className="ws-hubrow-names">
                  <b style={{ color: beamOf(h) }}>{h.label}</b>
                  <em>{h.en}</em>
                </span>
                <span className="ws-hubrow-n"><RollNumber value={h.n} /></span>
              </button>
            );
          })}
        </div>

        {/* Content panel: header + the selected hub's row cards. */}
        <div className="ws-panel" style={{ left: PANEL_X, top: PANEL_HEAD_Y, width: PANEL_W }}>
          <div className="ws-panel-head">
            <b>{selHub?.label}</b>
            <span className="ws-panel-count">{rows.length} 条 · {selHub?.en}</span>
            <span className="ws-panel-sub">{selHub?.sub}</span>
            <button
              type="button"
              className="ws-panel-open"
              onClick={() => selHub && onOpenSection(selHub.section)}
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
                    onClick={() => selHub && onPickRow(r, selHub)}
                    data-row={r.id}
                    data-section={selHub?.section}
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
            {rows.length === 0 && selHub && (
              <div className="ws-empty" data-testid="ws-empty">
                <b>{selHub.label}还没有条目</b>
                <span>点右上角「新建任务」，目标选「{selHub.label}」就能加第一条。</span>
              </div>
            )}
          </div>
        </div>

        <div className="ws-tools">
          <span className="ws-crumb">
            创作空间 <small>Core</small> / 工作台 / <b>{selHub?.label}</b>
            <small className="ws-crumb-n"> · {rows.length} 条</small>
          </span>
          <span className="ws-actions">
            <button type="button" onClick={() => setReplay((v) => v + 1)}>重播 <small>Replay</small></button>
            <button type="button" onClick={() => setPaused((v) => !v)}>{paused ? "继续" : "暂停"} <small>{paused ? "Play" : "Pause"}</small></button>
            <button type="button" onClick={() => onOpenSection("database")}>数据来源 <small>Source</small></button>
          </span>
        </div>
      </div>

      {lay.content < ROWS_H - 40 && (
        <div className="ws-hint">选择一个节点查看全部条目 · Select a hub to see its items</div>
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

/* ───────────── Mobile portrait: stacked, never compressed ─────────────
 * Hubs become a horizontal swipe strip on top; below it the selected
 * hub's cards in a single column. The silk survives as a slim trunk in
 * the left gutter with a short stub + bead to each card's left edge —
 * same language as the desktop fan, geometry kept regular. */
const MW = 400;
const M_STRIP_TOP = 12;
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
  onOpenSection,
  onPickRow,
  onReturnLanding,
  onSelectHub,
}: {
  hubs: WsHub[];
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

        {/* Hub selector strip: swipe horizontally, one tap selects. */}
        <div className="wsm-strip" style={{ top: M_STRIP_TOP, height: M_STRIP_H }}>
          <button
            type="button"
            className="wsm-hubchip wsm-backchip"
            data-testid="ws-orb-back"
            onClick={onReturnLanding}
            aria-label="返回神经主体 · 登录页"
          >
            ← 主体
          </button>
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
