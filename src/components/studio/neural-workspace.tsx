"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type WsHub = {
  key: "top" | "left" | "ll" | "right" | "lr";
  section: string;
  n: number;
  label: string;
  en: string;
  sub: string;
  rows: { id: string; title: string; a: string; b: string; c?: string }[];
};

/** Design space matches plate frames ~6.5s / 7.5s (1024x576 → 1600x820 content area). */
const W = 1600;
const H = 820;
const ORB = { x: 150, y: 420, size: 270 };
const SLOT_Y = [200, 310, 420, 530, 640];
const JELLY_X = 300;
const CARD_X = JELLY_X + 88;
/** Dense fan list viewport (plate f750: ~20 rows packed on a soft arc, scrolls inside). */
const LIST_X = 700;
const LIST_TOP = 60;
const LIST_H = 716;
const ROW_GAP_MIN = 38;
const ROW_GAP_MAX = 58;

const BEAM: Record<WsHub["key"], string> = {
  top: "#EEF1FF",
  left: "#C8C0FF",
  ll: "#A6E6EC",
  right: "#93E2D2",
  lr: "#EBC27E",
};

function rowLayout(n: number, cardY: number) {
  const gap = n <= 1 ? ROW_GAP_MAX : Math.max(ROW_GAP_MIN, Math.min(ROW_GAP_MAX, (LIST_H - 40) / (n - 1)));
  const total = (n - 1) * gap;
  // short lists sit centred on the card like the plate; long lists start at the top and scroll
  const y0 = total + 40 >= LIST_H ? 20 : Math.max(20, Math.min(cardY - LIST_TOP - total / 2, LIST_H - 20 - total));
  const rows = Array.from({ length: n }, (_, i) => {
    const y = y0 + i * gap; // local y inside list viewport (unscrolled)
    const t = Math.min(1, y / LIST_H);
    return { x: 930 - Math.pow(t, 1.5) * 110, y };
  });
  return { rows, gap, content: y0 + total + 40 };
}

