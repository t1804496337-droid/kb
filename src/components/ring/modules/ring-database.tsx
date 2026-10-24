"use client";

/** 第二主题 · 数据库：三区索引只读镜像（技能 / 流程 / 条目）。
 * 不产生独立数据，不做 CRUD，不落盘分段状态，不发总线。
 * 条目索引 entryRows 与挂载侧 DatabaseBody 逐字同口径：两条写死
 * 作品行 + 财务现行 localStorage 映射 + 睡眠汇总行（含 manualWins
 * 合并口径与 STALE/FRESH 判定）。 */

import { useEffect, useState } from "react";
import RingModuleShell from "./ring-module-shell";
import skillsSyncJson from "../../../../public/skills-sync.json";
import healthSyncJson from "../../../../public/health-sync.json";

type SkillEntry = { id: string; zh?: string; name: string; source?: string };
type SkillAgentGroup = { id: string; name: string; skills: SkillEntry[] };
type FlowStep = {
  id?: string;
  title: string;
  zone: "me" | "ai" | "agent";
  note?: string;
  status?: string;
  platform?: string;
};
type FinanceEntry = {
  id: string;
  date: string;
  kind: "income" | "expense";
  amount: number;
  category: string;
  note: string;
  source?: string;
};
type ManualHealth = {
  date: string;
  sleepHours?: number;
  sleepStart?: string;
  sleepEnd?: string;
  steps?: number;
};

const SKILLS_SYNC = skillsSyncJson as unknown as {
  agents: SkillAgentGroup[];
  updated_at?: string;
};
const ALL_SKILLS: SkillEntry[] = SKILLS_SYNC.agents.flatMap((a) => a.skills);
const agentOf = (skillId: string): string =>
  SKILLS_SYNC.agents.find((a) => a.skills.some((x) => x.id === skillId))?.name ?? "";

const FLOW_ZONES: { id: FlowStep["zone"]; label: string; en: string }[] = [
  { id: "me", label: "我", en: "ME" },
  { id: "ai", label: "AI", en: "AI" },
  { id: "agent", label: "Agent", en: "AGENT" },
];
const FLOW_STAGES: { id: string; label: string }[] = [
  { id: "incubate", label: "孵化" },
  { id: "produce", label: "制作" },
  { id: "ready", label: "待发" },
];
const stageOf = (s: FlowStep): string =>
  s.status === "produce" || s.status === "ready" ? s.status : "incubate";
const stageLabel = (st: string) =>
  FLOW_STAGES.find((x) => x.id === st)?.label ?? "孵化";

