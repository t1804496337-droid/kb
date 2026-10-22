"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  HudModuleContent,
  HudDecisionNote,
} from "@/components/studio/hud-module-content";
import {
  exportState,
  importState,
  restorePreImport,
  hasPreImportBackup,
} from "@/components/studio/snapshot";
import { RadialMenu } from "@/components/studio/radial-menu";
import { MindMap } from "@/components/studio/mind-map";

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

/**
 * Direction E · HUD home (2026-10-21, branch hud-landing-e).
 *
 * The site's only page after the login gate, per the frozen mockup
 * (~/workspace/style-mockups/direction-e-final.html): flat neon HUD —
 * top status bar, LIVE ticker, THE ORB module tree + TERMINAL_LOG,
 * CORE MAP sphere, RADAR + DECISION STACK, bottom module console.
 * Structure decisions (user, 2026-10-21): the workspace is offline
 * (disconnected in page.tsx, not deleted), there is no ENTER button,
 * module cards / tree nodes select a focus module (no navigation),
 * and the only theme is this dark
 * silver-black HUD — theme props/wiring are gone entirely.
 *
 * Module counts come from the live `nodes`/`stats` props (same 口径 as
 * the old landing: entries = Σ module counts). Ops copy (log lines,
 * decision stack) mirrors real state as of 2026-10-21 — EP001 uploaded
 * 10-18 awaiting publish, XHS banned and X paused on 10-20, ontology
 * shell live with details unscheduled, pending calendar tickets.
 * Update by hand when those facts move; never invent numbers. Health
 * freshness is NOT hard-coded: read live from /health-sync.json
 * (missing/unreachable → STALE).
 */
const HUD_LOG_FACTS: { text: string; color?: string }[] = [
  { text: "[10-18] EP001 UPLOADED · AWAITING PUBLISH" },
  {
    text: "[10-20 13:29] XHS ACCOUNT BANNED · OPS HALTED",
    color: "var(--hud-pink)",
  },
  { text: "[10-20 16:12] X OPS PAUSED · 8 TASKS OFF" },
];

type HudModule = {
  id: string;
  label: string;
  en: string;
  icon: string;
  color: string;
  /** null → render countText instead (the 创作空间 HUB card). */
  count: number | null;
  countText?: string;
  countDim?: boolean;
  led: "g" | "a" | "d";
};

type HealthState = {
  syncTime: string | null;
  sleepLast: string | null;
  /** sleep.last verbatim from health-sync.json (date/start/end/hours). */
  sleep: {
    date: string;
    start?: string;
    end?: string;
    hours?: number;
  } | null;
  ok: boolean;
};

/* ── decision-stack algorithm helpers (2026-10-22, hud-decision-algo) ──
 * Ages are whole-day differences on Asia/Shanghai calendar days, so a
 * row never flips stale mid-day over a time-of-day boundary. */
const shDayNum = (iso: string): number => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 864e5);
};
const todayShNum = (): number => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Math.floor(Date.UTC(get("year"), get("month") - 1, get("day")) / 864e5);
};
const ageDaysOf = (iso: string): number => todayShNum() - shDayNum(iso);
const daysUntilOf = (iso: string): number => shDayNum(iso) - todayShNum();

/* ── three-zone restyle helpers (2026-10-22, hud-restyle) ──
 * beamRgb: a module's #RRGGBB beam colour as an "r g b" triplet for
 * the console-card waterline's rgb(var(--beam) / α) gradient.
 * useTypewriter: reveals the terminal's newest REAL log line
 * character by character. It types on mount and again only when the
 * line's text itself changes — the once-a-second clock re-render
 * passes the same string and never restarts the reveal. */
const beamRgb = (c: string): string => {
  const m = /^#([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return "0 255 255";
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

function useTypewriter(text: string, cps = 32): string {
  const [n, setN] = React.useState(0);
  const seen = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (seen.current === text) return;
    seen.current = text;
    setN(0);
    const step = Math.max(16, Math.round(1000 / cps));
    const id = window.setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          window.clearInterval(id);
          return v;
        }
        return v + 1;
      });
    }, step);
    return () => window.clearInterval(id);
  }, [text, cps]);
  return text.slice(0, n);
}

/* ── scramble hover decode (2026-10-22, hud-interactions) ──
 * rAF-driven text scramble for the module-tree labels: on hover the
 * label dissolves into glyph noise and re-resolves to the real text
 * within 14 frames. Two width disciplines keep the row box frozen:
 * (1) the replacement pool is width-matched per character — CJK
 * slots take full-width radicals, ASCII slots take ASCII (a CJK
 * glyph is 2× an ASCII advance and falls back to a different font,
 * so mixing them per-slot would jitter the width); (2) the label's
 * rendered length is locked with SVG textLength for the whole run
 * and released on finish/cancel. */
const SCRAMBLE_ASCII: string[] = [..."0x!f@#%&/<>"];
const SCRAMBLE_RADICALS: string[] = [
  "氵", "艹", "阝", "钅", "纟", "爿", "灬", "訁", "飠",
];
const scramblePoolFor = (ch: string): string[] =>
  ch.charCodeAt(0) > 0xff ? SCRAMBLE_RADICALS : SCRAMBLE_ASCII;

function useScramble() {
  const els = React.useRef(new Map<string, SVGTextElement>());
  const frames = React.useRef(new Map<string, number>());

  const releaseLock = (el: SVGTextElement) => {
    el.removeAttribute("textLength");
    el.removeAttribute("lengthAdjust");
  };

  const stop = React.useCallback((id: string, restore?: string) => {
    const f = frames.current.get(id);
    if (f !== undefined) cancelAnimationFrame(f);
    frames.current.delete(id);
    const el = els.current.get(id);
    if (el) {
      releaseLock(el);
      if (restore !== undefined) el.textContent = restore;
    }
  }, []);

  const play = React.useCallback(
    (id: string, text: string) => {
      const el = els.current.get(id);
      if (!el || !text) return;
      stop(id);
      /* lock the rendered length before the first mutated frame */
      try {
        const w = el.getComputedTextLength();
        if (Number.isFinite(w) && w > 0) {
          el.setAttribute("textLength", String(w));
          el.setAttribute("lengthAdjust", "spacing");
        }
      } catch {
        /* measurement unavailable — width-matched pools still apply */
      }
      const TOTAL = 14;
      let frame = 0;
      const tick = () => {
        frame += 1;
        const done = Math.floor((frame / TOTAL) * text.length);
        let out = text.slice(0, done);
        for (let i = done; i < text.length; i += 1) {
          const pool = scramblePoolFor(text[i]);
          out += pool[(Math.random() * pool.length) | 0];
        }
        el.textContent = out;
        if (frame < TOTAL) {
          frames.current.set(id, requestAnimationFrame(tick));
        } else {
          el.textContent = text;
          releaseLock(el);
          frames.current.delete(id);
        }
      };
      frames.current.set(id, requestAnimationFrame(tick));
    },
    [stop],
  );

  const finePointer = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* Mouse path: hover-capable devices only (media-gated). */
  const start = React.useCallback(
    (id: string, text: string) => {
      if (finePointer()) play(id, text);
    },
    [play],
  );

  /* Touch path (2026-10-22 rule: every hover effect needs a touch
   * equivalent): a tap plays the scramble once, in the same frame as
   * the row's click behaviour — it never blocks or delays selection.
   * On fine-pointer devices the hover path owns the effect, so tap
   * stays a no-op there. */
  const tap = React.useCallback(
    (id: string, text: string) => {
      if (!finePointer()) play(id, text);
    },
    [play],
  );

  React.useEffect(() => {
    const pending = frames.current;
    return () => {
      pending.forEach((f) => cancelAnimationFrame(f));
      pending.clear();
    };
  }, []);

  const register = React.useCallback(
    (id: string) => (el: SVGTextElement | null) => {
      if (el) els.current.set(id, el);
      else els.current.delete(id);
    },
    [],
  );

  return { register, start, tap, stop };
}

/* ── mobile bottom navigation (2026-10-22, hud-mobile-nav) ──
 * Rendered at every width but display:none above 1100px (CSS), so
 * the desktop layout is untouched. Five segments map to the tree's
 * real groups; the 决策 badge counts the live decision rows. */