export function NeuralWorkspace({
  hubs,
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
  themeLabel: string;
  themeEn: string;
  onCycleTheme: () => void;
  onOpenSection: (section: string) => void;
  onPickRow: (row: { id: string; title: string }, hub: WsHub) => void;
  onReturnLanding: () => void;
  onSelectHub?: (key: WsHub["key"]) => void;
  defaultHub?: WsHub["key"];
  /** 数据驱动的模块总数（含用户自建模块） */
  moduleCount?: number;
  /** 数据驱动的流水线步数 */
  stepCount?: number;
}) {
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = React.useState(0.85);
  const [sel, setSel] = React.useState<WsHub["key"]>(defaultHub);
  const setSelNotify = (k: WsHub["key"]) => {
    setSel(k);
    onSelectHub?.(k);
  };
  React.useEffect(() => {
    onSelectHub?.(sel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [replay, setReplay] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [hot, setHot] = React.useState<number | null>(null);

  React.useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      setScale(Math.max(0.4, Math.min(r.width / W, r.height / H)));
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

  const order = React.useMemo(() => {
    const others = hubs.filter((h) => h.key !== sel);
    const s = hubs.find((h) => h.key === sel)!;
    return [others[0], others[1], s, others[2], others[3]].filter(Boolean) as WsHub[];
  }, [hubs, sel]);

  const selHub = hubs.find((h) => h.key === sel)!;
  const rows = selHub.rows;
  const cardY = SLOT_Y[2];
  const cardRight: [number, number] = [CARD_X + 200, cardY];
  const lay = rowLayout(rows.length, cardY);
  const scrollable = lay.content > LIST_H;
  const totalItems = hubs.reduce((s, h) => s + h.rows.length, 0);
  // Header copy derives from data: module/step counts update automatically.
  const moduleN = moduleCount ?? hubs.length + 1;
  const stepN = stepCount ?? hubs.find((h) => h.key === "top")?.n ?? 8;
  const moduleWord =
    ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"][moduleN] ?? String(moduleN);
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
        style={{ width: W, height: H, transform: `scale(${scale})` }}
        key={replay}
      >
        <svg className="ws-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden>
          <defs>
            <filter id="ws-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <clipPath id="ws-list-clip">
              <rect x={cardRight[0]} y={LIST_TOP} width={W - cardRight[0]} height={LIST_H} />
            </clipPath>
          </defs>
          <g filter="url(#ws-glow)">
            {order.map((h, i) => {
              const y = SLOT_Y[i];
              const d = `M ${ORB.x + 30} ${ORB.y} C ${ORB.x + 90} ${ORB.y}, ${JELLY_X - 90} ${y}, ${JELLY_X - 30} ${y}`;
              const on = h.key === sel;
              return (
                <g key={h.key}>
                  <path
                    className={cn("ws-beam", on && "ws-beam-on")}
                    d={d}
                    stroke={on ? "#F2D49A" : BEAM[h.key]}
                    strokeOpacity={on ? 0.95 : 0.5}
                    strokeWidth={on ? 2.4 : 1.4}
                    fill="none"
                  />
                  <circle r={2.6} className="ws-spark" opacity={0.85}>
                    <animateMotion dur={`${2.6 + i * 0.35}s`} repeatCount="indefinite" path={d} />
                  </circle>
                </g>
              );
            })}
          </g>
          <g key={`${sel}-${replay}`} className="ws-fan" clipPath="url(#ws-list-clip)">
            {lay.rows.map((r, i) => {
              const py = LIST_TOP + r.y - scrollTop;
              if (py < LIST_TOP - 30 || py > LIST_TOP + LIST_H + 30) return null;
              const px = r.x;
              const d = `M ${cardRight[0]} ${cardRight[1]} C ${cardRight[0] + 150} ${cardRight[1]}, ${px - 220} ${py + 30}, ${px - 6} ${py}`;
              const bead = (t: number) => {
                const x0 = cardRight[0], y0 = cardRight[1];
                return {
                  x: (1 - t) ** 3 * x0 + 3 * (1 - t) ** 2 * t * (x0 + 150) + 3 * (1 - t) * t ** 2 * (px - 220) + t ** 3 * px,
                  y: (1 - t) ** 3 * y0 + 3 * (1 - t) ** 2 * t * y0 + 3 * (1 - t) * t ** 2 * (py + 30) + t ** 3 * py,
                };
              };
              return (
                <g key={i} className={cn(hot === i && "ws-fan-hot")}>
                  <path className="ws-fan-line" d={d} style={{ animationDelay: `${Math.min(i, 14) * 0.035}s` }} />
                  {i % 2 === 0 &&
                    [0.38, 0.66].map((t) => {
                      const b = bead(t);
                      return <circle key={t} cx={b.x} cy={b.y} r={1.5} className="ws-bead" />;
                    })}
                </g>
              );
            })}
          </g>
        </svg>

        <button
          type="button"
          className="ws-orb ws-orb-btn"
          style={{ left: ORB.x - ORB.size / 2, top: ORB.y - ORB.size / 2, width: ORB.size, height: ORB.size }}
          data-testid="ws-orb-back"
          aria-label="返回神经主体 · 登录页"
          title="返回主体"
          onClick={onReturnLanding}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/studio/landing/orb-plate.webp" alt="" draggable={false} />
          <span className="pl-shimmer" />
          <span className="ws-orb-hint">返回主体</span>
        </button>

        <div className="ws-head" data-testid="ws-head">
          <p className="ws-kicker">
            TANG · NEURAL STUDIO <span>网文拉新工作台</span>
          </p>
          <h2>{moduleN} 大模块，一条拉新流水线。</h2>
          <p className="ws-head-en">{moduleWord} module{moduleN === 1 ? "" : "s"}, one growth pipeline.</p>
          <p className="ws-stats">
            <b>{moduleN}</b> 个模块 <small>modules</small>
            <i>·</i>
            <b>{totalItems}</b> 条条目 <small>items</small>
            <i>·</i>
            <b>{stepN}</b> 步流程 <small>steps</small>
            <i>·</i>
            <b>{hubs.find((h) => h.key === "ll")?.n ?? 0}</b> Skill
          </p>
        </div>

        {order.map((h, i) => {
          const y = SLOT_Y[i];
          const on = h.key === sel;
          const js = on ? 118 : 86;
          return (
            <React.Fragment key={h.key}>
              <button
                type="button"
                className={cn("ws-jelly", on && "ws-jelly-on")}
                style={{ left: JELLY_X - js / 2 + 10, top: y - js * 0.46, width: js }}
                data-hub={h.section}
                data-key={h.key}
                aria-label={`选中${h.label}`}
                onClick={() => (on ? onOpenSection(h.section) : setSelNotify(h.key))}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/studio/landing/jelly-${h.key}.webp`} alt="" draggable={false} style={{ animationDelay: `${i * -1.4}s` }} />
              </button>
              <button
                type="button"
                className={cn("ws-card", on && "ws-card-on")}
                style={{ left: CARD_X, top: y - (on ? 46 : 38), width: on ? 200 : 168 }}
                data-hub={h.section}
                data-card={h.key}
                onClick={() => (on ? onOpenSection(h.section) : setSelNotify(h.key))}
                aria-label={on ? `打开${h.label}` : `选中${h.label}`}
              >
                <span className="ws-card-top">
                  <span className="ws-card-ico" aria-hidden />
                  <b>{h.n}</b>
                </span>
                <span className="ws-card-zh">
                  {h.label}
                  <em>{h.en}</em>
                </span>
                <span className="ws-card-sub">{on ? "再点一次进入分区 →" : h.sub}</span>
              </button>
            </React.Fragment>
          );
        })}

        <div
          ref={listRef}
          className={cn("ws-list", scrollable && "ws-list-scroll")}
          style={{ left: LIST_X, top: LIST_TOP, width: W - LIST_X - 20, height: LIST_H }}
          onScroll={onScroll}
          data-testid="ws-list"
          key={`list-${sel}-${replay}`}
        >
          <ul className="ws-rows ws-rows-d" style={{ height: lay.content }}>
            {rows.map((r, i) => (
              <li
                key={r.id}
                style={{ left: lay.rows[i].x - LIST_X + 12, top: lay.rows[i].y - 11, animationDelay: `${0.2 + Math.min(i, 14) * 0.035}s` }}
                onMouseEnter={() => setHot(i)}
                onMouseLeave={() => setHot((v) => (v === i ? null : v))}
              >
                <span className="ws-row-dot" aria-hidden />
                <button type="button" onClick={() => onPickRow(r, selHub)} data-row={r.id} data-section={selHub.section}>
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
        </div>

        <div className="ws-tools">
          <span className="ws-crumb">
            创作空间 <small>Core</small> / 工作台 / <b>{selHub.label}</b>
            <small className="ws-crumb-n"> · {rows.length} 条</small>
          </span>
          <span className="ws-actions">
            <button type="button" onClick={() => setReplay((v) => v + 1)}>重播 <small>Replay</small></button>
            <button type="button" onClick={() => setPaused((v) => !v)}>{paused ? "继续" : "暂停"} <small>{paused ? "Play" : "Pause"}</small></button>
            <button type="button" onClick={() => onOpenSection("database")}>数据来源 <small>Source</small></button>
          </span>
        </div>
      </div>

      <div className="ws-hint">选择一个节点查看全部条目 · Select a hub to see its items</div>
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

/* ───────────── Mobile portrait adaptation (batch6 → batch7 compressed) ───────────── */
const MW = 400;
const M_ORB = { x: 200, y: 80, size: 150 };
const M_SLOTS: { x: number; y: number }[] = [
  { x: 44, y: 122 },
  { x: 122, y: 166 },
  { x: 200, y: 200 },
  { x: 278, y: 166 },
  { x: 356, y: 122 },
];
const M_CARD_TOP = 252;
const M_CARD_H = 64;
const M_ROW0 = M_CARD_TOP + M_CARD_H + 44;
const M_ROW_GAP = 50;
/** Fan lines live in a left gutter (x ≤ M_GUTTER) — row text starts at M_TEXT_X. */
const M_DOT_X = 30;
const M_TEXT_X = M_DOT_X + 14;
const M_GUTTER = 24;

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
  onSelectHub?: (key: WsHub["key"]) => void;
}) {
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = React.useState(0.9);
  const [sel, setSel] = React.useState<WsHub["key"]>("top");
  const setSelNotify = (k: WsHub["key"]) => {
    setSel(k);
    onSelectHub?.(k);
  };
  React.useEffect(() => {
    onSelectHub?.(sel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => setScale(Math.max(0.6, el.getBoundingClientRect().width / MW));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const order = React.useMemo(() => {
    const others = hubs.filter((h) => h.key !== sel);
    const s = hubs.find((h) => h.key === sel)!;
    return [others[0], others[1], s, others[2], others[3]].filter(Boolean) as WsHub[];
  }, [hubs, sel]);
  const selHub = hubs.find((h) => h.key === sel)!;
  const rows = selHub.rows.slice(0, 9);
  const extra = selHub.rows.length - rows.length;
  const n = rows.length + (extra > 0 ? 1 : 0);
  const H = M_ROW0 + (n - 1) * M_ROW_GAP + 40;
  const cardBottom = M_CARD_TOP + M_CARD_H;
  const J: [number, number] = [M_GUTTER - 4, cardBottom + 18];
  const dots = Array.from({ length: n }, (_, i) => ({ x: M_DOT_X, y: M_ROW0 + i * M_ROW_GAP }));
  const tap = (h: WsHub) => (h.key === sel ? onOpenSection(h.section) : setSelNotify(h.key));
  const orbR = M_ORB.size / 2;

  return (
    <div ref={wrapRef} className="wsm-wrap" data-testid="ws-mobile" data-selected={sel} style={{ height: H * scale }}>
      <div className="wsm-plate" style={{ width: MW, height: H, transform: `scale(${scale})` }}>
        <svg className="ws-svg" viewBox={`0 0 ${MW} ${H}`} width={MW} height={H} aria-hidden>
          <defs>
            <filter id="wsm-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.8" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g filter="url(#wsm-glow)">
            {order.map((h, i) => {
              const s = M_SLOTS[i];
              const ang = Math.atan2(s.y - M_ORB.y, s.x - M_ORB.x);
              const sx = M_ORB.x + Math.cos(ang) * orbR * 0.55;
              const sy = M_ORB.y + Math.sin(ang) * orbR * 0.55;
              const d = `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${(sx + Math.cos(ang) * 50).toFixed(1)} ${(sy + Math.sin(ang) * 50).toFixed(1)}, ${s.x} ${s.y - 50}, ${s.x} ${s.y - 20}`;
              const on = h.key === sel;
              return (
                <g key={h.key}>
                  <path className={cn("ws-beam", on && "ws-beam-on")} d={d} fill="none" stroke={on ? "#F2D49A" : BEAM[h.key]} strokeOpacity={on ? 0.95 : 0.5} strokeWidth={on ? 2 : 1.2} />
                  <circle r={2} className="ws-spark" opacity={0.85}>
                    <animateMotion dur={`${2.4 + i * 0.3}s`} repeatCount="indefinite" path={d} />
                  </circle>
                </g>
              );
            })}
            <path
              className="ws-beam ws-beam-on"
              d={`M 200 ${M_SLOTS[2].y + 30} L 200 ${M_CARD_TOP}`}
              stroke="#F2D49A"
              strokeOpacity={0.8}
              strokeWidth={1.4}
              fill="none"
            />
          </g>
          <g key={sel} className="wsm-fan">
            {/* trunk: card bottom-left → gutter junction */}
            <path className="ws-fan-line" d={`M 86 ${cardBottom} C 60 ${cardBottom + 4}, ${J[0] + 6} ${J[1] - 14}, ${J[0]} ${J[1]}`} />
            {dots.map((p, i) => {
              const d = `M ${J[0]} ${J[1]} C ${J[0] - 10} ${J[1] + 22}, ${J[0] - 10} ${p.y - 20}, ${p.x - 4} ${p.y}`;
              return (
                <g key={i}>
                  <path className="ws-fan-line" d={d} style={{ animationDelay: `${0.1 + i * 0.05}s` }} data-fan={i} />
                  <circle cx={p.x} cy={p.y} r={3} className="ws-fan-dot" />
                </g>
              );
            })}
          </g>
        </svg>

        <button
          type="button"
          className="ws-orb ws-orb-btn"
          style={{ left: M_ORB.x - M_ORB.size / 2, top: M_ORB.y - M_ORB.size / 2, width: M_ORB.size, height: M_ORB.size }}
          data-testid="ws-orb-back"
          aria-label="返回神经主体 · 登录页"
          title="返回主体"
          onClick={onReturnLanding}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/studio/landing/orb-plate.webp" alt="" draggable={false} />
          <span className="pl-shimmer" />
          <span className="ws-orb-hint">返回主体</span>
        </button>

        {order.map((h, i) => {
          const s = M_SLOTS[i];
          const on = h.key === sel;
          const js = on ? 64 : 54;
          return (
            <React.Fragment key={h.key}>
              <button
                type="button"
                className={cn("ws-jelly wsm-jelly", on && "ws-jelly-on")}
                style={{ left: s.x - js / 2, top: s.y - js * 0.46, width: js }}
                data-hub={h.section}
                data-key={h.key}
                aria-label={on ? `打开${h.label}` : `选中${h.label}`}
                onClick={() => tap(h)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/studio/landing/jelly-${h.key}.webp`} alt="" draggable={false} style={{ animationDelay: `${i * -1.4}s` }} />
              </button>
              {!on && (
                <button
                  type="button"
                  className="wsm-chip"
                  style={{ left: s.x - 36, top: s.y + 28 }}
                  data-chip={h.key}
                  onClick={() => tap(h)}
                  aria-label={`选中${h.label}`}
                >
                  <b>{h.n}</b>
                  <span>{h.label}</span>
                </button>
              )}
            </React.Fragment>
          );
        })}

        <button
          type="button"
          className="ws-card ws-card-on wsm-card"
          style={{ left: 70, top: M_CARD_TOP, width: 260, height: M_CARD_H }}
          data-card={selHub.key}
          data-hub={selHub.section}
          onClick={() => onOpenSection(selHub.section)}
          aria-label={`打开${selHub.label}`}
        >
          <span className="ws-card-top">
            <span className="ws-card-ico" aria-hidden />
            <b>{selHub.n}</b>
            <span className="ws-card-zh">
              {selHub.label}
              <em>{selHub.en}</em>
            </span>
          </span>
          <span className="ws-card-sub">{selHub.sub} · 再点进入分区 →</span>
        </button>

        <ul className="ws-rows" key={`m-${sel}`}>
          {rows.map((r, i) => (
            <li key={r.id} style={{ left: M_TEXT_X, top: dots[i].y - 25, animationDelay: `${0.2 + i * 0.04}s` }}>
              <button type="button" onClick={() => onPickRow(r, selHub)} data-row={r.id} data-section={selHub.section}>
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
            <li style={{ left: M_TEXT_X, top: dots[rows.length].y - 25 }}>
              <button type="button" onClick={() => onOpenSection(selHub.section)}>
                <span className="ws-row-t ws-row-more">+{extra} 更多 · 进入{selHub.label}</span>
              </button>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
