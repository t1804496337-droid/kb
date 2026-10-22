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
import {
  emit as busEmit,
  on as onBusEvent,
  type BusEventType,
} from "@/components/studio/bus";
import { RadialMenu } from "@/components/studio/radial-menu";
import { MindMap } from "@/components/studio/mind-map";
import {
  loadManualHealth,
  saveManualHealth,
  onManualHealthChange,
  manualWins,
  parseHealthClipboard,
  type ManualHealth,
} from "@/components/studio/health-effective";

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
  { text: "[10-18] EP001 已上传 · 待公开" },
  {
    text: "[10-20 13:29] 小红书账号被封 · 运营终止",
    color: "var(--hud-pink)",
  },
  { text: "[10-20 16:12] X 运营已暂停 · 8 个任务关闭" },
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

/* ── terminal business log store (2026-10-22, hud-bus-pulse;
 * structured + Chinese rendering, hud-ux-dock) ──
 * Every real business action that completes on the bus appends one
 * STRUCTURED item {ts, type, module, detail} here, persisted to
 * localStorage studio_exec_log_v1 (registered in snapshot.ts as the
 * execLog slice) and capped at 20 — the oldest fall off. Rendering
 * composes a plain-language Chinese broadcast line from the parts
 * (execLineText below), so the terminal never shows raw event codes.
 * LEGACY items {ts, text} written before the upgrade render their
 * stored text verbatim — history is never rewritten. Nothing else
 * may write this key. */
const EXEC_LOG_KEY = "studio_exec_log_v1";
const EXEC_LOG_MAX = 20;
type ExecLogItem =
  | { ts: number; text: string }
  | { ts: number; type: BusEventType; module: string; detail?: string };
const isExecLogItem = (x: unknown): x is ExecLogItem => {
  if (typeof x !== "object" || x === null) return false;
  const o = x as { ts?: unknown; text?: unknown; type?: unknown };
  return (
    typeof o.ts === "number" &&
    Number.isFinite(o.ts) &&
    (typeof o.text === "string" || typeof o.type === "string")
  );
};
const loadExecLog = (): ExecLogItem[] => {
  try {
    const raw = window.localStorage.getItem(EXEC_LOG_KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(v)) return [];
    return v.filter(isExecLogItem).slice(-EXEC_LOG_MAX);
  } catch {
    return [];
  }
};
const fmtClock = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
/* 中文业务播报模板（hud-ux-dock）：结构化日志项 → 一行人话。
 * detail 是发射点带上的业务对象名（类别+金额 / 决策标题 / 芯片
 * 名→泳道 / 健康摘要 / 节点文字），缺省时模板自然降级。 */
const execLineText = (item: ExecLogItem): string => {
  if ("text" in item) return item.text;
  const t = `[${fmtClock(new Date(item.ts))}]`;
  const d = item.detail ?? "";
  switch (item.type) {
    case "FINANCE_ADD_ENTRY":
      return `${t} [财务] 新增记录：${d}`;
    case "FINANCE_DELETE_ENTRY":
      return `${t} [财务] 删除记录：${d}`;
    case "DECISION_ARCHIVE":
      return `${t} [决策] 已归档：${d}`;
    case "DECISION_RESTORE":
      return `${t} [决策] 已恢复：${d}`;
    case "DECISION_PICK":
      return `${t} [决策] 已记录意向：${d}`;
    case "SNAPSHOT_IMPORT":
      return `${t} [系统] 快照导入完成`;
    case "HEALTH_SYNC":
      return `${t} [健康] 数据同步：${d}`;
    case "STUDIO_STAGE_MOVE":
      return `${t} [创作] ${d}`;
    case "MINDMAP_NODE":
      return `${t} [图谱] 新增灵感节点：${d}`;
    case "MINDMAP_EDGE":
      return `${t} [图谱] 灵感节点已连接：${d}`;
    default:
      return `${t} ${item.type}`;
  }
};

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

/* ── module dock (2026-10-22, hud-ux-dock) ──
 * Persistent navigation shown whenever a module (or decision-note)
 * view is open: on desktop a slim vertical bar at the left of the
 * view row; at ≤1100px the same DOM becomes a horizontal scrollable
 * strip above the module panel (CSS reflow — see globals.css). The
 * overview never renders it (it has its own navigation). 总览 goes
 * through backToOverview so the leaving-focus semantics stay in one
 * place; module buttons go through openModule — lateral routing
 * never round-trips the overview. Short labels are the brief's
 * single characters; beam colour + current highlight come from the
 * modules table, never a private copy of the list. */