function HudMobileNav({
  sheet,
  group,
  home,
  pending,
  onOverview,
  onGroup,
  onDecisions,
}: {
  sheet: "none" | "tree" | "decisions";
  group: string;
  home: boolean;
  pending: number;
  onOverview: () => void;
  onGroup: (g: string) => void;
  onDecisions: () => void;
}) {
  const segs: {
    tid: string;
    cn: string;
    en: string;
    active: boolean;
    run: () => void;
    badge?: number;
  }[] = [
    { tid: "overview", cn: "总览", en: "OVERVIEW", active: home && sheet === "none", run: onOverview },
    { tid: "create", cn: "创作", en: "CREATE", active: sheet === "tree" && group === "create", run: () => onGroup("create") },
    { tid: "knowledge", cn: "知识", en: "KNOWLEDGE", active: sheet === "tree" && group === "knowledge", run: () => onGroup("knowledge") },
    { tid: "life", cn: "生活", en: "LIFE", active: sheet === "tree" && group === "life", run: () => onGroup("life") },
    {
      tid: "decisions", cn: "决策", en: "DECISIONS",
      active: sheet === "decisions", run: onDecisions, badge: pending,
    },
  ];
  return (
    <nav className="hud-mnav" data-testid="hud-mnav" aria-label="移动端导航">
      {segs.map((s) => (
        <button
          key={s.tid}
          type="button"
          className={cn("hud-mnav-seg", s.active && "hud-mnav-seg-on")}
          data-testid={`hud-mnav-seg-${s.tid}`}
          aria-pressed={s.active}
          onClick={s.run}
        >
          <span className="hud-mnav-cn">{s.cn}</span>
          <span className="hud-mnav-en">{s.en}</span>
          {s.badge != null && s.badge > 0 && (
            <span className="hud-mnav-badge" data-testid="hud-mnav-badge">
              {s.badge}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

/* ── drag rail (2026-10-22, hud-mobile-nav) ──
 * The mobile drop surface for the drag engine: nine module chips in
 * a thumb-scrollable rail, pinned to the bottom while a drag is live
 * (CSS keys off .hud-dragging / .hud-drop-pulse on the root). The
 * engine measures these chips as its card anchors in mobile mode. */
function HudDragRail({
  modules,
  onOpen,
}: {
  modules: HudModule[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="hud-drag-rail" data-testid="hud-drag-rail" aria-hidden>
      {modules.slice(0, 9).map((m) => (
        <button
          key={m.id}
          type="button"
          className="hud-rail-chip"
          style={{ color: m.color }}
          data-module={m.id}
          data-testid={`hud-rail-chip-${m.id}`}
          tabIndex={-1}
          onClick={() => onOpen(m.id)}
        >
          <span className="hud-rail-ic">{m.icon}</span>
          <span className="hud-rail-nm">{m.label}</span>
        </button>
      ))}
    </div>
  );
}

export function NeuralLanding({
  nodes,
  leaving,
  quick = false,
  stats = [],
  customCards = [],
}: {
  nodes: LandingNode[];
  leaving: boolean;
  quick?: boolean;
  stats?: { key?: string; value: number; label: string; en: string }[];
  /** User-created modules, shown as extra console cards when present. */
  customCards?: {
    id: string;
    label: string;
    en: string;
    count: number;
    beam?: string;
  }[];
}) {
  /* ---- live clock (real time, 1s refresh) ---- */
  const [clock, setClock] = React.useState("--:--:-- CST");
  React.useEffect(() => {
    const p = (n: number) => String(n).padStart(2, "0");
    const tick = () => {
      const d = new Date();
      setClock(
        `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} CST`,
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  /* ---- health freshness from /health-sync.json (never fabricated) ---- */
  const [health, setHealth] = React.useState<HealthState>({
    syncTime: null,
    sleepLast: null,
    sleep: null,
    ok: false,
  });
  React.useEffect(() => {
    let live = true;
    fetch("/health-sync.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          j: {
            updated_at?: unknown;
            sleep?: {
              last?: {
                date?: unknown;
                start?: unknown;
                end?: unknown;
                hours?: unknown;
              };
            };
          } | null,
        ) => {
          if (!live || !j) return;
          const upd = typeof j.updated_at === "string" ? j.updated_at : "";
          const last = j.sleep?.last;
          const sleepDate = last?.date;
          setHealth({
            syncTime: upd.length >= 16 ? upd.slice(11, 16) : null,
            sleepLast: typeof sleepDate === "string" ? sleepDate.slice(5) : null,
            sleep:
              typeof sleepDate === "string"
                ? {
                    date: sleepDate,
                    start: typeof last?.start === "string" ? last.start : undefined,
                    end: typeof last?.end === "string" ? last.end : undefined,
                    hours:
                      typeof last?.hours === "number" ? last.hours : undefined,
                  }
                : null,
            ok: true,
          });
        },
      )
      .catch(() => {
        /* unreachable → stays STALE */
      });
    return () => {
      live = false;
    };
  }, []);

  /* ---- module data: live counts via props, E display copy fixed ---- */
  const nodeBySection = (s: string) =>
    nodes.find((n) => !n.customId && n.section === s);
  const nodeByCustom = (id: string) =>
    nodes.find((n) => n.customId === id);

  const nIdeas = nodeBySection("ideas");
  const nSkills = nodeBySection("drafts");
  const nWorks = nodeBySection("works");
  const nDb = nodeBySection("database");
  const nCal = nodeBySection("calendar");
  const nHealth = nodeByCustom("health");
  const nFin = nodeByCustom("finance");
  const nOnto = nodeByCustom("ontology");

  const skillsN =
    stats.find((s) => s.key === "skills")?.value ?? nSkills?.n ?? 13;
  const ticketsN = stats.find((s) => s.key === "tickets")?.value ?? 2;
  const ideasN = nIdeas?.n ?? 0;
  const worksN = nWorks?.n ?? 0;
  const dbN = nDb?.n ?? 0;
  const calN = nCal?.n ?? 0;
  const healthN = nHealth?.n ?? 0;
  const finN = nFin?.n ?? 0;
  const ontoN = nOnto?.n ?? 0;

  const KNOWN_CUSTOM = new Set(["health", "finance", "ontology"]);
  const extraNodes = nodes.filter(
    (n) => n.customId && !KNOWN_CUSTOM.has(n.customId),
  );
  const extraNodeIds = new Set(extraNodes.map((n) => n.customId));
  const extras: HudModule[] = [
    ...extraNodes.map((n) => ({
      id: `x-${n.customId}`,
      label: n.label,
      en: n.en,
      icon: "◆",
      color: n.beam ?? "#aebfdd",
      count: n.n,
      countDim: n.n <= 0,
      led: (n.n > 0 ? "g" : "d") as HudModule["led"],
    })),
    ...customCards
      .filter((c) => !KNOWN_CUSTOM.has(c.id) && !extraNodeIds.has(c.id))
      .map((c) => ({
        id: `x-${c.id}`,
        label: c.label,
        en: c.en,
        icon: "◆",
        color: c.beam ?? "#aebfdd",
        count: c.count,
        countDim: c.count <= 0,
        led: (c.count > 0 ? "g" : "d") as HudModule["led"],
      })),
  ];

  const modules: HudModule[] = [
    {
      id: "inspiration", label: "灵感池", en: "INSPIRATION", icon: "✦",
      color: "#54678a", count: ideasN, countDim: ideasN <= 0,
      led: ideasN > 0 ? "g" : "d",
    },
    {
      id: "skills", label: "技能库", en: "SKILLS", icon: "⬡",
      color: "#B200FF", count: skillsN, led: "g",
    },
    {
      id: "works", label: "作品库", en: "WORKS", icon: "▶",
      color: "#FF007F", count: worksN, countDim: worksN <= 0,
      led: worksN > 0 ? "g" : "d",
    },
    {
      id: "database", label: "数据库", en: "DATABASE", icon: "⛁",
      color: "#00FFFF", count: dbN, countDim: dbN <= 0,
      led: dbN > 0 ? "g" : "d",
    },
    {
      id: "ontology", label: "本体知识库", en: "ONTOLOGY", icon: "◈",
      color: "#54678a", count: ontoN, countDim: ontoN <= 0,
      led: ontoN > 0 ? "g" : "d",
    },
    {
      id: "calendar", label: "日历表", en: "CALENDAR", icon: "▦",
      color: "#54678a", count: calN, countDim: calN <= 0,
      led: calN > 0 ? "g" : "d",
    },
    {
      id: "health", label: "身体健康", en: "HEALTH", icon: "♥",
      color: "#ffb03a", count: healthN, countDim: false, led: "a",
    },
    {
      id: "finance", label: "财务系统", en: "FINANCE", icon: "¥",
      color: "#FFEA00", count: finN, countDim: finN <= 0,
      led: finN > 0 ? "g" : "d",
    },
    {
      id: "studio", label: "创作空间", en: "STUDIO", icon: "✎",
      color: "#00FFFF", count: null, countText: "HUB", led: "g",
    },
    ...extras,
  ];

  const total = modules.reduce((acc, m) => acc + (m.count ?? 0), 0);
  const knowledgeN = skillsN + dbN;
  const outputN = worksN + finN;

  /* ---- module focus: tree nodes + console cards are clickable; the
   * CORE MAP corner tags, telemetry strip and radar stat rows follow
   * the selection. All copy is derived from the live counts/health
   * above — same caliber as the overview, never invented. ---- */
  const [sel, setSel] = React.useState<string | null>(null);
  const [hov, setHov] = React.useState<string | null>(null);
  const scramble = useScramble();
  /* terminal typewriter: the newest real log line (the last
   * HUD_LOG_FACTS entry) types itself in on mount / on change. */
  const typedTermLatest = useTypewriter(
    HUD_LOG_FACTS[HUD_LOG_FACTS.length - 1]?.text ?? "",
    32,
  );
  /* ── decision archive (2026-10-22, hud-restyle) ──
   * [ARCHIVE] on a decision row is a REAL archive: the row's id goes
   * to localStorage studio_decision_archived_v1 (registered in the
   * snapshot layer as decisionArchived), the row leaves the
   * algorithmic ordering and sinks into the collapsed 已归档 group at
   * the stack's foot, restorable from there. The pending counts
   * (stack chip + mobile-nav badge) count only unarchived rows. */
  const DECISION_ARCHIVED_KEY = "studio_decision_archived_v1";
  const [archivedIds, setArchivedIds] = React.useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(DECISION_ARCHIVED_KEY);
      const v: unknown = raw ? JSON.parse(raw) : null;
      return Array.isArray(v)
        ? v.filter((x): x is string => typeof x === "string")
        : [];
    } catch {
      return [];
    }
  });
  const [archivedOpen, setArchivedOpen] = React.useState(false);
  const writeArchived = React.useCallback((ids: string[]) => {
    setArchivedIds(ids);
    try {
      window.localStorage.setItem(DECISION_ARCHIVED_KEY, JSON.stringify(ids));
    } catch {
      /* storage unavailable → archive lasts for this session only */
    }
  }, []);
  const archiveDecision = (id: string) =>
    writeArchived([...new Set([...archivedIds, id])]);
  const restoreDecision = (id: string) =>
    writeArchived(archivedIds.filter((x) => x !== id));
  /* ── mobile bottom nav + panel sheets (2026-10-22, hud-mobile-nav) ──
   * At ≤1100px (the stacking breakpoint) the module tree and the
   * decision stack become bottom sheets driven by this one state —
   * the desktop DOM is reused as-is, only its CSS form changes (see
   * globals.css). Segments of the mobile nav open them: 总览 closes,
   * 创作/知识/生活 open the tree sheet scrolled to that group,
   * 决策 opens the decision sheet. */
  type Msheet = "none" | "tree" | "decisions";
  const [msheet, setMsheet] = React.useState<Msheet>("none");
  const treeGroupRef = React.useRef<string>("create");
  const [treeFlash, setTreeFlash] = React.useState<{
    group: string;
    n: number;
  } | null>(null);
  const treePanelRef = React.useRef<HTMLDivElement | null>(null);
  const openTreeGroup = (g: string) => {
    backToOverview();
    if (msheet === "tree" && treeGroupRef.current === g) {
      setMsheet("none");
      return;
    }
    treeGroupRef.current = g;
    setMsheet("tree");
    setTreeFlash({ group: g, n: Date.now() });
  };
  /* after the tree sheet rises: scroll its group label into view and
   * let the CSS flash on [data-flash] play once. */
  React.useEffect(() => {
    if (msheet !== "tree" || !treeFlash) return;
    const panel = treePanelRef.current;
    if (!panel) return;
    const raf = requestAnimationFrame(() => {
      const el = panel.querySelector(`[data-treegroup="${treeFlash.group}"]`);
      if (el) {
        const pr = panel.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        panel.scrollTop += er.top - pr.top - 52;
      }
    });
    const t = window.setTimeout(() => setTreeFlash(null), 1050);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [msheet, treeFlash]);
  /* sheet head drag-down to close — same gesture as the palette
   * sheet: a >56px downward swipe on the grip / panel head. */
  const sheetTouchY = React.useRef<number | null>(null);
  const onSheetTouchStart = (e: React.TouchEvent) => {
    sheetTouchY.current = e.touches[0]?.clientY ?? null;
  };
  const onSheetTouchEnd = (e: React.TouchEvent) => {
    const y0 = sheetTouchY.current;
    sheetTouchY.current = null;
    if (y0 == null) return;
    const y1 = e.changedTouches[0]?.clientY ?? y0;
    if (y1 - y0 > 56) setMsheet("none");
  };

  /* Module content view (2026-10-21): clicking a tree row / console card
   * opens that module's real content in place of the overview; the back
   * button returns.
   * Focus semantics (revised 2026-10-22, hud-sel-fix): focus is an
   * overview-only, post-return state. Entering ANY view ends the focus
   * (openModule clears sel); backToOverview focuses the module just
   * left, which is what drives the decision-stack linkage after a trip.
   * Before this fix openModule parked sel=id across the whole trip, so
   * the first overview click on that module afterwards was swallowed
   * by focusOrOpen's toggle-off branch and the view would not reopen. */
  const [view, setView] = React.useState<string | null>(null);
  const openModule = (id: string) => {
    setSel(null);
    setView(id);
    setMsheet("none");
  };
  /* Return to the overview: leaving a module view focuses the module
   * just left (tags / telemetry / decision linkage keep its context);
   * note views and "already on the overview" leave no focus behind. */
  const backToOverview = () => {
    if (view) setSel(modules.some((m) => m.id === view) ? view : null);
    setView(null);
  };
  /* Overview tree rows / console cards always enter the module — there
   * is no toggle-off click anymore. Focus is cleared by entering any
   * view, or in place via the palette's 返回总览 item. */
  const focusOrOpen = (id: string) => {
    openModule(id);
  };
  const viewMod = view ? (modules.find((m) => m.id === view) ?? null) : null;
  /* Decision-stack note views (X 恢复 / 小红书去向）: no module behind
   * them — a facts-only note page, opened with view = "note:x"|"note:xhs". */
  const noteKind =
    view === "note:x" ? ("x" as const) : view === "note:xhs" ? ("xhs" as const) : null;
  const selMod = sel ? (modules.find((m) => m.id === sel) ?? null) : null;
  const sharePct = (n: number | null) =>
    n == null || total <= 0 ? 0 : Math.round((n / total) * 100);
  const moduleStatus = (m: HudModule): { main: string; note: string } => {
    switch (m.id) {
      case "health":
        return {
          main: `STALE · ${health.sleepLast ?? "10-19"}`,
          note: `HEALTH-SYNC → MAIN · LAST ${health.syncTime ?? "--:--"}`,
        };
      case "calendar":
        return {
          main: `TICKETS ×${ticketsN} OPEN`,
          note: `待办票未清 · 条目 ${calN}`,
        };
      case "ontology":
        return { main: "IDLING", note: "空壳已上线 · 细节待排期" };
      case "studio":
        return { main: "HUB", note: "创作中枢 · 模块入口" };
      default:
        return (m.count ?? 0) > 0
          ? { main: "ACTIVE", note: `${m.en} · 条目 ${m.count}` }
          : { main: "EMPTY", note: `${m.en} · 条目 0 · 待填充` };
    }
  };
  /** Tree SVG row centers (viewBox 276×472), keyed by module id. */
  const treeRows: { id: string; y: number }[] = [
    { id: "studio", y: 86 },
    { id: "works", y: 116 },
    { id: "skills", y: 146 },
    { id: "database", y: 226 },
    { id: "ontology", y: 256 },
    { id: "inspiration", y: 336 },
    { id: "calendar", y: 366 },
    { id: "health", y: 396 },
    { id: "finance", y: 426 },
  ];
  const treeRowY = (id: string) =>
    treeRows.find((r) => r.id === id)?.y ?? 0;
  const modById = (id: string) => modules.find((m) => m.id === id);
  const cntFill = (n: number) => (n > 0 ? "#e8f4ff" : "#5f7194");
  /* Restyle block meter (2026-10-22, hud-restyle): the share track
   * beside each tree row's number becomes five blocks; lit =
   * round(share / 20) of the SAME real entry share the filled bars
   * encoded (sharePct of the live count) — presentation only, the
   * number is never new. The off-block fill matches
   * --hud-int-block-off in globals.css. */
  const treeBlocks = (
    id: string,
    count: number | null,
    y: number,
    color: string,
  ) => {
    const share = sharePct(count);
    const lit = Math.round(share / 20);
    return (
      <g
        data-testid={`hud-tree-blocks-${id}`}
        data-lit={lit}
        data-share={share}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            x={196 + i * 8.4}
            y={y - 3}
            width={6}
            height={6}
            fill={i < lit ? color : "#0d1226"}
            fillOpacity={i < lit ? 1 : 0.55}
            stroke={color}
            strokeWidth="0.5"
          />
        ))}
      </g>
    );
  };

  /* ---- radar polygon: axes scaled to count/13 (mockup caliber) ---- */
  const RC: [number, number] = [79, 84];
  const RV: [number, number][] = [
    [79, 16], [134, 52], [118, 124], [40, 124], [24, 52],
  ];
  const radarPt = (v: number, i: number): [number, number] => {
    const f = 0.96 * Math.min(Math.max(v, 0) / 13, 1);
    return [
      RC[0] + (RV[i][0] - RC[0]) * f,
      RC[1] + (RV[i][1] - RC[1]) * f,
    ];
  };
  const radarVals = [skillsN, dbN, worksN, finN, healthN + calN];
  const radarPts = radarVals.map((v, i) => radarPt(v, i));
  const radarPolygon = radarPts
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

  /* ---- health decision line: composed live from /health-sync.json ----
   * sleep.last.date vs viewer-local yesterday decides 已同步 / STALE —
   * never a hard-coded freshness claim. Fetch failure → the previous
   * fallback copy below. */
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const yestD = new Date();
  yestD.setDate(yestD.getDate() - 1);
  const yestISO = `${yestD.getFullYear()}-${pad2(yestD.getMonth() + 1)}-${pad2(yestD.getDate())}`;
  const slp = health.sleep;
  let healthTag = "STALE";
  let healthTagCls = "hud-c-amb";
  let healthFact = `最近完整记录 ${health.sleepLast ?? "10-19"} · 数据待更新`;
  if (health.ok && slp && slp.date >= yestISO) {
    healthTag = "已同步";
    healthTagCls = "hud-c-grn";
    healthFact =
      `昨晚完整记录已同步` +
      (slp.start && slp.end ? ` · ${slp.start} 入睡 → ${slp.end} 起床` : "") +
      (typeof slp.hours === "number"
        ? ` · ${Math.round(slp.hours * 10) / 10}h`
        : "");
  } else if (health.ok && slp) {
    healthFact = `最近完整记录 ${slp.date.slice(5)} 晚 · 昨晚待手机同步`;
  } else if (health.ok) {
    healthFact = "暂无完整睡眠记录 · 待手机同步";
  }

  /* ---- decision stack (real open items, 2026-10-21 caliber) ----
   * Every row is clickable: module-backed items jump to that module's
   * content view; the two decision items (X / XHS) open a facts note
   * view with intent-recording buttons. `wait` names whose hands the
   * item is stuck in. Status copy is factual only — the decorative
   * progress percentages of the frozen mockup were removed.
   *
   * Algorithmic ordering (2026-10-22, hud-decision-algo — replaces the
   * hand-ordered list): each item carries a real `updatedAt` (the day
   * its status last actually changed; the health row's is DYNAMIC —
   * the latest complete sleep record in health-sync.json, so a fresh
   * sync revives the row), an `urgency` grade (0–2, how close to done
   * / how much it should move first) and a `waitKind`. No item has a
   * real deadline today, so `due` stays unset everywhere — never
   * fabricate one. score = urgency*100
   *   + (due ? max(0, 30 − daysUntil(due)) * 3 : 0)
   *   + (waitKind: user 25 / data 10 / schedule 0).
   * Items untouched for > 3 Shanghai calendar days are decayed:
   * they sink below every fresh item (score orders within a layer)
   * and render at 40% opacity with a STALE · n 天未动 marker. */
  const healthUpdatedAt =
    slp?.date ??
    (health.sleepLast ? `2026-${health.sleepLast}` : "2026-10-19");
  const decisions: {
    /** Stable slug — the drag engine's source id (onDrop sourceId). */
    id: string;
    led: HudModule["led"] | "p";
    name: string;
    en: string;
    tag: string;
    tagCls: string;
    fact: string;
    wait: string;
    target?: string;
    note?: "x" | "xhs";
    /** Owning module for the focus linkage (2026-10-22): when that
     * module is focused on the overview, this row highlights and the
     * others dim. Note-only items (X / XHS) have no module. */
    module?: string;
    /** ISO day this item's status last really changed. */
    updatedAt: string;
    /** 0–2 — closeness to done / how much it should move first. */
    urgency: 0 | 1 | 2;
    /** Whose hands the item is stuck in (drives the score bonus). */
    waitKind: "user" | "data" | "schedule";
    /** Real deadline only — none exists today; never fabricate. */
    due?: string;
  }[] = [
    {
      id: "ep001",
      led: "p", name: "EP001 公开", en: "YOUTUBE PUBLISH", tag: "待公开",
      tagCls: "hud-c-pink", target: "works", module: "works",
      fact: "已上传 · 待手机端改公开",
      wait: "等你 · 手机操作",
      /* uploaded 2026-10-18; one phone tap from done → urgency 2 */
      updatedAt: "2026-10-18", urgency: 2, waitKind: "user",
    },
    {
      id: "health-sync",
      led: "a", name: "健康数据同步", en: "HEALTH SYNC", tag: healthTag,
      tagCls: healthTagCls, target: "health", module: "health",
      fact: healthFact,
      wait: "等数据 · 手机同步",
      /* updatedAt is DYNAMIC (healthUpdatedAt above): the latest
       * complete sleep record — a fresh sync revives this row. */
      updatedAt: healthUpdatedAt, urgency: 1, waitKind: "data",
    },
    {
      id: "calendar-tickets",
      led: "g", name: `待办票 ×${ticketsN}`, en: "CALENDAR TICKETS", tag: "待清",
      tagCls: "hud-c-cyan", target: "calendar", module: "calendar",
      fact: "日历模块待办票未清",
      wait: "等你 · 随手清",
      /* 视频号 ep01 定稿 2026-10-19; clearable any time → urgency 1 */
      updatedAt: "2026-10-19", urgency: 1, waitKind: "user",
    },
    {
      id: "xhs-decision",
      led: "p", name: "小红书去向", en: "XHS DECISION A/B/C", tag: "待拍板",
      tagCls: "hud-c-pur", note: "xhs",
      fact: "申诉 / 换号 / 搁置 · 待拍板",
      wait: "等你 · 三选一",
      /* account banned 2026-10-20; only the user can call it → 1 */
      updatedAt: "2026-10-20", urgency: 1, waitKind: "user",
    },
    {
      id: "ontology-build",
      led: "d", name: "本体知识库填充", en: "ONTOLOGY BUILD", tag: "建设中",
      tagCls: "hud-c-pur", target: "ontology", module: "ontology",
      fact: "空壳已上线 · 条目 0 · 细节待排期",
      wait: "等排期",
      /* shell shipped 2026-10-21; queued build, nothing to push → 0 */
      updatedAt: "2026-10-21", urgency: 0, waitKind: "schedule",
    },
    {
      id: "x-resume",
      led: "d", name: "X 账号恢复", en: "X OPS RESUME", tag: "已暂停",
      tagCls: "hud-c-pink", note: "x",
      fact: "8 个定时任务停用 · 待指令",
      wait: "等你 · 一句话恢复",
      /* paused by the user's own order 2026-10-20; moves only when
       * he reverses that order → urgency 0 */
      updatedAt: "2026-10-20", urgency: 0, waitKind: "user",
    },
  ];
  /* score + decay per the approved formula; stable sort keeps the
   * declaration order inside equal (layer, score) groups. */
  const scoredDecisions = decisions.map((d) => {
    const age = ageDaysOf(d.updatedAt);
    const score =
      d.urgency * 100 +
      (d.due ? Math.max(0, 30 - daysUntilOf(d.due)) * 3 : 0) +
      (d.waitKind === "user" ? 25 : d.waitKind === "data" ? 10 : 0);
    return { d, age, score, decayed: age > 3 };
  });
  const orderedDecisions = [...scoredDecisions].sort(
    (a, b) => Number(a.decayed) - Number(b.decayed) || b.score - a.score,
  );
  /* archived rows leave the algorithm ordering entirely (hud-restyle):
   * the visible stack is the active list; the archived list feeds the
   * collapsed group at the foot. Pending counts follow the active
   * list, so archiving a row moves the stack chip and the mobile-nav
   * badge with it. */
  const archivedSet = new Set(archivedIds);
  const activeDecisions = orderedDecisions.filter(
    (s) => !archivedSet.has(s.d.id),
  );
  const archivedDecisions = orderedDecisions.filter((s) =>
    archivedSet.has(s.d.id),
  );
  const pendingCount = activeDecisions.length;
  /* FLIP reorder animation: when the computed order changes (e.g. the
   * health row revives on sync and floats up), rows glide from their
   * previous tops instead of the stack re-rendering in a flash. Tops
   * are measured relative to the stack panel (scroll-invariant);
   * the first paint only records positions, never animates. */
  const stackPanelRef = React.useRef<HTMLDivElement | null>(null);
  const decisionRowRefs = React.useRef(new Map<string, HTMLButtonElement>());
  const decisionPrevTops = React.useRef<Map<string, number> | null>(null);
  const decisionPrevSig = React.useRef<string | null>(null);
  const decisionOrderSig = activeDecisions.map((s) => s.d.id).join(",");
  React.useLayoutEffect(() => {
    const panel = stackPanelRef.current;
    if (!panel) return;
    const panelTop = panel.getBoundingClientRect().top;
    const tops = new Map<string, number>();
    decisionRowRefs.current.forEach((el, id) => {
      if (el.isConnected) tops.set(id, el.getBoundingClientRect().top - panelTop);
    });
    const prev = decisionPrevTops.current;
    const sigChanged =
      decisionPrevSig.current !== null &&
      decisionPrevSig.current !== decisionOrderSig;
    decisionPrevTops.current = tops;
    decisionPrevSig.current = decisionOrderSig;
    if (!sigChanged || !prev) return;
    tops.forEach((top, id) => {
      const old = prev.get(id);
      const el = decisionRowRefs.current.get(id);
      if (old == null || !el) return;
      const dy = old - top;
      if (Math.abs(dy) < 1) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform var(--hud-int-flip-dur) ease";
        el.style.transform = "";
        window.setTimeout(() => {
          el.style.transition = "";
          el.style.transform = "";
        }, 380);
      });
    });
  });
  const openDecision = (d: (typeof decisions)[number]) => {
    if (d.target) openModule(d.target);
    else if (d.note) {
      setSel(null);
      setMsheet("none");
      setView(`note:${d.note}`);
    }
  };

  /* ── command palette (2026-10-22, hud-interactions) ──
   * Cmd+K / Ctrl+K toggles from anywhere (even mid-typing in a form —
   * the listener is on window and the chord is checked first), Esc
   * closes, the topbar ⌘K chip opens it too (touch equivalent). Items
   * reuse the existing actions only: openModule for modules,
   * openDecision for decisions, back/clear-focus for 返回总览. On
   * ≤768px the panel becomes a bottom sheet (see globals.css). */
  type PalItem = {
    tid: string;
    kind: "导航" | "模块" | "决策";
    label: string;
    en: string;
    hint?: string;
    run: () => void;
  };
  const [palOpen, setPalOpen] = React.useState(false);
  const [palQuery, setPalQuery] = React.useState("");
  const [palIdx, setPalIdx] = React.useState(0);
  const palInputRef = React.useRef<HTMLInputElement | null>(null);
  /* ── 脑机快照（Local-First 持久化层，snapshot.ts）：导出/导入/撤销 ──
   * 导入两步确认（InlineConfirmButton 式）：先选文件，按钮变
   * 「确认覆盖导入？」再点才执行；成功后整页 reload 复位，结果行
   * 通过 sessionStorage 一次性 flash 跨 reload 显示。 */
  const SNAP_FLASH_KEY = "studio_snap_flash";
  const [snapNote, setSnapNote] = React.useState("");
  const [snapPending, setSnapPending] = React.useState<File | null>(null);
  const [snapUndoArmed, setSnapUndoArmed] = React.useState(false);
  const [snapHasBackup, setSnapHasBackup] = React.useState(false);
  const snapFileRef = React.useRef<HTMLInputElement | null>(null);
  const snapNoteTimer = React.useRef<number | undefined>(undefined);
  const snapPendingTimer = React.useRef<number | undefined>(undefined);
  const showSnapNote = React.useCallback((msg: string) => {
    setSnapNote(msg);
    window.clearTimeout(snapNoteTimer.current);
    snapNoteTimer.current = window.setTimeout(() => setSnapNote(""), 6000);
  }, []);
  React.useEffect(() => {
    setSnapHasBackup(hasPreImportBackup());
    try {
      const flash = window.sessionStorage.getItem(SNAP_FLASH_KEY);
      if (flash) {
        window.sessionStorage.removeItem(SNAP_FLASH_KEY);
        showSnapNote(flash);
      }
    } catch {
      /* sessionStorage unavailable → 无 flash */
    }
  }, [showSnapNote]);
  const armSnapPending = React.useCallback((f: File | null) => {
    setSnapPending(f);
    window.clearTimeout(snapPendingTimer.current);
    if (f) {
      snapPendingTimer.current = window.setTimeout(
        () => setSnapPending(null),
        12000,
      );
    }
  }, []);
  const runSnapImport = async () => {
    const f = snapPending;
    armSnapPending(null);
    if (!f) return;
    const r = await importState(f);
    if (!r.ok) {
      showSnapNote(r.error);
      return;
    }
    try {
      window.sessionStorage.setItem(
        SNAP_FLASH_KEY,
        `快照已导入：写入 ${r.written} 片，跳过 ${r.skipped} 片。可点「撤销导入」回到导入前。`,
      );
    } catch {
      /* ignore */
    }
    window.location.reload();
  };
  const runSnapUndo = () => {
    setSnapUndoArmed(false);
    const r = restorePreImport();
    if (!r.ok) {
      showSnapNote(r.error);
      return;
    }
    try {
      window.sessionStorage.setItem(
        SNAP_FLASH_KEY,
        "已撤销导入，状态恢复到导入前。",
      );
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  const palPanelRef = React.useRef<HTMLDivElement | null>(null);
  const palItemEls = React.useRef(new Map<string, HTMLButtonElement>());
  const palReturnFocus = React.useRef<HTMLElement | null>(null);
  const palOpenRef = React.useRef(false);
  React.useEffect(() => {
    palOpenRef.current = palOpen;
  }, [palOpen]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      /* pass-through rule (2026-10-22): keystrokes originating in
       * INPUT / TEXTAREA / SELECT / contentEditable are never
       * intercepted — the single exception is the Cmd/Ctrl+K chord
       * itself, which must also work mid-typing. Escape only acts
       * while the palette is open (its input is the focus then). */
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalOpen((v) => !v);
      } else if (e.key === "Escape" && palOpenRef.current) {
        setPalOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const palItems: PalItem[] = [
    {
      tid: "overview",
      kind: "导航",
      label: "返回总览",
      en: "OVERVIEW",
      hint: view ? "退出当前视图" : sel ? "清除聚焦" : "总览",
      run: () => {
        if (view) backToOverview();
        else setSel(null);
      },
    },
    ...modules.map((m) => ({
      tid: `mod-${m.id}`,
      kind: "模块" as const,
      label: m.label,
      en: m.en,
      hint: m.countText ?? `条目 ${m.count ?? 0}`,
      run: () => openModule(m.id),
    })),
    ...decisions.map((d) => ({
      tid: `dec-${d.note ?? d.target ?? d.en}`,
      kind: "决策" as const,
      label: d.name,
      en: d.en,
      hint: d.tag,
      run: () => openDecision(d),
    })),
  ];
  const palQ = palQuery.trim().toLowerCase();
  const palList = palItems.filter(
    (it) => !palQ || `${it.label} ${it.en}`.toLowerCase().includes(palQ),
  );

  React.useEffect(() => {
    if (palOpen) {
      /* remember who had focus so close can hand it back */
      palReturnFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setPalQuery("");
      setPalIdx(0);
      const raf = requestAnimationFrame(() => palInputRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
    const back = palReturnFocus.current;
    palReturnFocus.current = null;
    if (back && document.contains(back)) back.focus();
    return undefined;
  }, [palOpen]);

  /* focus trap: Tab / Shift+Tab cycle inside the panel only */
  const onPalPanelKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const root = palPanelRef.current;
    if (!root) return;
    const focusables = [
      ...root.querySelectorAll<HTMLElement>("input, button"),
    ].filter((el) => !el.hasAttribute("disabled"));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  React.useEffect(() => {
    if (palIdx >= palList.length) {
      setPalIdx(Math.max(0, palList.length - 1));
    }
  }, [palIdx, palList.length]);

  React.useEffect(() => {
    if (!palOpen) return;
    const it = palList[palIdx];
    if (it) {
      palItemEls.current.get(it.tid)?.scrollIntoView({ block: "nearest" });
    }
    // palList is rebuilt per render; index/open changes are the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palIdx, palOpen]);

  const palRun = (it: PalItem) => {
    setPalOpen(false);
    it.run();
  };
  const onPalKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPalIdx((i) => (palList.length ? (i + 1) % palList.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPalIdx((i) =>
        palList.length ? (i - 1 + palList.length) % palList.length : 0,
      );
    } else if (e.key === "Enter") {
      const it = palList[palIdx];
      if (it) palRun(it);
    }
  };
  /* bottom-sheet drag-down to close: tracked on the sheet head
   * (grip + input), never on the scrolling list. */
  const palTouchY = React.useRef<number | null>(null);
  const onPalTouchStart = (e: React.TouchEvent) => {
    palTouchY.current = e.touches[0]?.clientY ?? null;
  };
  const onPalTouchEnd = (e: React.TouchEvent) => {
    const y0 = palTouchY.current;
    palTouchY.current = null;
    if (y0 == null) return;
    const y1 = e.changedTouches[0]?.clientY ?? y0;
    if (y1 - y0 > 56) setPalOpen(false);
  };

  /* ── drag & drop engine (2026-10-22, hud-drag-engine) ──
   * Press-and-drag a decision row or a tree row: past a 10px
   * threshold the press becomes a drag — a full-screen canvas
   * overlay draws a glass rail + flowing energy line from the grab
   * point to the cursor, module anchors (console cards, tree rows,
   * nine design hotspots on the sphere disc) magnetise within
   * 90px, and releasing over an anchor runs a 600ms comet pulse
   * along the curve and dispatches onDrop(sourceId, targetId).
   * The drop is event-only: nothing is persisted, no data
   * ownership changes, no "bound" copy appears. Below the
   * threshold the press stays a plain click; the suppression flag
   * only ever eats the single click that trails a completed drag. */
  type DragAnchor = {
    id: string;
    kind: "card" | "tree" | "orb";
    cx: number;
    cy: number;
    color: string;
    el: Element | null;
  };
  type DragCurve = {
    x0: number; y0: number; cx: number; cy: number; x1: number; y1: number;
  };
  type DragState = {
    pointerId: number;
    pointerType: string;
    /** ≤1100px mobile mode: anchors are the drag-rail chips + orb
     * hotspots (desktop cards are display:none there), the open
     * sheet minimises while dragging, and haptics may fire. */
    mobile: boolean;
    railTimer: number;
    srcId: string;
    srcEl: Element;
    color: string;
    originX: number;
    originY: number;
    x: number;
    y: number;
    endX: number;
    endY: number;
    active: boolean;
    anchors: DragAnchor[];
    hot: DragAnchor | null;
    phase: "drag" | "pulse" | "fade";
    pulseStart: number;
    fadeStart: number;
    pulseTarget: DragAnchor | null;
    curve: DragCurve | null;
    lowFx: boolean;
    cleanup: () => void;
  };
  const dragCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const dragRef = React.useRef<DragState | null>(null);
  const dragRafRef = React.useRef(0);
  const dragSuppressRef = React.useRef(false);
  const DRAG_THRESHOLD = 10;
  const DRAG_SNAP_R = 90;
  const dragPulseMs = () => {
    /* QA may stretch the pulse to catch a mid-flight screenshot;
     * production value is 600ms. */
    const w = window as unknown as { __hudPulseMs?: unknown };
    return typeof w.__hudPulseMs === "number" && w.__hudPulseMs > 0
      ? w.__hudPulseMs
      : 600;
  };
  const dragCurveFor = (
    x0: number, y0: number, x1: number, y1: number,
  ): DragCurve => {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const sag = Math.min(80, d * 0.16);
    return { x0, y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 + sag, x1, y1 };
  };
  const dragBezPt = (c: DragCurve, t: number) => {
    const u = 1 - t;
    return {
      x: u * u * c.x0 + 2 * u * t * c.cx + t * t * c.x1,
      y: u * u * c.y0 + 2 * u * t * c.cy + t * t * c.y1,
    };
  };
  const consumeDragSuppress = () => {
    if (dragSuppressRef.current) {
      dragSuppressRef.current = false;
      return true;
    }
    return false;
  };
  const sizeDragCanvas = () => {
    const c = dragCanvasRef.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(window.innerWidth * dpr);
    c.height = Math.round(window.innerHeight * dpr);
    c.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const clearDragCanvas = () => {
    const c = dragCanvasRef.current;
    const ctx = c?.getContext("2d");
    if (c && ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  };
  const fireDrop = (sourceId: string, targetId: string) => {
    const w = window as unknown as {
      __hudLastDrop?: {
        sourceId: string; targetId: string; source: string; target: string;
      };
      __hudOnDrop?: (sourceId: string, targetId: string) => void;
    };
    w.__hudLastDrop = { sourceId, targetId, source: sourceId, target: targetId };
    try {
      w.__hudOnDrop?.(sourceId, targetId);
    } catch {
      /* a registered listener must never break the drop itself */
    }
  };
  /* Haptic tick (2026-10-22, hud-mobile-nav): touch drags — and
   * any drag in mobile mode — get a 10ms vibrate on snap acquisition
   * and on delivery. Desktop mouse drags stay silent; unsupported
   * APIs are skipped quietly. */
  const buzz = (s: DragState) => {
    if (s.pointerType !== "touch" && !s.mobile) return;
    try {
      navigator.vibrate?.(10);
    } catch {
      /* API present but blocked — the drop itself must not break */
    }
  };
  const finishDragPulse = () => {
    const s = dragRef.current;
    if (!s) return;
    const target = s.pulseTarget;
    dragRef.current = null;
    clearDragCanvas();
    document.querySelector(".hud-root")?.classList.remove("hud-drop-pulse");
    if (target) {
      buzz(s);
      if (target.el) {
        const el = target.el;
        el.classList.add("hud-drop-done");
        window.setTimeout(() => el.classList.remove("hud-drop-done"), 340);
      }
      fireDrop(s.srcId, target.id);
    }
  };
  const drawDragFrame = (now: number) => {
    const canvas = dragCanvasRef.current;
    const s = dragRef.current;
    if (!canvas || !s) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    if (s.phase === "pulse" && s.curve && s.pulseTarget) {
      /* comet pulse: white-hot head, beam-colour trail of fading
       * samples behind it along the same curve (fibre afterglow). */
      const c = s.curve;
      const t = Math.min(1, Math.max(0, (now - s.pulseStart) / dragPulseMs()));
      const ease = 1 - (1 - t) * (1 - t);
      const col = s.pulseTarget.color;
      const trailN = s.lowFx ? 7 : 14;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(c.x0, c.y0);
      ctx.quadraticCurveTo(c.cx, c.cy, c.x1, c.y1);
      ctx.strokeStyle = "rgba(0, 255, 255, 0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();
      for (let i = trailN; i >= 1; i -= 1) {
        const tt = ease - i * 0.026;
        if (tt < 0) continue;
        const p = dragBezPt(c, tt);
        const f = 1 - i / (trailN + 1);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 0.6 + 4.4 * f, 0, Math.PI * 2);
        ctx.globalAlpha = 0.75 * f * f;
        ctx.fillStyle = col;
        ctx.fill();
      }
      const head = dragBezPt(c, ease);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(head.x, head.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = col;
      if (!s.lowFx) {
        ctx.shadowColor = col;
        ctx.shadowBlur = 16;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(head.x, head.y, 2.8, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.restore();
      return;
    }
    if (s.phase !== "drag" && s.phase !== "fade") return;
    let alpha = 1;
    if (s.phase === "fade") {
      alpha = Math.max(0, 1 - (now - s.fadeStart) / 100);
    }
    if (alpha <= 0) return;
    const c = dragCurveFor(s.originX, s.originY, s.endX, s.endY);
    ctx.save();
    /* sphere hotspots fade in while dragging — the disc reads as a
     * drop surface too, not just the cards and tree rows. */
    for (const a of s.anchors) {
      if (a.kind !== "orb") continue;
      ctx.globalAlpha = alpha * 0.4;
      ctx.beginPath();
      ctx.arc(a.cx, a.cy, 8, 0, Math.PI * 2);
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(a.cx, a.cy, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = a.color;
      ctx.fill();
    }
    ctx.globalAlpha = alpha;
    /* 1 · glass rail: a 1px near-invisible solid line under the
     * flow, so the dashes read as light inside a physical pipe. */
    ctx.beginPath();
    ctx.moveTo(c.x0, c.y0);
    ctx.quadraticCurveTo(c.cx, c.cy, c.x1, c.y1);
    ctx.strokeStyle = "rgba(0, 255, 255, 0.14)";
    ctx.lineWidth = 1;
    ctx.stroke();
    /* 2 · energy flow: flowing dashes in the target beam colour */
    const flowCol = s.hot ? s.hot.color : s.color;
    ctx.beginPath();
    ctx.moveTo(c.x0, c.y0);
    ctx.quadraticCurveTo(c.cx, c.cy, c.x1, c.y1);
    ctx.strokeStyle = flowCol;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -now / 16;
    if (!s.lowFx) {
      ctx.shadowColor = flowCol;
      ctx.shadowBlur = 8;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
    /* grab point */
    ctx.beginPath();
    ctx.arc(s.originX, s.originY, 3, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.fill();
    /* snapped sphere hotspot: breathing alert ring */
    if (s.hot && s.hot.kind === "orb") {
      ctx.beginPath();
      ctx.arc(s.hot.cx, s.hot.cy, 17 + 5 * Math.sin(now / 150), 0, Math.PI * 2);
      ctx.strokeStyle = "#ff007f";
      ctx.lineWidth = 2;
      if (!s.lowFx) {
        ctx.shadowColor = "#ff007f";
        ctx.shadowBlur = 12;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  };
  const dragLoop = (now: number) => {
    dragRafRef.current = 0;
    const s = dragRef.current;
    if (!s) return;
    drawDragFrame(now);
    if (s.phase === "pulse" && now - s.pulseStart >= dragPulseMs()) {
      finishDragPulse();
      return;
    }
    if (s.phase === "fade" && now - s.fadeStart >= 100) {
      clearDragCanvas();
      dragRef.current = null;
      return;
    }
    dragRafRef.current = requestAnimationFrame(dragLoop);
  };
  const ensureDragLoop = () => {
    if (!dragRafRef.current) {
      dragRafRef.current = requestAnimationFrame(dragLoop);
    }
  };
  React.useEffect(
    () => () => {
      dragRef.current?.cleanup();
      dragRef.current = null;
      document.querySelector(".hud-root")?.classList.remove("hud-drop-pulse");
      if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = 0;
    },
    [],
  );
  /* Anchors are measured once per press (at pointerdown) and
   * cached for the whole gesture — no layout reads while moving.
   * Mobile mode swaps the target set: the desktop cards are
   * display:none (zero rects) and the tree lives in a sheet that
   * minimises mid-drag, so the drag rail's chips — re-measured once
   * the rail has risen — are the module targets instead. */
  const measureDragAnchors = (mobile = false, railUp = false): DragAnchor[] => {
    const out: DragAnchor[] = [];
    /* in mobile mode the chips only count once the rail has risen —
     * before that they sit below the fold and would false-snap
     * drags that pass near the bottom edge. */
    const cardSel = mobile
      ? railUp
        ? ".hud-rail-chip[data-module]"
        : null
      : ".hud-card[data-module]";
    if (cardSel) {
      document.querySelectorAll<HTMLElement>(cardSel).forEach((el) => {
        const m = modById(el.dataset.module ?? "");
        if (!m) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;
        out.push({
          id: m.id, kind: "card",
          cx: r.left + r.width / 2, cy: r.top + r.height / 2,
          color: m.color, el,
        });
      });
    }
    if (!mobile) {
      document
        .querySelectorAll<SVGRectElement>("[data-testid^='hud-tree-row-']")
        .forEach((el) => {
          const m = modById((el.dataset.testid ?? "").replace("hud-tree-row-", ""));
          if (!m) return;
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return;
          out.push({
            id: m.id, kind: "tree",
            cx: r.left + r.width / 2, cy: r.top + r.height / 2,
            color: m.color, el,
          });
        });
    }
    const sphere = document.querySelector(".hud-sphere");
    if (sphere) {
      /* design anchors on the disc: the eight ring modules around,
       * the HUB (modules[8], 创作空间) at the centre. */
      const r = sphere.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const rad = Math.min(r.width, r.height) / 2;
      modules.slice(0, 9).forEach((m, i) => {
        const spot =
          i === 8
            ? { dx: 0, dy: 0 }
            : {
                dx: Math.cos((i * Math.PI) / 4 - Math.PI / 2) * 0.58,
                dy: Math.sin((i * Math.PI) / 4 - Math.PI / 2) * 0.58,
              };
        out.push({
          id: m.id, kind: "orb",
          cx: cx + spot.dx * rad, cy: cy + spot.dy * rad,
          color: m.color, el: null,
        });
      });
    }
    return out;
  };
  const onDragMove = (ev: PointerEvent) => {
    const s = dragRef.current;
    if (!s || ev.pointerId !== s.pointerId) return;
    s.x = ev.clientX;
    s.y = ev.clientY;
    if (!s.active) {
      if (Math.hypot(s.x - s.originX, s.y - s.originY) < DRAG_THRESHOLD) return;
      s.active = true;
      document
        .querySelector(".hud-root")
        ?.classList.add("hud-dragging");
      sizeDragCanvas();
      ensureDragLoop();
      if (s.mobile) {
        /* the drag rail rises on .hud-dragging (CSS transition);
         * once it has settled, re-measure so the chips become the
         * anchor set. The line origin stays the grab point — the
         * minimising sheet must not make the line jump. */
        s.railTimer = window.setTimeout(() => {
          if (dragRef.current === s && s.active) {
            s.anchors = measureDragAnchors(true, true);
          }
        }, 300);
      }
    }
    let best: DragAnchor | null = null;
    let bestD = DRAG_SNAP_R;
    for (const a of s.anchors) {
      if (a.el && a.el === s.srcEl) continue;
      const d = Math.hypot(s.x - a.cx, s.y - a.cy);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    if (best !== s.hot) {
      s.hot?.el?.classList.remove("hud-drop-hot");
      s.hot = best;
      best?.el?.classList.add("hud-drop-hot");
      /* snap acquired (or switched target): one haptic tick */
      if (best) buzz(s);
    }
    if (best) {
      /* magnetic pull: the closer the cursor, the harder the line
       * end is drawn onto the anchor centre (1 at contact). */
      const k = 1 - bestD / DRAG_SNAP_R;
      s.endX = s.x + (best.cx - s.x) * k;
      s.endY = s.y + (best.cy - s.y) * k;
    } else {
      s.endX = s.x;
      s.endY = s.y;
    }
  };
  const onDragUp = (ev: PointerEvent) => {
    const s = dragRef.current;
    if (!s || ev.pointerId !== s.pointerId) return;
    if (!s.active) {
      /* below the threshold: a plain click — leave it to the
       * element's own onClick, untouched. */
      dragRef.current = null;
      return;
    }
    dragSuppressRef.current = true;
    /* a missed click event must not eat a later genuine click */
    window.setTimeout(() => {
      dragSuppressRef.current = false;
    }, 400);
    document.querySelector(".hud-root")?.classList.remove("hud-dragging");
    s.hot?.el?.classList.remove("hud-drop-hot");
    if (s.hot) {
      /* keep the drag rail up (and the sheet minimised) until the
       * pulse has landed — finishDragPulse removes this class. */
      document.querySelector(".hud-root")?.classList.add("hud-drop-pulse");
      s.phase = "pulse";
      s.pulseStart = performance.now();
      s.pulseTarget = s.hot;
      s.curve = dragCurveFor(s.originX, s.originY, s.hot.cx, s.hot.cy);
      s.hot = null;
      ensureDragLoop();
    } else {
      s.phase = "fade";
      s.fadeStart = performance.now();
      ensureDragLoop();
    }
  };
  const startDrag = (
    e: React.PointerEvent,
    src: { id: string; color: string },
  ) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (dragRef.current) return;
    const el = e.currentTarget as Element;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointers may not be capturable; the window
       * listeners below still receive the whole gesture. */
    }
    const isMobile = window.matchMedia("(max-width: 1100px)").matches;
    const s: DragState = {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      mobile: isMobile,
      railTimer: 0,
      srcId: src.id,
      srcEl: el,
      color: src.color,
      originX: e.clientX,
      originY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      endX: e.clientX,
      endY: e.clientY,
      active: false,
      anchors: measureDragAnchors(isMobile),
      hot: null,
      phase: "drag",
      pulseStart: 0,
      fadeStart: 0,
      pulseTarget: null,
      curve: null,
      lowFx: window.matchMedia("(max-width: 768px)").matches,
      cleanup: () => undefined,
    };
    const move = (ev: PointerEvent) => onDragMove(ev);
    const up = (ev: PointerEvent) => {
      s.cleanup();
      onDragUp(ev);
    };
    s.cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (s.railTimer) window.clearTimeout(s.railTimer);
    };
    dragRef.current = s;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const decisionDragColor = (d: (typeof decisions)[number]) =>
    (d.module ? modById(d.module)?.color : undefined) ??
    (d.note === "xhs" ? "#B200FF" : d.note === "x" ? "#FF007F" : "#00FFFF");

  /* ── radial menu + zen mode (2026-10-22, hud-radial) ──
   * The wheel (radial-menu.tsx) and the palette are mutually
   * exclusive: its onOpenChange closes the palette here, and
   * siblingOpen={palOpen} force-closes the wheel there. A long-press
   * summon cancels the press the drag engine is still holding
   * (below-threshold, never activated) and arms the same one-shot
   * click suppression a completed drag uses, so the release that
   * picks a sector can't also click the row underneath. Zen is a
   * temporary visual state only — never persisted, refresh exits. */
  const [zen, setZen] = React.useState(false);
  /* 灵感拓扑 (hud-mindmap): a stage overlay above the overview's
   * centre — its state and persistence live in mind-map.tsx. */
  const [mmOpen, setMmOpen] = React.useState(false);
  const radialOpenRef = React.useRef(false);
  const cancelPendingDrag = React.useCallback(() => {
    const s = dragRef.current;
    if (s) {
      const wasActive = s.active;
      s.cleanup();
      dragRef.current = null;
      if (wasActive) {
        document
          .querySelector(".hud-root")
          ?.classList.remove("hud-dragging");
        clearDragCanvas();
      }
    }
    dragSuppressRef.current = true;
    window.setTimeout(() => {
      dragSuppressRef.current = false;
    }, 400);
  }, []);
  /* Esc leaves zen — unless the wheel or the palette is open, in
   * which case Esc belongs to that layer first. */
  React.useEffect(() => {
    if (!zen) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        !radialOpenRef.current &&
        !palOpenRef.current
      ) {
        setZen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zen]);

  return (
    <div
      className={cn(
        "hud-root",
        leaving && "hud-leaving",
        quick && "hud-quick",
        zen && "hud-zen",
      )}
      data-testid="studio-landing"
      data-quick={quick ? "1" : "0"}
      data-zen={zen ? "1" : "0"}
      data-msheet={msheet}
    >
      <div className="hud-wrap">
        {/* ══ TOP STATUS BAR ══ */}
        <div className="hud-panel hud-topbar">
          <div className="hud-logo">
            ◉ SECOND BRAIN <b>OS</b> · STUDIO
          </div>
          <div className="hud-metric">
            MODULES <b>{modules.length}</b>
          </div>
          <div className="hud-metric">
            ENTRIES <b>{total}</b>
          </div>
          <div className="hud-metric">
            SKILLS <b>{skillsN}</b>
          </div>
          <div className="hud-metric">
            AGENTS <b className="hud-c-grn">LUNA ●</b>{" "}
            <b className="hud-c-grn">GROKBOT ●</b>
          </div>
          <div className="hud-spark">
            MEM
            <svg width="64" height="14" viewBox="0 0 64 14" aria-hidden>
              <polyline
                points="0,10 8,8 16,9 24,5 32,7 40,4 48,6 56,3 63,5"
                fill="none"
                stroke="#00FFFF"
                strokeWidth="1.2"
                style={{ filter: "drop-shadow(0 0 3px #00FFFF)" }}
              />
            </svg>
          </div>
          <div className="hud-spark hud-spark-act">
            ACT
            <svg width="64" height="14" viewBox="0 0 64 14" aria-hidden>
              <polyline
                points="0,12 9,11 18,8 27,9 36,6 45,7 54,3 63,2"
                fill="none"
                stroke="#FF007F"
                strokeWidth="1.2"
                style={{ filter: "drop-shadow(0 0 3px #FF007F)" }}
              />
            </svg>
          </div>
          <div className="hud-top-right">
            <div className="hud-metric">
              SYNC{" "}
              {health.ok ? (
                <b className="hud-c-grn">● OK</b>
              ) : (
                <b className="hud-c-amb">● STALE</b>
              )}{" "}
              · HEALTH-SYNC → MAIN
            </div>
            <div className="hud-metric hud-top-hex">0x3F9A · SEC 07</div>
            <div className="hud-snap-group">
              <button
                type="button"
                className="hud-cmdk"
                data-testid="hud-snap-export"
                onClick={() => {
                  exportState();
                  showSnapNote("快照已导出（second-brain 备份文件）。");
                }}
              >
                <span className="hud-snap-long">导出快照</span>
                <span className="hud-snap-short">导出</span>
              </button>
              {snapPending ? (
                <span className="hud-snap-confirm-group">
                  <button
                    type="button"
                    className="hud-cmdk hud-snap-danger"
                    data-testid="hud-snap-import-confirm"
                    onClick={runSnapImport}
                  >
                    确认覆盖导入？
                  </button>
                  <button
                    type="button"
                    className="hud-cmdk"
                    data-testid="hud-snap-import-cancel"
                    onClick={() => armSnapPending(null)}
                  >
                    取消
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="hud-cmdk"
                  data-testid="hud-snap-import"
                  onClick={() => snapFileRef.current?.click()}
                >
                  <span className="hud-snap-long">导入还原</span>
                  <span className="hud-snap-short">导入</span>
                </button>
              )}
              {snapHasBackup &&
                (snapUndoArmed ? (
                  <span className="hud-snap-confirm-group">
                    <button
                      type="button"
                      className="hud-cmdk hud-snap-danger"
                      data-testid="hud-snap-undo-confirm"
                      onClick={runSnapUndo}
                    >
                      确认撤销？
                    </button>
                    <button
                      type="button"
                      className="hud-cmdk"
                      data-testid="hud-snap-undo-cancel"
                      onClick={() => setSnapUndoArmed(false)}
                    >
                      取消
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="hud-cmdk"
                    data-testid="hud-snap-undo"
                    onClick={() => setSnapUndoArmed(true)}
                  >
                    撤销导入
                  </button>
                ))}
              <input
                ref={snapFileRef}
                type="file"
                accept=".json,application/json"
                data-testid="hud-snap-file"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  if (f) armSnapPending(f);
                }}
              />
            </div>
            <button
              type="button"
              className="hud-cmdk"
              data-testid="hud-cmdk-hint"
              onClick={() => setPalOpen(true)}
              aria-label="打开命令面板 (Cmd+K)"
            >
              ⌘K
            </button>
            <div className="hud-clock" data-testid="hud-clock">
              {clock}
            </div>
          </div>
        </div>

        {/* ══ SNAPSHOT STATUS NOTE ══ */}
        {snapNote && (
          <div className="hud-snap-note" data-testid="hud-snap-note" role="status">
            {snapNote}
          </div>
        )}

        {/* ══ TICKER ══ */}
        <div className="hud-panel hud-ticker">
          <span className="hud-live">● LIVE</span>
          <div className="hud-track">
            <div className="hud-track-inner">
              {[0, 1].map((k) => (
                <span className="hud-txt" key={k} aria-hidden={k === 1 || undefined}>
                  九大模块 <i>·</i> 一个第二大脑 <i>·</i> NINE MODULES <u>·</u>{" "}
                  ONE SECOND BRAIN <i>·</i>{" "}
                  {health.ok ? "HEALTH-SYNC OK" : "HEALTH-SYNC STALE"} <u>·</u>{" "}
                  EP001 PENDING PUBLISH <i>·</i> X PAUSED <u>·</u> XHS PAUSED{" "}
                  <i>·</i>
                </span>
              ))}
            </div>
          </div>
        </div>

        {viewMod ? (
          <HudModuleContent
            id={viewMod.id}
            label={viewMod.label}
            en={viewMod.en}
            color={viewMod.color}
            count={viewMod.count}
            countText={viewMod.countText}
            onBack={backToOverview}
            onOpen={openModule}
          />
        ) : noteKind ? (
          <HudDecisionNote kind={noteKind} onBack={backToOverview} />
        ) : (
          <>
        {/* ══ MAIN ══ */}
        <div className="hud-main">
          {/* LEFT · THE ORB TREE (bottom sheet at ≤1100px) */}
          <div
            className="hud-panel hud-tree"
            ref={treePanelRef}
            data-testid="hud-tree-panel"
            data-flash={
              msheet === "tree" && treeFlash ? treeFlash.group : undefined
            }
          >
            <div
              className="hud-sheet-head"
              onTouchStart={onSheetTouchStart}
              onTouchEnd={onSheetTouchEnd}
            >
              <div className="hud-sheet-grip" aria-hidden />
              <div className="hud-phead">
                <span className="hud-t">THE ORB · 模块树</span>
                <span className="hud-chip hud-c-cyan">TREE</span>
                <span className="hud-hex">0x0RB1</span>
              </div>
            </div>
            <div className="hud-treebody">
              <svg viewBox="0 0 276 472" role="img" aria-label="模块树">
                <defs>
                  <filter id="hud-glow" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="2.2" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {[hov, sel].map((id, i) => {
                  if (!id) return null;
                  const m = modById(id);
                  if (!m) return null;
                  return (
                    <rect
                      key={`${i}-${id}`}
                      x="4"
                      y={treeRowY(id) - 14}
                      width="268"
                      height="28"
                      fill={m.color}
                      opacity={i === 1 ? 0.13 : 0.06}
                      stroke={m.color}
                      strokeOpacity={i === 1 ? 0.55 : 0.25}
                    />
                  );
                })}
                <line x1="14" y1="24" x2="14" y2="426" stroke="#3d5a86" strokeWidth="1.6" strokeLinecap="square" />
                <line x1="14" y1="24" x2="14" y2="426" stroke="#00FFFF" strokeWidth="2" className="hud-flow-line" />
                <circle cx="14" cy="24" r="6.5" fill="#FFEA00" filter="url(#hud-glow)" />
                <circle cx="14" cy="24" r="5.5" fill="none" stroke="#FFEA00" strokeWidth="1" className="hud-wave-circle" />
                <text x="27" y="28" fontSize="11.5" fill="#ffffff" letterSpacing="1">第二大脑</text>
                <text x="86" y="28" fontSize="8.5" fill="#5f7194" letterSpacing="1">SECOND BRAIN</text>
                <text x="266" y="28" fontSize="13" fill="#FF007F" textAnchor="end">{total}</text>
                <line x1="14" y1="56" x2="34" y2="56" stroke="#FF007F" strokeWidth="1.5" strokeLinecap="square" />
                <line x1="14" y1="56" x2="34" y2="56" stroke="#FF007F" strokeWidth="2" className="hud-flow-line" />
                <circle cx="34" cy="56" r="5.2" fill="#FF007F" filter="url(#hud-glow)" />
                <circle cx="34" cy="56" r="5.2" fill="none" stroke="#FF007F" strokeWidth="0.7" className="hud-wave-circle" style={{ animationDelay: ".6s" }} />
                <text x="46" y="60" fontSize="10.5" fill="#ffb3d6" data-treegroup="create">创作</text>
                <text x="74" y="60" fontSize="8.5" fill="#5f7194" letterSpacing="1" data-treegroup="create">CREATE</text>
                <line x1="34" y1="56" x2="34" y2="146" stroke="#7a2b52" strokeWidth="1.5" strokeLinecap="square" />
                <line x1="34" y1="86" x2="56" y2="86" stroke="#00FFFF" strokeWidth="1.5" strokeLinecap="square" />
                <circle cx="56" cy="86" r="3.4" fill="#00FFFF" filter="url(#hud-glow)" />
                <text x="67" y="90" fontSize="10.5" fill="#e8f4ff" className="hud-tree-label" ref={scramble.register("studio")} data-testid="hud-tree-label-studio">创作空间</text>
                <text x="120" y="90" fontSize="8" fill="#5f7194">STUDIO</text>
                <text x="266" y="90" fontSize="11" fill="#00FFFF" textAnchor="end">HUB</text>
                <line x1="34" y1="116" x2="56" y2="116" stroke="#FF007F" strokeWidth="1.5" strokeLinecap="square" />
                <circle cx="56" cy="116" r="3.4" fill="#FF007F" filter="url(#hud-glow)" />
                <text x="67" y="120" fontSize="10.5" fill="#e8f4ff" className="hud-tree-label" ref={scramble.register("works")} data-testid="hud-tree-label-works">作品库</text>
                <text x="110" y="120" fontSize="8" fill="#5f7194">WORKS</text>
                {treeBlocks("works", worksN, 116, "#FF007F")}
                <text x="266" y="120" fontSize="11" fill={cntFill(worksN)} textAnchor="end">{worksN}</text>
                <line x1="34" y1="146" x2="56" y2="146" stroke="#B200FF" strokeWidth="1.5" strokeLinecap="square" />
                <circle cx="56" cy="146" r="3.4" fill="#B200FF" filter="url(#hud-glow)" />
                <text x="67" y="150" fontSize="10.5" fill="#e8f4ff" className="hud-tree-label" ref={scramble.register("skills")} data-testid="hud-tree-label-skills">技能库</text>
                <text x="110" y="150" fontSize="8" fill="#5f7194">SKILLS</text>
                {treeBlocks("skills", skillsN, 146, "#B200FF")}
                <text x="266" y="150" fontSize="11" fill={cntFill(skillsN)} textAnchor="end">{skillsN}</text>
                <line x1="14" y1="196" x2="34" y2="196" stroke="#B200FF" strokeWidth="1.5" strokeLinecap="square" />
                <line x1="14" y1="196" x2="34" y2="196" stroke="#B200FF" strokeWidth="2" className="hud-flow-line" />
                <circle cx="34" cy="196" r="5.2" fill="#B200FF" filter="url(#hud-glow)" />
                <circle cx="34" cy="196" r="5.2" fill="none" stroke="#B200FF" strokeWidth="0.7" className="hud-wave-circle" style={{ animationDelay: "1.2s" }} />
                <text x="46" y="200" fontSize="10.5" fill="#e3c2ff" data-treegroup="knowledge">知识</text>
                <text x="74" y="200" fontSize="8.5" fill="#5f7194" letterSpacing="1" data-treegroup="knowledge">KNOWLEDGE</text>
                <line x1="34" y1="196" x2="34" y2="256" stroke="#4d2680" strokeWidth="1.5" strokeLinecap="square" />
                <line x1="34" y1="226" x2="56" y2="226" stroke="#00FFFF" strokeWidth="1.5" strokeLinecap="square" />
                <circle cx="56" cy="226" r="3.4" fill="#00FFFF" filter="url(#hud-glow)" />
                <text x="67" y="230" fontSize="10.5" fill="#e8f4ff" className="hud-tree-label" ref={scramble.register("database")} data-testid="hud-tree-label-database">数据库</text>
                <text x="110" y="230" fontSize="8" fill="#5f7194">DATABASE</text>
                {treeBlocks("database", dbN, 226, "#00FFFF")}
                <text x="266" y="230" fontSize="11" fill={cntFill(dbN)} textAnchor="end">{dbN}</text>
                <line x1="34" y1="256" x2="56" y2="256" stroke="#54678a" strokeWidth="1.5" strokeLinecap="square" />
                <circle cx="56" cy="256" r="3.4" fill="#54678a" filter="url(#hud-glow)" />
                <text x="67" y="260" fontSize="10.5" fill="#e8f4ff" className="hud-tree-label" ref={scramble.register("ontology")} data-testid="hud-tree-label-ontology">本体知识库</text>
                <text x="132" y="260" fontSize="8" fill="#5f7194">ONTOLOGY</text>
                <text x="266" y="260" fontSize="11" fill={cntFill(ontoN)} textAnchor="end">{ontoN}</text>
                {treeBlocks("ontology", ontoN, 256, "#54678a")}
                <line x1="14" y1="306" x2="34" y2="306" stroke="#00FFFF" strokeWidth="1.5" strokeLinecap="square" />
                <line x1="14" y1="306" x2="34" y2="306" stroke="#00FFFF" strokeWidth="2" className="hud-flow-line" />
                <circle cx="34" cy="306" r="5.2" fill="#00FFFF" filter="url(#hud-glow)" />
                <circle cx="34" cy="306" r="5.2" fill="none" stroke="#00FFFF" strokeWidth="0.7" className="hud-wave-circle" style={{ animationDelay: "1.8s" }} />
                <text x="46" y="310" fontSize="10.5" fill="#b3f7ff" data-treegroup="life">生活</text>
                <text x="74" y="310" fontSize="8.5" fill="#5f7194" letterSpacing="1" data-treegroup="life">LIFE</text>
                <line x1="34" y1="306" x2="34" y2="426" stroke="#1f5f6b" strokeWidth="1.5" strokeLinecap="square" />
                <line x1="34" y1="336" x2="56" y2="336" stroke="#54678a" strokeWidth="1.5" strokeLinecap="square" />
                <circle cx="56" cy="336" r="3.4" fill="#54678a" filter="url(#hud-glow)" />
                <text x="67" y="340" fontSize="10.5" fill="#e8f4ff" className="hud-tree-label" ref={scramble.register("inspiration")} data-testid="hud-tree-label-inspiration">灵感池</text>
                <text x="110" y="340" fontSize="8" fill="#5f7194">INSPIRATION</text>
                <text x="266" y="340" fontSize="11" fill={cntFill(ideasN)} textAnchor="end">{ideasN}</text>
                {treeBlocks("inspiration", ideasN, 336, "#54678a")}
                <line x1="34" y1="366" x2="56" y2="366" stroke="#54678a" strokeWidth="1.5" strokeLinecap="square" />
                <circle cx="56" cy="366" r="3.4" fill="#54678a" filter="url(#hud-glow)" />
                <text x="67" y="370" fontSize="10.5" fill="#e8f4ff" className="hud-tree-label" ref={scramble.register("calendar")} data-testid="hud-tree-label-calendar">日历表</text>
                <text x="110" y="370" fontSize="8" fill="#5f7194">CALENDAR</text>
                <text x="266" y="370" fontSize="11" fill={cntFill(calN)} textAnchor="end">{calN}</text>
                {treeBlocks("calendar", calN, 366, "#54678a")}
                <line x1="34" y1="396" x2="56" y2="396" stroke="#ffb03a" strokeWidth="1.5" strokeLinecap="square" />
                <circle cx="56" cy="396" r="3.4" fill="#ffb03a" filter="url(#hud-glow)" />
                <text x="67" y="400" fontSize="10.5" fill="#e8f4ff" className="hud-tree-label" ref={scramble.register("health")} data-testid="hud-tree-label-health">身体健康</text>
                <text x="120" y="400" fontSize="8" fill="#5f7194">HEALTH</text>
                <text x="266" y="400" fontSize="11" fill="#ffb03a" textAnchor="end">{healthN}</text>
                {treeBlocks("health", healthN, 396, "#ffb03a")}
                <line x1="34" y1="426" x2="56" y2="426" stroke="#FFEA00" strokeWidth="1.5" strokeLinecap="square" />
                <circle cx="56" cy="426" r="3.4" fill="#FFEA00" filter="url(#hud-glow)" />
                <text x="67" y="430" fontSize="10.5" fill="#e8f4ff" className="hud-tree-label" ref={scramble.register("finance")} data-testid="hud-tree-label-finance">财务系统</text>
                <text x="120" y="430" fontSize="8" fill="#5f7194">FINANCE</text>
                {treeBlocks("finance", finN, 426, "#FFEA00")}
                <text x="266" y="430" fontSize="11" fill={cntFill(finN)} textAnchor="end">{finN}</text>
                <text x="14" y="462" fontSize="8.5" fill="#41516e" letterSpacing="1">[ DEPTH 3 · NODES 13 · BLOCKS = SHARE ]</text>
                {/* hover decode marks: SVG <text> has no ::before/::after,
                 * so the > < pair are real text nodes flanking the label,
                 * lit while the row is hovered. The group is display:none
                 * unless (hover:hover) and (pointer:fine) — see globals. */}
                <g className="hud-tree-marks" aria-hidden>
                  {treeRows.map((r) => {
                    const m = modById(r.id);
                    if (!m) return null;
                    return (
                      <React.Fragment key={r.id}>
                        <text
                          className="hud-tree-mark"
                          x={60.5}
                          y={r.y + 4}
                          fontSize="9"
                          style={{ opacity: hov === r.id ? 1 : 0 }}
                        >
                          {">"}
                        </text>
                        <text
                          className="hud-tree-mark"
                          x={67 + m.label.length * 10.5 + 3}
                          y={r.y + 4}
                          fontSize="9"
                          style={{ opacity: hov === r.id ? 1 : 0 }}
                        >
                          {"<"}
                        </text>
                      </React.Fragment>
                    );
                  })}
                </g>
                {treeRows.map((r) => (
                  <rect
                    key={r.id}
                    x="0"
                    y={r.y - 14}
                    width="276"
                    height="28"
                    fill="transparent"
                    className="hud-tree-hit"
                    style={{ cursor: "pointer" }}
                    data-testid={`hud-tree-row-${r.id}`}
                    onPointerDown={(e) =>
                      startDrag(e, {
                        id: r.id,
                        color: modById(r.id)?.color ?? "#00FFFF",
                      })
                    }
                    onClick={() => {
                      if (consumeDragSuppress()) return;
                      scramble.tap(r.id, modById(r.id)?.label ?? "");
                      focusOrOpen(r.id);
                    }}
                    onMouseEnter={() => {
                      setHov(r.id);
                      scramble.start(r.id, modById(r.id)?.label ?? "");
                    }}
                    onMouseLeave={() => {
                      setHov(null);
                      scramble.stop(r.id, modById(r.id)?.label ?? "");
                    }}
                  >
                    <title>{modById(r.id)?.label}</title>
                  </rect>
                ))}
              </svg>
            </div>
            <div className="hud-log">
              <div className="hud-log-head">
                <span>&gt; TERMINAL_LOG</span>
                <span className="hud-led hud-led-g" />
              </div>
              <div className="hud-log-lines">
                <div style={{ color: "#8fa3c4" }}>
                  {health.ok
                    ? `[${health.syncTime ?? "--:--"}] SYNC health-sync.json → MAIN · OK`
                    : "[--:--] SYNC health-sync.json · STALE"}
                </div>
                <div>[BOOT] SKILLS LOADED · {skillsN} ENTRIES</div>
                {HUD_LOG_FACTS.map((l, li) =>
                  li === HUD_LOG_FACTS.length - 1 ? (
                    /* newest real event line: typewriter reveal
                     * (hud-restyle) — content is the existing log
                     * line itself, never a generated event. */
                    <div
                      key={l.text}
                      data-testid="hud-term-latest"
                      style={l.color ? { color: l.color } : undefined}
                    >
                      {typedTermLatest}
                    </div>
                  ) : (
                    <div key={l.text} style={l.color ? { color: l.color } : undefined}>
                      {l.text}
                    </div>
                  ),
                )}
                <div style={{ color: "var(--hud-yellow)" }}>
                  [NOW] AWAITING COMMAND{" "}
                  <span className="hud-term-caret" data-testid="hud-term-caret">
                    &gt;_
                  </span>
                </div>
              </div>
            </div>
            <div className="hud-foot">
              目标拆解 · <b>LATENT SPACE 周更</b> / X 个人 IP / 本体知识库填充
              <br />
              GOAL BREAKDOWN · SYNCED FROM GOALS
            </div>
          </div>

          {/* CENTER · CORE MAP */}
          <div className="hud-panel hud-center">
            <div className="hud-phead">
              <span className="hud-t">CORE MAP · 知识核心图谱</span>
              <span className="hud-chip hud-c-yel">FORCE GRAPH</span>
              <span className="hud-chip hud-c-pur">{total} NODES</span>
              <button
                type="button"
                className="hud-chip hud-c-cyan hud-mm-toggle"
                data-testid="hud-mm-toggle"
                onClick={() => setMmOpen((v) => !v)}
              >
                拓扑 MINDMAP
              </button>
              <span className="hud-hex">0xC0RE · [ + ] · GRID C3</span>
            </div>
            <div className="hud-curve">
              <div className="hud-lab">
                ACTIVITY CURVE · 条目增长
                <br />
                <b>0 → {total}</b> · LAST 30D
              </div>
              <svg viewBox="0 0 430 40" preserveAspectRatio="none" aria-hidden>
                <defs>
                  <linearGradient id="hud-ag" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#FFEA00" stopOpacity=".28" />
                    <stop offset="1" stopColor="#FFEA00" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M2,36 L50,34 L98,35 L146,30 L194,31 L242,24 L290,25 L338,16 L386,12 L428,5 L428,40 L2,40 Z"
                  fill="url(#hud-ag)"
                />
                <polyline
                  points="2,36 50,34 98,35 146,30 194,31 242,24 290,25 338,16 386,12 428,5"
                  fill="none"
                  stroke="#FFEA00"
                  strokeWidth="1.6"
                  style={{ filter: "drop-shadow(0 0 4px #FFEA00)" }}
                />
                <circle cx="428" cy="5" r="2.6" fill="#FFEA00" style={{ filter: "drop-shadow(0 0 5px #FFEA00)" }} />
                <circle cx="242" cy="24" r="2" fill="#fff2a8" />
                <circle cx="98" cy="35" r="2" fill="#fff2a8" />
              </svg>
              <div className="hud-lab" style={{ textAlign: "right" }}>
                PEAK <b>{total}</b>
                <br />Δ +{total} / 30D
              </div>
            </div>
            <div className="hud-stage">
              <div className="hud-sphere-glow" aria-hidden />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="hud-sphere"
                src="/studio/hud/core-sphere.webp"
                alt=""
                draggable={false}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="hud-jelly hud-jelly-a"
                src="/studio/hud/jelly-pink.webp"
                alt=""
                draggable={false}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="hud-jelly hud-jelly-b"
                src="/studio/hud/jelly-cyan.webp"
                alt=""
                draggable={false}
              />
              {selMod ? (
                <>
                  <div className="hud-tag hud-tag-main" style={{ left: 18, top: 14 }}>
                    ◈ MODULE · {selMod.en}
                    <b style={{ color: selMod.color }}>
                      {selMod.label} {selMod.countText ?? selMod.count}
                    </b>
                    ENTRIES {selMod.count ?? "—"} · SHARE {sharePct(selMod.count)}%
                  </div>
                  <div className="hud-tag hud-tag-aux" style={{ right: 140, top: 14, textAlign: "right" }}>
                    STATUS · {selMod.en} ◈
                    <b style={{ color: selMod.color }}>{moduleStatus(selMod).main}</b>
                    {moduleStatus(selMod).note}
                  </div>
                  <div className="hud-tag hud-tag-aux" style={{ left: 18, bottom: 8 }}>
                    [ NODE {selMod.label} · DEG {selMod.count ?? "—"} ] · [ SHARE{" "}
                    {sharePct(selMod.count)}% ]
                  </div>
                  <div className="hud-tag hud-tag-aux" style={{ right: 18, bottom: 8, textAlign: "right" }}>
                    FOCUS ● {selMod.en} · 0xLAy0UT
                  </div>
                </>
              ) : (
                <>
                  <div className="hud-tag hud-tag-main" style={{ left: 18, top: 14 }}>
                    <span className="hud-tag-sub">◈ LEFT HEMI · GOLD</span>
                    <b className="hud-c-yel">KNOWLEDGE {knowledgeN}</b>
                    <span className="hud-tag-sub">
                      SKILLS {skillsN} + DATABASE {dbN}
                    </span>
                  </div>
                  <div className="hud-tag hud-tag-aux" style={{ right: 140, top: 14, textAlign: "right" }}>
                    RIGHT HEMI · VIOLET ◈
                    <b className="hud-c-pur">OUTPUT {outputN}</b>
                    WORKS {worksN} + FINANCE {finN}
                  </div>
                  <div className="hud-tag hud-tag-aux" style={{ left: 18, bottom: 8 }}>
                    [ NODE 技能库 · DEG {skillsN} ] · [ NODE 数据库 · DEG {dbN} ]
                  </div>
                  <div className="hud-tag hud-tag-aux" style={{ right: 18, bottom: 8, textAlign: "right" }}>
                    SIM ● RUNNING · 0xLAy0UT
                  </div>
                </>
              )}
            </div>
            <div className="hud-tele">
              <span>TELEMETRY</span>
              {selMod ? (
                <>
                  <span>
                    MODULE <b>{selMod.en}</b>
                  </span>
                  <span>
                    COUNT <b>{selMod.countText ?? selMod.count}</b>
                  </span>
                  <span>
                    SHARE <b>{sharePct(selMod.count)}%</b>
                  </span>
                  <span>
                    STATUS{" "}
                    <b style={{ color: selMod.color }}>
                      {moduleStatus(selMod).main}
                    </b>
                  </span>
                  <span>
                    LAST SYNC <b>{health.syncTime ?? "--:--"}</b>
                  </span>
                </>
              ) : (
                <>
                  <span>
                    LAST SYNC <b>{health.syncTime ?? "--:--"}</b>
                  </span>
                  <span>
                    HEALTH-SYNC.JSON → <b>{health.ok ? "MAIN OK" : "STALE"}</b>
                  </span>
                  <span>
                    SKILLS SYNC <b>{skillsN}</b>
                  </span>
                  <span>
                    EP001 <b>UPLOADED</b>
                  </span>
                  <span>
                    SLEEP{" "}
                    <b className="hud-c-amb">
                      {health.sleepLast ? `STALE · ${health.sleepLast}` : "STALE"}
                    </b>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* RIGHT · RADAR + DECISION STACK */}
          <div className="hud-right">
            <div className="hud-panel hud-p-purple hud-radar">
              <div className="hud-phead">
                <span className="hud-t">RADAR · 模块雷达</span>
                <span className="hud-hex">0xRDAR</span>
              </div>
              <div className="hud-radarsweep" aria-hidden />
              <div className="hud-rbody">
                <svg width="158" height="168" viewBox="0 0 158 168" aria-hidden>
                  <g stroke="rgba(140,120,255,.22)" fill="none">
                    <polygon points="79,16 134,52 118,124 40,124 24,52" />
                    <polygon points="79,34 119,60 107,112 51,112 39,60" />
                    <polygon points="79,52 104,68 96,100 62,100 54,68" />
                    <line x1="79" y1="84" x2="79" y2="16" />
                    <line x1="79" y1="84" x2="134" y2="52" />
                    <line x1="79" y1="84" x2="118" y2="124" />
                    <line x1="79" y1="84" x2="40" y2="124" />
                    <line x1="79" y1="84" x2="24" y2="52" />
                  </g>
                  <polygon
                    points={radarPolygon}
                    fill="rgba(178,0,255,.30)"
                    stroke="#B200FF"
                    strokeWidth="1.4"
                    style={{ filter: "drop-shadow(0 0 5px #B200FF)" }}
                  />
                  <circle cx={radarPts[0][0]} cy={radarPts[0][1]} r="3" fill="#00FFFF" style={{ filter: "drop-shadow(0 0 5px #00FFFF)" }} />
                  <circle cx={radarPts[1][0]} cy={radarPts[1][1]} r="3" fill="#00FFFF" style={{ filter: "drop-shadow(0 0 5px #00FFFF)" }} />
                  <circle cx={radarPts[2][0]} cy={radarPts[2][1]} r="2.4" fill="#FF007F" style={{ filter: "drop-shadow(0 0 5px #FF007F)" }} />
                  <circle cx="79" cy="84" r="2.2" fill="#fff" />
                  <text x="79" y="10" fontSize="8.5" fill="#9fb8d8" textAnchor="middle">技能</text>
                  <text x="142" y="50" fontSize="8.5" fill="#9fb8d8">数据</text>
                  <text x="124" y="140" fontSize="8.5" fill="#9fb8d8">作品</text>
                  <text x="22" y="140" fontSize="8.5" fill="#9fb8d8">财务</text>
                  <text x="2" y="50" fontSize="8.5" fill="#9fb8d8">健康·日历</text>
                </svg>
                <div className="hud-rstats">
                  {(
                    [
                      { id: "skills", label: "SKILLS 技能", v: skillsN, cls: "hud-c-cyan" },
                      { id: "database", label: "DATA 数据", v: dbN, cls: "hud-c-cyan" },
                      { id: "works", label: "WORKS 作品", v: worksN, cls: "hud-c-pink" },
                      { id: "finance", label: "FINANCE 财务", v: finN, cls: "hud-c-yel" },
                      { id: "health", label: "HEALTH 健康", v: "STALE", cls: "hud-c-amb" },
                      { id: "calendar", label: "CALENDAR 日历", v: calN, cls: "" },
                    ] as const
                  ).map((r) => (
                    <div
                      key={r.id}
                      className={cn("hud-rs", sel === r.id && "hud-rs-on")}
                    >
                      {r.label} <b className={r.cls || undefined}>{r.v}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div
              className="hud-panel hud-p-pink hud-stack"
              data-testid="hud-stack-panel"
              ref={stackPanelRef}
            >
              <div
                className="hud-sheet-head"
                onTouchStart={onSheetTouchStart}
                onTouchEnd={onSheetTouchEnd}
              >
                <div className="hud-sheet-grip" aria-hidden />
                <div className="hud-phead">
                  <span className="hud-t">DECISION STACK · 决策栈</span>
                  <span className="hud-chip hud-c-pink">{pendingCount} 待决</span>
                  <span className="hud-hex">0xD5TK</span>
                </div>
              </div>
              {activeDecisions.map((s, i) => {
                const d = s.d;
                /* focus linkage: with a module focused, its decision
                 * row highlights (slide-in) and every other row dims —
                 * dimmed, never hidden or removed. */
                const related = sel != null && d.module === sel;
                const dimmed = sel != null && !related;
                return (
                  <button
                    type="button"
                    className={cn(
                      "hud-srow hud-srow-btn",
                      related && "hud-srow-rel",
                      dimmed && "is-dim",
                      s.decayed && "is-stale",
                      d.urgency === 2 && "is-urgent",
                    )}
                    key={d.en}
                    ref={(el) => {
                      if (el) decisionRowRefs.current.set(d.id, el);
                      else decisionRowRefs.current.delete(d.id);
                    }}
                    data-testid={`hud-decision-${d.note ?? d.target ?? d.en}`}
                    data-related={related ? "1" : undefined}
                    data-score={s.score}
                    data-decayed={s.decayed ? "1" : undefined}
                    data-age={s.age}
                    style={
                      related ? { animationDelay: `${i * 45}ms` } : undefined
                    }
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    onPointerDown={(e) =>
                      startDrag(e, { id: d.id, color: decisionDragColor(d) })
                    }
                    onClick={() => {
                      if (consumeDragSuppress()) return;
                      openDecision(d);
                    }}
                  >
                    <div className="hud-r1">
                      <span className={`hud-led hud-led-${d.led}`} />
                      <span className="hud-name">{d.name}</span>
                      <span className="hud-en">{d.en}</span>
                      <span className={`hud-tag hud-chip ${d.tagCls}`}>{d.tag}</span>
                    </div>
                    <div className="hud-en" style={{ marginTop: 4 }}>
                      {d.fact} · <span className="hud-wait">{d.wait}</span>
                      {s.decayed && (
                        <>
                          {" · "}
                          <span className="hud-stale">
                            STALE · {s.age} 天未动
                          </span>
                        </>
                      )}{" "}
                      · {d.target ? "点击进入 →" : "点击看说明 →"}
                    </div>
                    {/* hover actions (hud-restyle): real semantics —
                     * [RUN] is this row's own openDecision path,
                     * [ARCHIVE] files the row into the persisted
                     * archive. Both swallow pointerdown so the row's
                     * drag source and click never see the press. */}
                    <span className="hud-dec-actions">
                      <span
                        className="hud-dec-act"
                        role="button"
                        aria-label={`运行 ${d.name}`}
                        data-testid={`hud-decision-run-${d.id}`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          openDecision(d);
                        }}
                      >
                        [RUN]
                      </span>
                      <span
                        className="hud-dec-act hud-dec-act-alert"
                        role="button"
                        aria-label={`归档 ${d.name}`}
                        data-testid={`hud-decision-archive-${d.id}`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          archiveDecision(d.id);
                        }}
                      >
                        [ARCHIVE]
                      </span>
                    </span>
                  </button>
                );
              })}
              {archivedDecisions.length > 0 && (
                <div className="hud-arch-group" data-testid="hud-archived-group">
                  <button
                    type="button"
                    className="hud-arch-head"
                    data-testid="hud-archived-toggle"
                    aria-expanded={archivedOpen}
                    onClick={() => setArchivedOpen((v) => !v)}
                  >
                    <span aria-hidden>{archivedOpen ? "▾" : "▸"}</span>
                    <span>
                      已归档 ·{" "}
                      <span data-testid="hud-archived-count">
                        {archivedDecisions.length}
                      </span>
                    </span>
                    <span className="hud-en">ARCHIVED</span>
                  </button>
                  {archivedOpen &&
                    archivedDecisions.map((s) => (
                      <div
                        className="hud-arch-row"
                        key={s.d.id}
                        data-testid={`hud-archived-row-${s.d.id}`}
                      >
                        <span className={`hud-led hud-led-${s.d.led}`} />
                        <span>{s.d.name}</span>
                        <span className="hud-en">{s.d.en}</span>
                        <span
                          className="hud-dec-act"
                          role="button"
                          aria-label={`恢复 ${s.d.name}`}
                          data-testid={`hud-decision-restore-${s.d.id}`}
                          onClick={() => restoreDecision(s.d.id)}
                        >
                          [RESTORE]
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══ BOTTOM CONSOLE · 9 module cards, full row (no ENTER) ══ */}
        <div className="hud-console">
          <div className="hud-panel hud-cards">
            {modules.map((m) => (
              <button
                key={m.id}
                type="button"
                className={cn("hud-card", sel === m.id && "hud-card-on")}
                style={
                  {
                    color: m.color,
                    /* telemetry waterline (hud-restyle): --wl is the
                     * module's real entry share, --beam its beam rgb */
                    "--wl": `${sharePct(m.count)}%`,
                    "--beam": beamRgb(m.color),
                  } as React.CSSProperties
                }
                data-module={m.id}
                data-share={sharePct(m.count)}
                aria-pressed={sel === m.id}
                onClick={() => focusOrOpen(m.id)}
              >
                <div className="hud-ic">{m.icon}</div>
                <div className="hud-nm">{m.label}</div>
                <div className="hud-en">{m.en}</div>
                <div className="hud-rowb">
                  <span
                    className="hud-num"
                    style={
                      m.countText
                        ? { fontSize: 13, paddingBottom: 2 }
                        : m.countDim
                          ? { color: "#5f7194" }
                          : m.id === "health"
                            ? { color: "#ffb03a" }
                            : undefined
                    }
                  >
                    {m.countText ?? m.count}
                  </span>
                  <span className={`hud-led hud-led-${m.led}`} />
                </div>
              </button>
            ))}
          </div>
        </div>
          </>
        )}

        {/* ══ COMMAND PALETTE (Cmd+K) — bottom sheet on ≤768px ══ */}
        {palOpen && (
          <div
            className="hud-pal-mask"
            data-testid="hud-palette-mask"
            onClick={() => setPalOpen(false)}
          >
            <div
              className="hud-pal"
              role="dialog"
              aria-modal="true"
              aria-label="命令面板"
              data-testid="hud-palette"
              ref={palPanelRef}
              onKeyDown={onPalPanelKey}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="hud-pal-head"
                onTouchStart={onPalTouchStart}
                onTouchEnd={onPalTouchEnd}
              >
                <div className="hud-pal-grip" aria-hidden />
                <input
                  ref={palInputRef}
                  className="hud-pal-input"
                  data-testid="hud-palette-input"
                  type="text"
                  value={palQuery}
                  onChange={(e) => {
                    setPalQuery(e.target.value);
                    setPalIdx(0);
                  }}
                  onKeyDown={onPalKey}
                  placeholder="搜索模块 / 决策 · ↑↓ 选择 · Enter 执行"
                  aria-label="搜索命令"
                />
              </div>
              <div className="hud-pal-list" role="listbox" aria-label="命令列表">
                {palList.map((it, i) => (
                  <button
                    key={it.tid}
                    type="button"
                    role="option"
                    aria-selected={i === palIdx}
                    ref={(el) => {
                      if (el) palItemEls.current.set(it.tid, el);
                      else palItemEls.current.delete(it.tid);
                    }}
                    className={cn(
                      "hud-pal-item",
                      i === palIdx && "hud-pal-item-on",
                    )}
                    data-testid={`hud-palette-item-${it.tid}`}
                    onMouseEnter={() => setPalIdx(i)}
                    onClick={() => palRun(it)}
                  >
                    <span className="hud-pal-kind">{it.kind}</span>
                    <span className="hud-pal-label">{it.label}</span>
                    <span className="hud-pal-en">{it.en}</span>
                    {it.hint && <span className="hud-pal-hint">{it.hint}</span>}
                  </button>
                ))}
                {palList.length === 0 && (
                  <div className="hud-pal-empty">无匹配项</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* mobile chrome (≤1100px only, CSS-gated): bottom nav +
       * drag rail. Desktop never sees either. */}
      <HudMobileNav
        sheet={msheet}
        group={treeGroupRef.current}
        home={!viewMod && !noteKind}
        pending={pendingCount}
        onOverview={() => {
          backToOverview();
          setMsheet("none");
        }}
        onGroup={openTreeGroup}
        onDecisions={() => {
          backToOverview();
          setMsheet(msheet === "decisions" ? "none" : "decisions");
        }}
      />
      <HudDragRail modules={modules} onOpen={openModule} />

      {/* drag engine overlay: line + comet pulse only; idle = empty */}
      <canvas
        ref={dragCanvasRef}
        className="hud-drag-canvas"
        data-testid="hud-drag-canvas"
        aria-hidden
      />

      {/* ══ MIND-MAP STAGE — z 68: above the drag canvas (65),
          below the command palette (70) ══ */}
      {mmOpen && (
        <MindMap siblingOpen={palOpen} onClose={() => setMmOpen(false)} />
      )}

      {/* ══ RADIAL MENU — right-click (desktop) / long-press (touch) ══ */}
      <RadialMenu
        zenActive={zen}
        siblingOpen={palOpen}
        onOpenChange={(o) => {
          radialOpenRef.current = o;
          if (o) setPalOpen(false);
        }}
        onLongPressSummon={cancelPendingDrag}
        actions={{
          exportSnap: () => {
            exportState();
            showSnapNote("快照已导出（second-brain 备份文件）。");
          },
          importSnap: () => snapFileRef.current?.click(),
          newTicket: () => openModule("calendar"),
          toggleZen: () => setZen((v) => !v),
          openPalette: () => setPalOpen(true),
        }}
      />
    </div>
  );
}
