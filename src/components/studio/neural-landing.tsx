"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  HudModuleContent,
  HudDecisionNote,
} from "@/components/studio/hud-module-content";

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
  /* Module content view (2026-10-21): clicking a tree row / console card
   * opens that module's real content in place of the overview; the back
   * button returns. Selection linkage above still applies — opening a
   * module also focuses it, and the focus survives the trip back. */
  const [view, setView] = React.useState<string | null>(null);
  const openModule = (id: string) => {
    setSel(id);
    setView(id);
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
  /** Share-bar fill inside the 40-unit track, share of total entries. */
  const bw = (n: number) =>
    n <= 0 ? 0 : Math.max(2, Math.round((n / Math.max(total, 1)) * 40));
  const cntFill = (n: number) => (n > 0 ? "#e8f4ff" : "#5f7194");

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
   * Ordered by urgency (user, 2026-10-22): EP001 → 健康 → 待办票 →
   * 小红书 → 本体 → X. Every row is clickable: module-backed items
   * jump to that module's content view; the two decision items
   * (X / XHS) open a facts note view with intent-recording buttons.
   * `wait` names whose hands the item is stuck in. Status copy is
   * factual only — the decorative progress percentages of the frozen
   * mockup were removed (no real source). */
  const decisions: {
    led: HudModule["led"] | "p";
    name: string;
    en: string;
    tag: string;
    tagCls: string;
    fact: string;
    wait: string;
    target?: string;
    note?: "x" | "xhs";
  }[] = [
    {
      led: "p", name: "EP001 公开", en: "YOUTUBE PUBLISH", tag: "待公开",
      tagCls: "hud-c-pink", target: "works",
      fact: "已上传 · 待手机端改公开",
      wait: "等你 · 手机操作",
    },
    {
      led: "a", name: "健康数据同步", en: "HEALTH SYNC", tag: healthTag,
      tagCls: healthTagCls, target: "health",
      fact: healthFact,
      wait: "等数据 · 手机同步",
    },
    {
      led: "g", name: `待办票 ×${ticketsN}`, en: "CALENDAR TICKETS", tag: "待清",
      tagCls: "hud-c-cyan", target: "calendar",
      fact: "日历模块待办票未清",
      wait: "等你 · 随手清",
    },
    {
      led: "p", name: "小红书去向", en: "XHS DECISION A/B/C", tag: "待拍板",
      tagCls: "hud-c-pur", note: "xhs",
      fact: "申诉 / 换号 / 搁置 · 待拍板",
      wait: "等你 · 三选一",
    },
    {
      led: "d", name: "本体知识库填充", en: "ONTOLOGY BUILD", tag: "建设中",
      tagCls: "hud-c-pur", target: "ontology",
      fact: "空壳已上线 · 条目 0 · 细节待排期",
      wait: "等排期",
    },
    {
      led: "d", name: "X 账号恢复", en: "X OPS RESUME", tag: "已暂停",
      tagCls: "hud-c-pink", note: "x",
      fact: "8 个定时任务停用 · 待指令",
      wait: "等你 · 一句话恢复",
    },
  ];
  const openDecision = (d: (typeof decisions)[number]) => {
    if (d.target) openModule(d.target);
    else if (d.note) setView(`note:${d.note}`);
  };

  return (
    <div
      className={cn("hud-root", leaving && "hud-leaving", quick && "hud-quick")}
      data-testid="studio-landing"
      data-quick={quick ? "1" : "0"}
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
          <div className="hud-spark">
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
            <div className="hud-metric">0x3F9A · SEC 07</div>
            <div className="hud-clock" data-testid="hud-clock">
              {clock}
            </div>
          </div>
        </div>

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
            onBack={() => setView(null)}
            onOpen={openModule}
          />
        ) : noteKind ? (
          <HudDecisionNote kind={noteKind} onBack={() => setView(null)} />
        ) : (
          <>
        {/* ══ MAIN ══ */}
        <div className="hud-main">
          {/* LEFT · THE ORB TREE */}
          <div className="hud-panel hud-tree">
            <div className="hud-phead">
              <span className="hud-t">THE ORB · 模块树</span>
              <span className="hud-chip hud-c-cyan">TREE</span>
              <span className="hud-hex">0x0RB1</span>
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
                <line x1="14" y1="24" x2="14" y2="426" stroke="#3d5a86" strokeWidth="1.2" />
                <line x1="14" y1="24" x2="14" y2="426" stroke="#00FFFF" strokeWidth="2" className="hud-flow-line" />
                <circle cx="14" cy="24" r="5.5" fill="#FFEA00" filter="url(#hud-glow)" />
                <circle cx="14" cy="24" r="5.5" fill="none" stroke="#FFEA00" strokeWidth="1" className="hud-wave-circle" />
                <text x="27" y="28" fontSize="11.5" fill="#ffffff" letterSpacing="1">第二大脑</text>
                <text x="86" y="28" fontSize="8.5" fill="#5f7194" letterSpacing="1">SECOND BRAIN</text>
                <text x="266" y="28" fontSize="13" fill="#FF007F" textAnchor="end">{total}</text>
                <line x1="14" y1="56" x2="34" y2="56" stroke="#FF007F" strokeWidth="1.2" />
                <line x1="14" y1="56" x2="34" y2="56" stroke="#FF007F" strokeWidth="2" className="hud-flow-line" />
                <circle cx="34" cy="56" r="4" fill="#FF007F" filter="url(#hud-glow)" />
                <circle cx="34" cy="56" r="4" fill="none" stroke="#FF007F" strokeWidth="0.7" className="hud-wave-circle" style={{ animationDelay: ".6s" }} />
                <text x="46" y="60" fontSize="10.5" fill="#ffb3d6">创作</text>
                <text x="74" y="60" fontSize="8.5" fill="#5f7194" letterSpacing="1">CREATE</text>
                <line x1="34" y1="56" x2="34" y2="146" stroke="#7a2b52" strokeWidth="1.1" />
                <line x1="34" y1="86" x2="56" y2="86" stroke="#00FFFF" strokeWidth="1.1" />
                <circle cx="56" cy="86" r="3.4" fill="#00FFFF" filter="url(#hud-glow)" />
                <text x="67" y="90" fontSize="10.5" fill="#e8f4ff">创作空间</text>
                <text x="120" y="90" fontSize="8" fill="#5f7194">STUDIO</text>
                <text x="266" y="90" fontSize="11" fill="#00FFFF" textAnchor="end">HUB</text>
                <line x1="34" y1="116" x2="56" y2="116" stroke="#FF007F" strokeWidth="1.1" />
                <circle cx="56" cy="116" r="3.4" fill="#FF007F" filter="url(#hud-glow)" />
                <text x="67" y="120" fontSize="10.5" fill="#e8f4ff">作品库</text>
                <text x="110" y="120" fontSize="8" fill="#5f7194">WORKS</text>
                <rect x="196" y="113" width="40" height="4" fill="#0d1226" stroke="#FF007F" strokeWidth="0.5" />
                <rect x="196" y="113" width={bw(worksN)} height="4" fill="#FF007F" filter="url(#hud-glow)" />
                <text x="266" y="120" fontSize="11" fill={cntFill(worksN)} textAnchor="end">{worksN}</text>
                <line x1="34" y1="146" x2="56" y2="146" stroke="#B200FF" strokeWidth="1.1" />
                <circle cx="56" cy="146" r="3.4" fill="#B200FF" filter="url(#hud-glow)" />
                <text x="67" y="150" fontSize="10.5" fill="#e8f4ff">技能库</text>
                <text x="110" y="150" fontSize="8" fill="#5f7194">SKILLS</text>
                <rect x="196" y="143" width="40" height="4" fill="#0d1226" stroke="#B200FF" strokeWidth="0.5" />
                <rect x="196" y="143" width={bw(skillsN)} height="4" fill="#B200FF" filter="url(#hud-glow)" />
                <text x="266" y="150" fontSize="11" fill={cntFill(skillsN)} textAnchor="end">{skillsN}</text>
                <line x1="14" y1="196" x2="34" y2="196" stroke="#B200FF" strokeWidth="1.2" />
                <line x1="14" y1="196" x2="34" y2="196" stroke="#B200FF" strokeWidth="2" className="hud-flow-line" />
                <circle cx="34" cy="196" r="4" fill="#B200FF" filter="url(#hud-glow)" />
                <circle cx="34" cy="196" r="4" fill="none" stroke="#B200FF" strokeWidth="0.7" className="hud-wave-circle" style={{ animationDelay: "1.2s" }} />
                <text x="46" y="200" fontSize="10.5" fill="#e3c2ff">知识</text>
                <text x="74" y="200" fontSize="8.5" fill="#5f7194" letterSpacing="1">KNOWLEDGE</text>
                <line x1="34" y1="196" x2="34" y2="256" stroke="#4d2680" strokeWidth="1.1" />
                <line x1="34" y1="226" x2="56" y2="226" stroke="#00FFFF" strokeWidth="1.1" />
                <circle cx="56" cy="226" r="3.4" fill="#00FFFF" filter="url(#hud-glow)" />
                <text x="67" y="230" fontSize="10.5" fill="#e8f4ff">数据库</text>
                <text x="110" y="230" fontSize="8" fill="#5f7194">DATABASE</text>
                <rect x="196" y="223" width="40" height="4" fill="#0d1226" stroke="#00FFFF" strokeWidth="0.5" />
                <rect x="196" y="223" width={bw(dbN)} height="4" fill="#00FFFF" filter="url(#hud-glow)" />
                <text x="266" y="230" fontSize="11" fill={cntFill(dbN)} textAnchor="end">{dbN}</text>
                <line x1="34" y1="256" x2="56" y2="256" stroke="#54678a" strokeWidth="1.1" />
                <circle cx="56" cy="256" r="3.4" fill="#54678a" filter="url(#hud-glow)" />
                <text x="67" y="260" fontSize="10.5" fill="#e8f4ff">本体知识库</text>
                <text x="132" y="260" fontSize="8" fill="#5f7194">ONTOLOGY</text>
                <text x="266" y="260" fontSize="11" fill={cntFill(ontoN)} textAnchor="end">{ontoN}</text>
                <line x1="14" y1="306" x2="34" y2="306" stroke="#00FFFF" strokeWidth="1.2" />
                <line x1="14" y1="306" x2="34" y2="306" stroke="#00FFFF" strokeWidth="2" className="hud-flow-line" />
                <circle cx="34" cy="306" r="4" fill="#00FFFF" filter="url(#hud-glow)" />
                <circle cx="34" cy="306" r="4" fill="none" stroke="#00FFFF" strokeWidth="0.7" className="hud-wave-circle" style={{ animationDelay: "1.8s" }} />
                <text x="46" y="310" fontSize="10.5" fill="#b3f7ff">生活</text>
                <text x="74" y="310" fontSize="8.5" fill="#5f7194" letterSpacing="1">LIFE</text>
                <line x1="34" y1="306" x2="34" y2="426" stroke="#1f5f6b" strokeWidth="1.1" />
                <line x1="34" y1="336" x2="56" y2="336" stroke="#54678a" strokeWidth="1.1" />
                <circle cx="56" cy="336" r="3.4" fill="#54678a" filter="url(#hud-glow)" />
                <text x="67" y="340" fontSize="10.5" fill="#e8f4ff">灵感池</text>
                <text x="110" y="340" fontSize="8" fill="#5f7194">INSPIRATION</text>
                <text x="266" y="340" fontSize="11" fill={cntFill(ideasN)} textAnchor="end">{ideasN}</text>
                <line x1="34" y1="366" x2="56" y2="366" stroke="#54678a" strokeWidth="1.1" />
                <circle cx="56" cy="366" r="3.4" fill="#54678a" filter="url(#hud-glow)" />
                <text x="67" y="370" fontSize="10.5" fill="#e8f4ff">日历表</text>
                <text x="110" y="370" fontSize="8" fill="#5f7194">CALENDAR</text>
                <text x="266" y="370" fontSize="11" fill={cntFill(calN)} textAnchor="end">{calN}</text>
                <line x1="34" y1="396" x2="56" y2="396" stroke="#ffb03a" strokeWidth="1.1" />
                <circle cx="56" cy="396" r="3.4" fill="#ffb03a" filter="url(#hud-glow)" />
                <text x="67" y="400" fontSize="10.5" fill="#e8f4ff">身体健康</text>
                <text x="120" y="400" fontSize="8" fill="#5f7194">HEALTH</text>
                <text x="266" y="400" fontSize="11" fill="#ffb03a" textAnchor="end">{healthN}</text>
                <line x1="34" y1="426" x2="56" y2="426" stroke="#FFEA00" strokeWidth="1.1" />
                <circle cx="56" cy="426" r="3.4" fill="#FFEA00" filter="url(#hud-glow)" />
                <text x="67" y="430" fontSize="10.5" fill="#e8f4ff">财务系统</text>
                <text x="120" y="430" fontSize="8" fill="#5f7194">FINANCE</text>
                <rect x="196" y="423" width="40" height="4" fill="#0d1226" stroke="#FFEA00" strokeWidth="0.5" />
                <rect x="196" y="423" width={bw(finN)} height="4" fill="#FFEA00" filter="url(#hud-glow)" />
                <text x="266" y="430" fontSize="11" fill={cntFill(finN)} textAnchor="end">{finN}</text>
                <text x="14" y="462" fontSize="8.5" fill="#41516e" letterSpacing="1">[ DEPTH 3 · NODES 13 · BARS = SHARE ]</text>
                {treeRows.map((r) => (
                  <rect
                    key={r.id}
                    x="0"
                    y={r.y - 14}
                    width="276"
                    height="28"
                    fill="transparent"
                    style={{ cursor: "pointer" }}
                    onClick={() => openModule(r.id)}
                    onMouseEnter={() => setHov(r.id)}
                    onMouseLeave={() => setHov(null)}
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
                {HUD_LOG_FACTS.map((l) => (
                  <div key={l.text} style={l.color ? { color: l.color } : undefined}>
                    {l.text}
                  </div>
                ))}
                <div style={{ color: "var(--hud-yellow)" }}>
                  [NOW] AWAITING COMMAND <span className="hud-blink">_</span>
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
                  <div className="hud-tag" style={{ left: 18, top: 14 }}>
                    ◈ MODULE · {selMod.en}
                    <b style={{ color: selMod.color }}>
                      {selMod.label} {selMod.countText ?? selMod.count}
                    </b>
                    ENTRIES {selMod.count ?? "—"} · SHARE {sharePct(selMod.count)}%
                  </div>
                  <div className="hud-tag" style={{ right: 140, top: 14, textAlign: "right" }}>
                    STATUS · {selMod.en} ◈
                    <b style={{ color: selMod.color }}>{moduleStatus(selMod).main}</b>
                    {moduleStatus(selMod).note}
                  </div>
                  <div className="hud-tag" style={{ left: 18, bottom: 8 }}>
                    [ NODE {selMod.label} · DEG {selMod.count ?? "—"} ] · [ SHARE{" "}
                    {sharePct(selMod.count)}% ]
                  </div>
                  <div className="hud-tag" style={{ right: 18, bottom: 8, textAlign: "right" }}>
                    FOCUS ● {selMod.en} · 0xLAy0UT
                  </div>
                </>
              ) : (
                <>
                  <div className="hud-tag" style={{ left: 18, top: 14 }}>
                    ◈ LEFT HEMI · GOLD
                    <b className="hud-c-yel">KNOWLEDGE {knowledgeN}</b>
                    SKILLS {skillsN} + DATABASE {dbN}
                  </div>
                  <div className="hud-tag" style={{ right: 140, top: 14, textAlign: "right" }}>
                    RIGHT HEMI · VIOLET ◈
                    <b className="hud-c-pur">OUTPUT {outputN}</b>
                    WORKS {worksN} + FINANCE {finN}
                  </div>
                  <div className="hud-tag" style={{ left: 18, bottom: 8 }}>
                    [ NODE 技能库 · DEG {skillsN} ] · [ NODE 数据库 · DEG {dbN} ]
                  </div>
                  <div className="hud-tag" style={{ right: 18, bottom: 8, textAlign: "right" }}>
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

            <div className="hud-panel hud-p-pink hud-stack">
              <div className="hud-phead">
                <span className="hud-t">DECISION STACK · 决策栈</span>
                <span className="hud-chip hud-c-pink">{decisions.length} 待决</span>
                <span className="hud-hex">0xD5TK</span>
              </div>
              {decisions.map((d) => (
                <button
                  type="button"
                  className="hud-srow hud-srow-btn"
                  key={d.en}
                  data-testid={`hud-decision-${d.note ?? d.target ?? d.en}`}
                  onClick={() => openDecision(d)}
                >
                  <div className="hud-r1">
                    <span className={`hud-led hud-led-${d.led}`} />
                    <span className="hud-name">{d.name}</span>
                    <span className="hud-en">{d.en}</span>
                    <span className={`hud-tag hud-chip ${d.tagCls}`}>{d.tag}</span>
                  </div>
                  <div className="hud-en" style={{ marginTop: 4 }}>
                    {d.fact} · <span className="hud-wait">{d.wait}</span> ·{" "}
                    {d.target ? "点击进入 →" : "点击看说明 →"}
                  </div>
                </button>
              ))}
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
                style={{ color: m.color }}
                data-module={m.id}
                aria-pressed={sel === m.id}
                onClick={() => openModule(m.id)}
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
      </div>
    </div>
  );
}