const DOCK_SHORT: Record<string, string> = {
  inspiration: "灵",
  skills: "技",
  works: "作",
  database: "数",
  ontology: "本",
  calendar: "历",
  health: "健",
  finance: "财",
  studio: "创",
};
function HudDock({
  modules,
  current,
  onHome,
  onOpen,
}: {
  modules: HudModule[];
  current: string | null;
  onHome: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <nav className="hud-dock" data-testid="hud-dock" aria-label="模块导航">
      <button
        type="button"
        className="hud-dock-btn hud-dock-home"
        data-testid="hud-dock-home"
        onClick={onHome}
        title="返回总览"
      >
        <span className="hud-dock-ch">总</span>
        <span className="hud-dock-en">总览</span>
      </button>
      {modules.slice(0, 9).map((m) => (
        <button
          key={m.id}
          type="button"
          className={cn("hud-dock-btn", current === m.id && "hud-dock-on")}
          data-testid={`hud-dock-btn-${m.id}`}
          aria-current={current === m.id ? "page" : undefined}
          style={{ "--beam": m.color } as React.CSSProperties}
          onClick={() => onOpen(m.id)}
          title={m.label}
        >
          <span className="hud-dock-ch">
            {DOCK_SHORT[m.id] ?? m.label.slice(0, 1)}
          </span>
          <span className="hud-dock-en">{m.en}</span>
        </button>
      ))}
    </nav>
  );
}

/* ── ticker slogan store (2026-10-22, hud-ux-dock) ──
 * The ticker splits in two: a user-editable SLOGAN segment (this
 * store — localStorage studio_marquee_v1, registered in snapshot.ts
 * as the marquee slice) and a live STATUS segment that stays
 * data-driven in the render (health freshness / EP001 / X / XHS)
 * and is never written into the stored slogan. */
const MARQUEE_KEY = "studio_marquee_v1";
const MARQUEE_DEFAULT =
  "九大模块 · 一个第二大脑 · NINE MODULES · ONE SECOND BRAIN";