const FIN_ENTRIES_KEY = "studio_finance_entries_v1";
const FIN_SEEDED_KEY = "studio_finance_seeded_v1";
/* 与挂载侧 FIN_SEED_ENTRIES 逐字同源。 */
const FIN_SEED_ENTRIES: FinanceEntry[] = [
  {
    id: "fin-seed-ledger-1",
    date: "2026-10-17",
    kind: "expense",
    amount: 22,
    category: "日用",
    note: "水+烟",
    source: "ledger",
  },
  {
    id: "fin-seed-ledger-2",
    date: "2026-10-17",
    kind: "expense",
    amount: 401.54,
    category: "还款",
    note: "微信分付还款",
    source: "ledger",
  },
];
const round2 = (n: number) => Math.round(n * 100) / 100;
const fmtMoney = (n: number): string =>
  `¥${round2(n).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;

function readFinanceEntries(): FinanceEntry[] {
  try {
    const rawE = window.localStorage.getItem(FIN_ENTRIES_KEY);
    let loaded: FinanceEntry[] = [];
    if (rawE) {
      const arr = JSON.parse(rawE) as FinanceEntry[];
      if (Array.isArray(arr)) {
        loaded = arr.filter(
          (e) =>
            e &&
            typeof e.id === "string" &&
            typeof e.date === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
            (e.kind === "income" || e.kind === "expense") &&
            typeof e.amount === "number" &&
            Number.isFinite(e.amount) &&
            typeof e.category === "string",
        );
      }
    }
    if (!window.localStorage.getItem(FIN_SEEDED_KEY)) {
      if (!rawE) {
        loaded = [...FIN_SEED_ENTRIES];
        window.localStorage.setItem(FIN_ENTRIES_KEY, JSON.stringify(loaded));
      }
      window.localStorage.setItem(FIN_SEEDED_KEY, "1");
    }
    return loaded;
  } catch {
    return [];
  }
}

const HEALTH_MANUAL_KEY = "studio_health_manual_v1";
const isRealDate = (d: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(y, m - 1, day);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === day;
};
function loadManualHealth(): ManualHealth | null {
  try {
    const raw = window.localStorage.getItem(HEALTH_MANUAL_KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const o = v as Record<string, unknown>;
    if (typeof o.date !== "string" || !isRealDate(o.date)) return null;
    const m: ManualHealth = { date: o.date };
    if (typeof o.sleepHours === "number" && Number.isFinite(o.sleepHours))
      m.sleepHours = o.sleepHours;
    if (typeof o.sleepStart === "string") m.sleepStart = o.sleepStart;
    if (typeof o.sleepEnd === "string") m.sleepEnd = o.sleepEnd;
    if (typeof o.steps === "number" && Number.isFinite(o.steps) && o.steps >= 0)
      m.steps = Math.round(o.steps);
    if (m.sleepHours === undefined && m.steps === undefined) return null;
    return m;
  } catch {
    return null;
  }
}
/* 与 health-effective manualWins 逐字一致：manual 日期 >= 文件最新
 * 睡眠日（或文件无记录）时手动为准。 */
function manualWins(manual: ManualHealth | null, fileLastDate: string | null): boolean {
  if (!manual) return false;
  if (!fileLastDate) return true;
  return manual.date >= fileLastDate;
}

type HealthSyncStatic = {
  sleep?: {
    last?: { date: string; start?: string; end?: string; hours: number };
    last7?: { date: string; hours: number }[];
  };
};
const HEALTH_SYNC_STATIC = healthSyncJson as unknown as HealthSyncStatic;

function readSteps(): FlowStep[] {
  try {
    const raw = window.localStorage.getItem("studio_workflow_steps_v2");
    if (!raw) return [];
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return (v as FlowStep[]).filter(
      (s) =>
        s &&
        typeof s.title === "string" &&
        (s.zone === "me" || s.zone === "ai" || s.zone === "agent"),
    );
  } catch {
    return [];
  }
}

type EntryRow = { id: string; title: string; sub: string; kind: string; cls: string };
type TabId = "skills" | "flow" | "entries";

export default function RingDatabase() {
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [finEntries, setFinEntries] = useState<FinanceEntry[]>([]);
  const [manual, setManual] = useState<ManualHealth | null>(null);
  const [loaded, setLoaded] = useState(false);
  /* 分段切换纯前端状态，不落盘（挂载侧同口径）。 */
  const [tab, setTab] = useState<TabId>("skills");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /* 预渲染守卫拦截渲染侧无参 new Date()：日期在挂载 effect 内赋值。 */
  const [todayStr, setTodayStr] = useState<string | null>(null);

  useEffect(() => {
    setSteps(readSteps());
    setFinEntries(readFinanceEntries());
    setManual(loadManualHealth());
    const now = new Date();
    const p2 = (n: number) => String(n).padStart(2, "0");
    setTodayStr(`${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`);
    setLoaded(true);
  }, []);

  const fileSleep = HEALTH_SYNC_STATIC.sleep;
  const mWins = manualWins(manual, fileSleep?.last?.date ?? null);
  const manualSleep =
    mWins && manual && manual.sleepHours !== undefined ? manual : null;
  const effLastSleep = manualSleep
    ? { date: manualSleep.date, hours: manualSleep.sleepHours as number }
    : fileSleep?.last;
  const sleepDates = new Set<string>((fileSleep?.last7 ?? []).map((s) => s.date));
  if (manualSleep) sleepDates.add(manualSleep.date);
  const sleepN = sleepDates.size;
  const sleepStale =
    !effLastSleep || (todayStr !== null && effLastSleep.date < todayStr);

  const entryRows: EntryRow[] = [
    {
      id: "e-yt-ep01",
      title: "YouTube EP001 · Latent Space 首片",
      sub: "作品库 · 已上传 · 待公开",
      kind: "WORKS",
      cls: "rm-chipPink",
    },
    {
      id: "e-sph-ep01",
      title: "视频号 ep01 · 配音已定稿待发布",
      sub: "作品库 · 成片槽位",
      kind: "WORKS",
      cls: "rm-chipPink",
    },
    ...finEntries.map((e) => ({
      id: `e-${e.id}`,
      title: `台账 · ${e.note} ${fmtMoney(e.amount)}`,
      sub: `财务系统 · ${e.date} · ${e.category}`,
      kind: "FINANCE",
      cls: "rm-chipYel",
    })),
    {
      id: "e-sleep",
      title: `健康同步 · 睡眠记录 ${sleepN} 晚`,
      sub: `身体健康 · 截至 ${effLastSleep?.date ?? "—"} · ${sleepStale ? "STALE" : "FRESH"}`,
      kind: "HEALTH",
      cls: sleepStale ? "rm-chipAmb" : "rm-chipGrn",
    },
  ];

  const tabs: { id: TabId; label: string; en: string; n: number }[] = [
    { id: "skills", label: "技能索引", en: "SKILLS", n: ALL_SKILLS.length },
    { id: "flow", label: "流程索引", en: "WORKFLOW", n: steps.length },
    { id: "entries", label: "条目索引", en: "ENTRIES", n: entryRows.length },
  ];

  type DetailRow = { id: string; title: string; sub: string; fields: [string, string][] };
  let rows: DetailRow[] = [];
  if (tab === "skills") {
    rows = ALL_SKILLS.map((s) => ({
      id: `db-s-${s.id}`,
      title: `${s.zh ?? s.name} · ${s.name}`,
      sub: `${s.source ?? ""} · ${agentOf(s.id)}`,
      fields: [
        ["ID", s.id],
        ["中文", s.zh ?? "—"],
        ["名称", s.name],
        ["来源", s.source ?? "—"],
        ["归属", agentOf(s.id) || "—"],
      ],
    }));
  } else if (tab === "flow") {
    rows = steps.map((s) => ({
      id: `db-f-${s.id ?? s.title}`,
      title: s.title,
      sub: s.note ?? "",
      fields: [
        ["ID", String(s.id ?? "—")],
        ["分区", FLOW_ZONES.find((z) => z.id === s.zone)?.label ?? s.zone],
        ["阶段", stageLabel(stageOf(s))],
        ["平台", s.platform ?? "—"],
        ["备注", s.note ?? "—"],
      ],
    }));
  } else {
    rows = entryRows.map((r) => ({
      id: `db-${r.id}`,
      title: r.title,
      sub: r.sub,
      fields: [
        ["ID", r.id],
        ["类型", r.kind],
        ["说明", r.sub],
      ],
    }));
  }
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;
  const switchTab = (t: TabId) => {
    setTab(t);
    setSelectedId(null);
  };

  return (
    <RingModuleShell
      active="database"
      cn="数据库"
      en="DATABASE"
      src="三区索引 · 技能 / 流程 / 条目"
      count={loaded ? entryRows.length + ALL_SKILLS.length + steps.length : null}
      note="全站总索引 · 只读镜像，不产生独立数据"
      detail={
        <div>
          <div className="rm-detailHead">选中条目 · DETAIL</div>
          {selected ? (
            <div>
              <div className="rm-detailTitle">{selected.title}</div>
              {selected.sub ? (
                <div className="rm-row">
                  <div className="rm-rowMain">
                    <div className="rm-rowSub">说明</div>
                    <div className="rm-rowT">{selected.sub}</div>
                  </div>
                </div>
              ) : null}
              {selected.fields.map(([k, v]) => (
                <div key={k} className="rm-row">
                  <div className="rm-rowMain">
                    <div className="rm-rowSub">{k}</div>
                    <div className="rm-rowT">{v}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rm-empty">暂无选中条目</div>
          )}
          <div className="rm-sec" style={{ marginTop: 26 }}>
            <div className="rm-secHead">
              <span className="rm-secCn">镜像说明</span>
              <span className="rm-secEn">MIRROR</span>
            </div>
            <div className="rm-rowSub">
              不计实体 · 与挂载侧同口径：技能来自 /skills-sync.json，流程与灵感池同源，条目跨模块登记。
            </div>
          </div>
        </div>
      }
    >
      <div className="rm-sec">
        <div className="rm-secHead">
          <span className="rm-secCn">索引分区</span>
          <span className="rm-secEn">INDEX SEGMENTS</span>
          <span className="rm-secNote">一次显示一区 · 切换不落盘</span>
        </div>
        <div className="rm-dbSeg" role="tablist" aria-label="数据库索引分区">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`rm-dbSegBtn${tab === t.id ? " is-on" : ""}`}
              data-testid={`rm-db-seg-${t.id}`}
              onClick={() => switchTab(t.id)}
            >
              {t.label}
              <span className="rm-dbSegEn">{t.en}</span>
              <span className="rm-dbSegN">{t.n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rm-sec">
        <div className="rm-secHead">
          <span className="rm-secCn">
            {tabs.find((t) => t.id === tab)?.label}
          </span>
          <span className="rm-secEn">
            {tab === "skills"
              ? "SKILLS INDEX"
              : tab === "flow"
                ? "WORKFLOW INDEX"
                : "ENTRY INDEX"}
          </span>
          <span className="rm-secNote">
            {tab === "skills"
              ? `源 skills-sync.json · ${ALL_SKILLS.length} 条`
              : tab === "flow"
                ? `与灵感池同源 studio_workflow_steps_v2 · ${steps.length} 步`
                : `跨模块登记 · ${entryRows.length} 条`}
          </span>
        </div>
        {tab === "skills" ? (
          <div className="rm-dbGrid">
            {ALL_SKILLS.map((s) => (
              <div
                key={`db-s-${s.id}`}
                className={`rm-dbCard${selected?.id === `db-s-${s.id}` ? " rm-dbCardActive" : ""}`}
                data-testid={`rm-db-s-${s.id}`}
                onClick={() => setSelectedId(`db-s-${s.id}`)}
              >
                <div className="rm-rowMain">
                  <div className="rm-rowT">
                    {s.zh} · {s.name}
                  </div>
                  <div className="rm-rowSub">
                    {s.source} · {agentOf(s.id)}
                  </div>
                </div>
                <span className="rm-chip rm-chipCyan">SKILL</span>
              </div>
            ))}
          </div>
        ) : null}
        {tab === "flow" ? (
          steps.length > 0 ? (
            <div className="rm-dbList">
              {steps.map((s) => (
                <div
                  key={`db-f-${s.id ?? s.title}`}
                  className={`rm-dbCard${selected?.id === `db-f-${s.id ?? s.title}` ? " rm-dbCardActive" : ""}`}
                  data-testid={`rm-db-f-${s.id ?? s.title}`}
                  onClick={() => setSelectedId(`db-f-${s.id ?? s.title}`)}
                >
                  <div className="rm-rowMain">
                    <div className="rm-rowT">{s.title}</div>
                    {s.note ? <div className="rm-rowSub">{s.note}</div> : null}
                  </div>
                  <span className="rm-chip rm-chipPur">
                    {FLOW_ZONES.find((z) => z.id === s.zone)?.label ?? s.zone}区
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rm-empty">
              流程 0 步 · 在灵感池新增步骤后这里同步出现
            </div>
          )
        ) : null}
        {tab === "entries" ? (
          <div className="rm-dbGrid">
            {entryRows.map((r) => (
              <div
                key={r.id}
                className={`rm-dbCard${selected?.id === `db-${r.id}` ? " rm-dbCardActive" : ""}`}
                data-testid={`rm-db-${r.id}`}
                onClick={() => setSelectedId(`db-${r.id}`)}
              >
                <div className="rm-rowMain">
                  <div className="rm-rowT">{r.title}</div>
                  <div className="rm-rowSub">{r.sub}</div>
                </div>
                <span className={`rm-chip ${r.cls}`}>{r.kind}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </RingModuleShell>
  );
}