const loadMarquee = (): string => {
  try {
    const v = window.localStorage.getItem(MARQUEE_KEY);
    return v && v.trim() ? v : MARQUEE_DEFAULT;
  } catch {
    return MARQUEE_DEFAULT;
  }
};

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

  /* ---- manual health record (2026-10-22, hud-health-sync · 拼图三) ----
   * The clipboard sync port's single stored record. The EFFECTIVE
   * health view is merged here — and only here: when the manual
   * record's date is newer than (or the same day as) the file's
   * latest sleep record AND the manual record carries sleep data,
   * every consumer below (top bar, ticker, overview health row,
   * decision row DYNAMIC updatedAt, telemetry) reads effHealth and
   * the manual values win; an older manual record changes nothing.
   * The merge rule itself lives in health-effective.ts (manualWins),
   * shared with HealthBody so the two never drift apart. */
  const [manualHealth, setManualHealth] = React.useState<ManualHealth | null>(
    () => loadManualHealth(),
  );
  React.useEffect(
    () =>
      onManualHealthChange(() => setManualHealth(loadManualHealth())),
    [],
  );
  const manualApplies = manualWins(manualHealth, health.sleep?.date ?? null);
  const manualSleepApplies =
    manualApplies && manualHealth?.sleepHours !== undefined;
  const effHealth: HealthState = manualSleepApplies
    ? {
        ok: true,
        syncTime: health.syncTime,
        sleepLast: (manualHealth as ManualHealth).date.slice(5),
        sleep: {
          date: (manualHealth as ManualHealth).date,
          start: (manualHealth as ManualHealth).sleepStart,
          end: (manualHealth as ManualHealth).sleepEnd,
          hours: (manualHealth as ManualHealth).sleepHours,
        },
      }
    : health;

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

  /* ---- module focus: console cards select a focus module; the
   * CORE MAP corner tags, telemetry strip and radar stat rows follow
   * the selection. All copy is derived from the live counts/health
   * above — same caliber as the overview, never invented. (The tree
   * panel that also used to set focus was retired in hud-ux-dock.) ---- */
  const [sel, setSel] = React.useState<string | null>(null);
  /* EXEC log state (hud-bus-pulse): the ref is the write path for
   * the bus subscriber (synchronous append + persist, so an import's
   * own EXEC line survives the reload that follows it); the state
   * mirror drives the terminal render. */
  const [execLog, setExecLog] = React.useState<ExecLogItem[]>(loadExecLog);
  const execLogRef = React.useRef(execLog);
  const logLinesRef = React.useRef<HTMLDivElement | null>(null);
  /* ── terminal session notes (2026-10-22, hud-health-sync) ──
   * Session-only terminal lines that are NOT bus EXEC successes:
   * red ERROR lines from the health clipboard port's validation and
   * cyan info lines (e.g. the clipboard fell back to paste mode).
   * Deliberately kept OUT of the persisted EXEC log — that store's
   * contract is "one line per completed business action" — so notes
   * live in component state only, vanish on reload, and render after
   * the EXEC lines in the terminal. */
  type TermNote = { id: number; ts: number; text: string; kind: "error" | "info" };
  const [termNotes, setTermNotes] = React.useState<TermNote[]>([]);
  const termNoteIdRef = React.useRef(0);
  const pushTermNote = React.useCallback(
    (body: string, kind: "error" | "info") => {
      const now = new Date();
      termNoteIdRef.current += 1;
      const note: TermNote = {
        id: termNoteIdRef.current,
        ts: now.getTime(),
        text: `[${fmtClock(now)}] ${body}`,
        kind,
      };
      setTermNotes((prev) => [...prev.slice(-9), note]);
    },
    [],
  );
  /* terminal typewriter: the newest real log line types itself in
   * on mount / on change — the newest EXEC line once any exist,
   * otherwise the last HUD_LOG_FACTS entry (hud-restyle behaviour).
   * A session note newer than the last EXEC line takes the typed
   * slot instead (hud-health-sync), so a fresh ERROR line types in
   * red exactly like a success line types in blue. */
  const lastExecItem =
    execLog.length > 0 ? execLog[execLog.length - 1] : null;
  const lastTermNote =
    termNotes.length > 0 ? termNotes[termNotes.length - 1] : null;
  const latestKind: "exec" | "note" | "fact" =
    lastTermNote && (!lastExecItem || lastTermNote.ts >= lastExecItem.ts)
      ? "note"
      : lastExecItem
        ? "exec"
        : "fact";
  const termLatestText =
    latestKind === "note"
      ? (lastTermNote as TermNote).text
      : latestKind === "exec"
        ? execLineText(lastExecItem as ExecLogItem)
        : (HUD_LOG_FACTS[HUD_LOG_FACTS.length - 1]?.text ?? "");
  const typedTermLatest = useTypewriter(termLatestText, 32);
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
  const archiveDecision = (d: { id: string; module?: string; name?: string }) => {
    writeArchived([...new Set([...archivedIds, d.id])]);
    /* 业务总线（hud-bus-pulse）：归档落盘后发射，module 取该决策
     * 的归属模块，无归属的 note 类用 "hub"；detail 带决策标题，
     * 供终端拼中文播报（hud-ux-dock）。 */
    busEmit("DECISION_ARCHIVE", d.module ?? "hub", d.name);
  };
  const restoreDecision = (d: { id: string; module?: string; name?: string }) => {
    writeArchived(archivedIds.filter((x) => x !== d.id));
    busEmit("DECISION_RESTORE", d.module ?? "hub", d.name);
  };
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
        return manualSleepApplies
          ? {
              main: `SYNCED · ${(manualHealth as ManualHealth).date.slice(5)}`,
              note: `MANUAL SYNC · 剪贴板解析口 · FILE LAST ${health.syncTime ?? "--:--"}`,
            }
          : {
              main: `STALE · ${effHealth.sleepLast ?? "10-19"}`,
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
  const modById = (id: string) => modules.find((m) => m.id === id);
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
  const slp = effHealth.sleep;
  let healthTag = "STALE";
  let healthTagCls = "hud-c-amb";
  let healthFact = `最近完整记录 ${effHealth.sleepLast ?? "10-19"} · 数据待更新`;
  if (effHealth.ok && slp && slp.date >= yestISO) {
    healthTag = "已同步";
    healthTagCls = "hud-c-grn";
    healthFact =
      `昨晚完整记录已同步` +
      (slp.start && slp.end ? ` · ${slp.start} 入睡 → ${slp.end} 起床` : "") +
      (typeof slp.hours === "number"
        ? ` · ${Math.round(slp.hours * 10) / 10}h`
        : "");
  } else if (effHealth.ok && slp) {
    healthFact = `最近完整记录 ${slp.date.slice(5)} 晚 · 昨晚待手机同步`;
  } else if (effHealth.ok) {
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
    (effHealth.sleepLast ? `2026-${effHealth.sleepLast}` : "2026-10-19");
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
  /* ── ticker slogan editor (2026-10-22, hud-ux-dock) ──
   * Two entrances, one editor: the radial wheel's 编辑标语 sector
   * and the palette's 编辑顶部标语 item both open this overlay.
   * Save applies + persists at once; an empty draft restores the
   * default slogan instead of blanking the ticker. */
  const [marquee, setMarquee] = React.useState<string>(loadMarquee);
  const [marqueeOpen, setMarqueeOpen] = React.useState(false);
  const [marqueeDraft, setMarqueeDraft] = React.useState("");
  const marqueeAreaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const openMarqueeEditor = React.useCallback(() => {
    setMarqueeDraft(marquee);
    setMarqueeOpen(true);
  }, [marquee]);
  const saveMarquee = React.useCallback(() => {
    const next = marqueeDraft.trim() || MARQUEE_DEFAULT;
    try {
      window.localStorage.setItem(MARQUEE_KEY, next);
    } catch {
      /* storage unavailable → the slogan lasts for this session only */
    }
    setMarquee(next);
    setMarqueeOpen(false);
  }, [marqueeDraft]);
  React.useEffect(() => {
    if (marqueeOpen) marqueeAreaRef.current?.focus();
  }, [marqueeOpen]);
  React.useEffect(() => {
    if (!marqueeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMarqueeOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [marqueeOpen]);
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
    /* 业务总线（hud-bus-pulse）：导入成功、全部片已落盘 → 发射。
     * 订阅端同步把 EXEC 行追加进（刚被快照恢复的）execLog，然后
     * 才走下面的 reload，所以这行日志重载后仍在终端里。 */
    busEmit("SNAPSHOT_IMPORT", "hub");
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
    {
      tid: "marquee",
      kind: "导航",
      label: "编辑顶部标语",
      en: "MARQUEE",
      hint: "自定义跑马灯标语",
      run: () => openMarqueeEditor(),
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
  /* business-pulse bridges (hud-bus-pulse): the canvas is shared
   * with the bus pulse layer defined further below. A drag that
   * activates cancels any playing business pulse (the canvas belongs
   * to the gesture); when a drag fully settles, the flush hook starts
   * the next queued business pulse. The bus section assigns both. */
  const busPulseFlushRef = React.useRef<() => void>(() => undefined);
  const busPulseCancelRef = React.useRef<() => void>(() => undefined);
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
    /* drag fully settled — a queued business pulse may take the
     * canvas now (hud-bus-pulse). */
    busPulseFlushRef.current();
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
      busPulseFlushRef.current();
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
      /* tree-row anchors retired with the tree panel (hud-ux-dock):
       * this query now matches nothing — kept so a future left-panel
       * rebuild can re-offer rows as drop targets without engine
       * surgery. Zero matches is the normal state, never an error. */
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
      /* the gesture takes the shared canvas: cancel any business
       * pulse mid-flight (queued ones replay after the drop). */
      busPulseCancelRef.current();
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
      busPulseFlushRef.current();
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

  /* ── business bus: EXEC log + sphere pulse (2026-10-22, hud-bus-pulse) ──
   * The landing is the bus's single subscriber. Every event (bus.ts)
   * appends one EXEC line to the persisted terminal log — in any
   * view, unconditionally — and, only while the overview is on
   * screen (view === null), fires a light-burst at the owning
   * module's sphere hotspot: double expanding rings, eight radial
   * comet streaks and a glow flash in the module's beam colour,
   * ≈900ms on the drag engine's shared full-screen canvas.
   * Coexistence with the drag engine (one canvas, one painter at a
   * time): a pulse starts only while no drag state exists; pulses
   * that arrive mid-gesture queue (cap 6, oldest dropped) and flush
   * when the drag fully settles (drop landed / faded / plain click /
   * radial cancel — see busPulseFlushRef call sites); a drag that
   * activates mid-pulse cancels the pulse outright (queue survives).
   * "hub" resolves to the sphere-centre hotspot (创作空间). */
  type BusPulse = {
    moduleId: string;
    color: string;
    cx: number;
    cy: number;
    start: number;
    lowFx: boolean;
  };
  const BUS_PULSE_MS = 900;
  const busPulseRef = React.useRef<BusPulse | null>(null);
  const busPulseQueueRef = React.useRef<string[]>([]);
  const busPulseRafRef = React.useRef(0);
  const viewRef = React.useRef<string | null>(null);
  viewRef.current = view;
  /* same hotspot geometry as measureDragAnchors' orb anchors:
   * modules[0..7] on the 0.58-radius ring, modules[8] at centre. */
  const orbHotspot = (
    moduleId: string,
  ): { cx: number; cy: number; color: string } | null => {
    const id = moduleId === "hub" ? "studio" : moduleId;
    const nine = modules.slice(0, 9);
    const idx = nine.findIndex((m) => m.id === id);
    if (idx < 0) return null;
    const sphere = document.querySelector(".hud-sphere");
    if (!sphere) return null;
    const r = sphere.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const rad = Math.min(r.width, r.height) / 2;
    const spot =
      idx === 8
        ? { dx: 0, dy: 0 }
        : {
            dx: Math.cos((idx * Math.PI) / 4 - Math.PI / 2) * 0.58,
            dy: Math.sin((idx * Math.PI) / 4 - Math.PI / 2) * 0.58,
          };
    return { cx: cx + spot.dx * rad, cy: cy + spot.dy * rad, color: nine[idx].color };
  };
  const drawBusPulseFrame = (now: number) => {
    const canvas = dragCanvasRef.current;
    const p = busPulseRef.current;
    if (!canvas || !p) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const t = Math.min(1, Math.max(0, (now - p.start) / BUS_PULSE_MS));
    const col = p.color;
    ctx.save();
    /* hotspot glow flash */
    ctx.beginPath();
    ctx.arc(p.cx, p.cy, 13 + 16 * t, 0, Math.PI * 2);
    ctx.globalAlpha = 0.5 * (1 - t);
    ctx.fillStyle = col;
    if (!p.lowFx) {
      ctx.shadowColor = col;
      ctx.shadowBlur = 22;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    /* double expanding rings (second one trails by 0.22) */
    for (const delay of [0, 0.22]) {
      const lt = (t - delay) / (1 - delay);
      if (lt < 0 || lt > 1) continue;
      ctx.beginPath();
      ctx.arc(p.cx, p.cy, 8 + 76 * lt, 0, Math.PI * 2);
      ctx.globalAlpha = 0.85 * (1 - lt);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2 - lt;
      ctx.stroke();
    }
    /* eight radial comet streaks chasing the expanding front */
    const front = 16 + 60 * t;
    const tailLen = 3 + 15 * (1 - t);
    ctx.lineWidth = 2;
    for (let k = 0; k < 8; k += 1) {
      const a = (k * Math.PI) / 4 - Math.PI / 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(p.cx + ca * (front - tailLen), p.cy + sa * (front - tailLen));
      ctx.lineTo(p.cx + ca * front, p.cy + sa * front);
      ctx.globalAlpha = 0.75 * (1 - t);
      ctx.strokeStyle = col;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.cx + ca * front, p.cy + sa * front, 1.8, 0, Math.PI * 2);
      ctx.globalAlpha = 0.9 * (1 - t);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
    /* white-hot core */
    ctx.beginPath();
    ctx.arc(p.cx, p.cy, 2.8, 0, Math.PI * 2);
    ctx.globalAlpha = 1 - t * 0.6;
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
  };
  function tryStartBusPulse() {
    if (busPulseRef.current || dragRef.current) return;
    const next = busPulseQueueRef.current.shift();
    if (!next) return;
    const spot = orbHotspot(next);
    if (!spot) {
      /* module has no hotspot (custom x-* node): drop it and move
       * on to whatever queued behind it — the log already told the
       * story, the burst is best-effort. */
      tryStartBusPulse();
      return;
    }
    busPulseRef.current = {
      moduleId: next,
      ...spot,
      start: performance.now(),
      lowFx: window.matchMedia("(max-width: 768px)").matches,
    };
    sizeDragCanvas();
    ensureBusPulseLoop();
  }
  const busPulseLoop = (now: number) => {
    busPulseRafRef.current = 0;
    const p = busPulseRef.current;
    if (!p) return;
    drawBusPulseFrame(now);
    if (now - p.start >= BUS_PULSE_MS) {
      busPulseRef.current = null;
      clearDragCanvas();
      tryStartBusPulse();
      return;
    }
    busPulseRafRef.current = requestAnimationFrame(busPulseLoop);
  };
  const ensureBusPulseLoop = () => {
    if (!busPulseRafRef.current) {
      busPulseRafRef.current = requestAnimationFrame(busPulseLoop);
    }
  };
  const cancelBusPulse = () => {
    if (busPulseRafRef.current) cancelAnimationFrame(busPulseRafRef.current);
    busPulseRafRef.current = 0;
    if (busPulseRef.current) {
      busPulseRef.current = null;
      clearDragCanvas();
    }
  };
  const queueBusPulse = (moduleId: string) => {
    const q = busPulseQueueRef.current;
    q.push(moduleId);
    if (q.length > 6) q.splice(0, q.length - 6);
    tryStartBusPulse();
  };
  /* hand the drag engine its two bridge hooks (assigned every
   * render — the refs they feed are stable). */
  React.useEffect(() => {
    busPulseFlushRef.current = tryStartBusPulse;
    busPulseCancelRef.current = cancelBusPulse;
  });
  React.useEffect(
    () => () => {
      if (busPulseRafRef.current) cancelAnimationFrame(busPulseRafRef.current);
      busPulseRafRef.current = 0;
      busPulseRef.current = null;
      busPulseQueueRef.current = [];
    },
    [],
  );
  /* the subscription itself: log always, pulse on the overview only */
  React.useEffect(
    () =>
      onBusEvent((ev) => {
        const now = new Date();
        const item: ExecLogItem = {
          ts: now.getTime(),
          type: ev.type,
          module: ev.moduleId,
          detail: ev.detail,
        };
        const next = [...execLogRef.current, item].slice(-EXEC_LOG_MAX);
        execLogRef.current = next;
        try {
          window.localStorage.setItem(EXEC_LOG_KEY, JSON.stringify(next));
        } catch {
          /* storage unavailable → the log lasts for this session only */
        }
        setExecLog(next);
        if (!viewRef.current) queueBusPulse(ev.moduleId);
      }),
    [],
  );
  /* keep the newest terminal line on screen: the line box caps at
   * --hud-int-log-max-h and scrolls — pin to the bottom whenever
   * the EXEC log grows (and once on mount, for a restored log). */
  React.useEffect(() => {
    const el = logLinesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [execLog, termNotes]);

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
  /* ── health clipboard sync port (2026-10-22, hud-health-sync · 拼图三) ──
   * Radial [SYNC HEALTH] runs syncHealth: try navigator.clipboard
   * .readText() first; any failure (no API, permission denied — iOS
   * Safari has no readText) opens the paste fallback overlay, whose
   * text runs down the very same validation path (applyHealthText).
   * A successful parse is stored via health-effective.ts, the
   * effective health view re-derives everywhere, and the bus emit
   * appends the EXEC line + bursts the health hotspot. A failed
   * parse writes NOTHING and appends a red ERROR note instead. */
  const [pasteOpen, setPasteOpen] = React.useState(false);
  const [pasteText, setPasteText] = React.useState("");
  const [pasteError, setPasteError] = React.useState<string | null>(null);
  const pasteAreaRef = React.useRef<HTMLTextAreaElement | null>(null);
  /* one commit tail for both entry paths (direct read / paste):
   * store → local state → bus. The bus subscriber appends the EXEC
   * line and bursts the health hotspot; the effective view re-derives
   * from the manual state. */
  const commitManualHealth = React.useCallback((m: ManualHealth) => {
    saveManualHealth(m);
    setManualHealth(m);
    /* detail = 归一摘要（hud-ux-dock）：日期 + 有什么写什么，
     * 供终端拼「[健康] 数据同步：2026-10-20 · 睡眠 6.65h · 步数 2240」。 */
    const parts = [m.date];
    if (m.sleepHours !== undefined) parts.push(`睡眠 ${m.sleepHours}h`);
    if (m.steps !== undefined) parts.push(`步数 ${m.steps}`);
    busEmit("HEALTH_SYNC", "health", parts.join(" · "));
  }, []);
  const applyHealthText = React.useCallback(
    (text: string) => {
      const r = parseHealthClipboard(text);
      if (!r.ok) {
        pushTermNote(`[健康] 同步失败：${r.error}`, "error");
        return r;
      }
      commitManualHealth(r.value);
      return r;
    },
    [pushTermNote, commitManualHealth],
  );
  const syncHealth = React.useCallback(async () => {
    let text: string | null = null;
    try {
      if (!navigator.clipboard?.readText) throw new Error("no clipboard api");
      text = await navigator.clipboard.readText();
    } catch {
      text = null;
    }
    if (text === null) {
      pushTermNote("[健康] 剪贴板读取不可用 · 改用粘贴同步", "info");
      setPasteError(null);
      setPasteText("");
      setPasteOpen(true);
      return;
    }
    applyHealthText(text);
  }, [applyHealthText, pushTermNote]);
  React.useEffect(() => {
    if (pasteOpen) pasteAreaRef.current?.focus();
  }, [pasteOpen]);
  /* Esc closes the paste overlay (the wheel is already closed by
   * the time it opens; the palette yields via siblingOpen). */
  React.useEffect(() => {
    if (!pasteOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPasteOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [pasteOpen]);
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
    /* the wheel taking over also settles the drag — queued business
     * pulses may play now (hud-bus-pulse). */
    busPulseFlushRef.current();
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
              {effHealth.ok ? (
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
                  {/* 标语段（用户可编辑，studio_marquee_v1）+ 状态段
                   *（实时数据驱动，永不写进标语） */}
                  {marquee} <i>·</i>{" "}
                  {effHealth.ok ? "HEALTH-SYNC OK" : "HEALTH-SYNC STALE"} <u>·</u>{" "}
                  EP001 PENDING PUBLISH <i>·</i> X PAUSED <u>·</u> XHS PAUSED{" "}
                  <i>·</i>
                </span>
              ))}
            </div>
          </div>
        </div>

        {viewMod || noteKind ? (
          /* module / note view row (hud-ux-dock): the Dock owns the
           * left edge, the view panel yields its width (desktop) or
           * its height (≤1100px horizontal strip) via .hud-viewrow. */
          <div className="hud-viewrow">
            <HudDock
              modules={modules}
              current={viewMod?.id ?? null}
              onHome={backToOverview}
              onOpen={openModule}
            />
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
            ) : null}
          </div>
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
              {/* 左侧概览面板（hud-ux-dock）：树行/块格/连接线整体
               * 退役——模块跳转由 Dock、底部卡轨与移动导航承接，
               * 树行作为拖拽源/投放目标同步退役（引擎测不到锚点
               * 即无锚点，不报错）。重构方案待用户拍板，先占位，
               * 不许编造任何统计数字。 */}
              <div
                className="hud-tree-placeholder"
                data-testid="hud-tree-placeholder"
              >
                概览面板 · 重构中
              </div>
            </div>
            <div className="hud-log">
              <div className="hud-log-head">
                <span>&gt; 终端日志</span>
                <span className="hud-led hud-led-g" />
              </div>
              <div className="hud-log-lines" ref={logLinesRef}>
                <div style={{ color: "#8fa3c4" }}>
                  {manualSleepApplies
                    ? `[${(manualHealth as ManualHealth).date.slice(5)}] 健康手动同步 · 剪贴板解析口`
                    : health.ok
                      ? `[${health.syncTime ?? "--:--"}] 健康数据同步完成`
                      : "[--:--] 健康数据 · 同步过期"}
                </div>
                <div>[启动] 技能库已加载 · {skillsN} 个</div>
                {HUD_LOG_FACTS.map((l, li) =>
                  li === HUD_LOG_FACTS.length - 1 && latestKind === "fact" ? (
                    /* newest real event line: typewriter reveal
                     * (hud-restyle) — content is the existing log
                     * line itself, never a generated event. Once EXEC
                     * lines exist they take over the typed slot. */
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
                {/* 业务播报行（hud-bus-pulse → hud-ux-dock 中文化）：
                 * 每条已完成的业务动作一行，结构化项渲染时拼中文，
                 * 旧 {ts,text} 项原样显示；最新一行走打字机。 */}
                {execLog.map((item, i) => {
                  const isTyped =
                    i === execLog.length - 1 && latestKind === "exec";
                  return (
                    <div
                      key={`${item.ts}-${i}`}
                      data-exec-line="1"
                      data-type={
                        "type" in item
                          ? item.type
                          : (/EXEC: (\S+)/.exec(item.text)?.[1] ?? "")
                      }
                      {...(isTyped
                        ? { "data-testid": "hud-term-latest" }
                        : {})}
                      style={{ color: "#c8e6ff" }}
                    >
                      {isTyped ? typedTermLatest : execLineText(item)}
                    </div>
                  );
                })}
                {/* session notes (hud-health-sync): red ERROR lines
                 * from clipboard validation + cyan info lines — the
                 * newest one takes the typewriter slot, same as an
                 * EXEC line would. Session-only by design (see the
                 * termNotes state comment). */}
                {termNotes.map((n, i) => {
                  const isTyped =
                    i === termNotes.length - 1 && latestKind === "note";
                  return (
                    <div
                      key={n.id}
                      data-term-note={n.kind}
                      {...(isTyped
                        ? { "data-testid": "hud-term-latest" }
                        : {})}
                      style={{
                        color:
                          n.kind === "error"
                            ? "var(--hud-int-term-error)"
                            : "var(--hud-int-term-info)",
                      }}
                    >
                      {isTyped ? typedTermLatest : n.text}
                    </div>
                  );
                })}
                <div style={{ color: "var(--hud-yellow)" }}>
                  [当前] 等待指令{" "}
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
                    <b className={manualSleepApplies ? "hud-c-grn" : "hud-c-amb"}>
                      {manualSleepApplies
                        ? `SYNCED · ${effHealth.sleepLast}`
                        : effHealth.sleepLast
                          ? `STALE · ${effHealth.sleepLast}`
                          : "STALE"}
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
                      {
                        id: "health", label: "HEALTH 健康",
                        v: manualSleepApplies ? (effHealth.sleepLast ?? "SYNCED") : "STALE",
                        cls: manualSleepApplies ? "hud-c-grn" : "hud-c-amb",
                      },
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
                          archiveDecision(d);
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
                          onClick={() => restoreDecision(s.d)}
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
        <MindMap
          siblingOpen={palOpen || marqueeOpen}
          onClose={() => setMmOpen(false)}
        />
      )}

      {/* ══ HEALTH PASTE FALLBACK (hud-health-sync) — same z tier as
          the command palette (70): the clipboard API failed, so the
          user pastes the health JSON here; [解析同步] runs the exact
          same parseHealthClipboard path as a direct read. ══ */}
      {pasteOpen && (
        <div
          className="hud-pal-mask"
          data-testid="hud-health-paste-mask"
          onClick={() => setPasteOpen(false)}
        >
          <div
            className="hud-pal hud-health-paste"
            role="dialog"
            aria-modal="true"
            aria-label="粘贴健康数据同步"
            data-testid="hud-health-paste"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hud-health-paste-head">
              <span>SYNC HEALTH · 粘贴同步</span>
              <span className="hud-health-paste-sub">
                剪贴板读取不可用 —— 把健康 JSON 粘贴到这里，校验口径与直读一致
              </span>
            </div>
            <textarea
              ref={pasteAreaRef}
              className="hud-health-paste-area"
              data-testid="hud-health-paste-area"
              value={pasteText}
              onChange={(e) => {
                setPasteText(e.target.value);
                setPasteError(null);
              }}
              placeholder='{"date":"2026-10-22","sleep":{"hours":7.5},"steps":8123}'
              aria-label="健康 JSON 文本"
              rows={6}
              spellCheck={false}
            />
            {pasteError && (
              <div
                className="hud-health-paste-err"
                data-testid="hud-health-paste-err"
              >
                {pasteError}
              </div>
            )}
            <div className="hud-health-paste-actions">
              <button
                type="button"
                className="hud-health-paste-btn"
                data-testid="hud-health-paste-cancel"
                onClick={() => setPasteOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="hud-health-paste-btn is-go"
                data-testid="hud-health-paste-go"
                onClick={() => {
                  const r = applyHealthText(pasteText);
                  if (!r.ok) {
                    setPasteError(`同步失败 · ${r.error}`);
                    return;
                  }
                  setPasteOpen(false);
                  setPasteText("");
                }}
              >
                解析同步
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MARQUEE EDITOR (hud-ux-dock) — same z tier as the
          palette (70): edits the ticker's slogan segment only; the
          status segment stays data-driven. Empty save → default. ══ */}
      {marqueeOpen && (
        <div
          className="hud-pal-mask"
          data-testid="hud-marquee-mask"
          onClick={() => setMarqueeOpen(false)}
        >
          <div
            className="hud-pal hud-marquee-edit"
            role="dialog"
            aria-modal="true"
            aria-label="编辑顶部标语"
            data-testid="hud-marquee-editor"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hud-health-paste-head">
              <span>编辑标语 · MARQUEE</span>
              <span className="hud-health-paste-sub">
                只改跑马灯的标语段；健康 / EP001 / X 等实时状态段保持自动播报
              </span>
            </div>
            <textarea
              ref={marqueeAreaRef}
              className="hud-health-paste-area"
              data-testid="hud-marquee-area"
              value={marqueeDraft}
              onChange={(e) => setMarqueeDraft(e.target.value)}
              placeholder={MARQUEE_DEFAULT}
              aria-label="顶部标语文本"
              rows={3}
              maxLength={200}
              spellCheck={false}
            />
            <div className="hud-health-paste-actions">
              <button
                type="button"
                className="hud-health-paste-btn"
                data-testid="hud-marquee-cancel"
                onClick={() => setMarqueeOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="hud-health-paste-btn is-go"
                data-testid="hud-marquee-save"
                onClick={saveMarquee}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ RADIAL MENU — right-click (desktop) / long-press (touch) ══ */}
      <RadialMenu
        zenActive={zen}
        siblingOpen={palOpen || pasteOpen || marqueeOpen}
        onOpenChange={(o) => {
          radialOpenRef.current = o;
          if (o) {
            setPalOpen(false);
            setPasteOpen(false);
            setMarqueeOpen(false);
          }
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
          syncHealth: () => {
            void syncHealth();
          },
          editMarquee: () => openMarqueeEditor(),
        }}
      />
    </div>
  );
}
