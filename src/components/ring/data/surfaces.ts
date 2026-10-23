/**
 * 星环 12 环位定义与读取器（键名集中一处，方案 §3.2 data/surfaces.ts）。
 *
 * 每一槽的取数口径都在下方逐槽注明出处，全部只读：
 *  - 业务槽（1–8）与第一主题落地页同源同键；其中财务/健康与落地页
 *    customModuleCount 同口径（finEntries.length / healthCheckins.length），
 *    日历与落地页节点同口径（calItems.length），技能走 /skills-sync.json
 *    实文件（落地页同源），快照直接 import 登记册 SLICES（不复制数字）。
 *  - 数据库（4）：落地页数据库枢纽行 = 技能/流水线镜像行 + 手加行，
 *    持久化在 studio_hub_rows_v1["right"]；该键未落盘时按镜像派生
 *    （技能数 + 流水线步数），与落地页 hub 同步效应同口径。
 *  - 决策栈（11）：待决数与落地页 pendingCount 同口径——代码内建
 *    6 条决策（id 集见 DECISION_IDS，与 neural-landing 决策栈同源）
 *    减去 studio_decision_archived_v1 命中的归档数。
 *  - 健康同步（12）：/health-sync.json 可达即 OK（落地页顶栏同判定），
 *    距今时长自 updated_at 实算；不可达 → STALE + 「—」。
 * localStorage 键缺失（从未写入）对计数槽按「该仓为空」处理：多为
 * 种子态未落盘，显示 0/灰；唯灵感池种子步数只存在于 page.tsx 常量、
 * 星环不 import 页面内部常量，键缺失时显示「—」（不知为不知）。
 */
import { SLICES } from "@/components/studio/snapshot";
import {
  ageText,
  eventRatePerMin,
  execLineText,
  todayShISO,
} from "./derive";
import type {
  ExecLogItem,
  HealthSync,
  RingData,
  SkillsSync,
  SlotData,
  SlotDef,
} from "./types";

export const SLOT_DEFS: SlotDef[] = [
  { idx: 1, id: "inspiration", cn: "灵感池", en: "INSPIRATION", short: "INSP", srcLabel: "studio_workflow_steps_v2 · 流水线步数" },
  { idx: 2, id: "skills", cn: "技能库", en: "SKILLS", short: "SKILL", srcLabel: "/skills-sync.json · 技能条数" },
  { idx: 3, id: "works", cn: "作品库", en: "WORKS", short: "WORK", srcLabel: "studio_works_items_v1 · 作品条数" },
  { idx: 4, id: "database", cn: "数据库", en: "DATABASE", short: "DATA", srcLabel: "studio_hub_rows_v1 · 数据库枢纽行" },
  { idx: 5, id: "ontology", cn: "本体知识库", en: "ONTOLOGY", short: "ONTO", srcLabel: "studio_ontology_notes_v1 · 条目数" },
  { idx: 6, id: "calendar", cn: "日历表", en: "CALENDAR", short: "CAL", srcLabel: "studio_calendar_items_v1 · 事项数 / 今日" },
  { idx: 7, id: "health", cn: "身体健康", en: "HEALTH", short: "HEAL", srcLabel: "studio_health_checkins_v1 · 打卡天数" },
  { idx: 8, id: "finance", cn: "财务系统", en: "FINANCE", short: "FIN", srcLabel: "studio_finance_entries_v1 · 账目条数" },
  { idx: 9, id: "snapshot", cn: "快照登记册", en: "SNAPSHOT", short: "SNAP", srcLabel: "SLICES · 快照登记册（代码实测长度）" },
  { idx: 10, id: "exec-log", cn: "执行日志", en: "EXEC LOG", short: "LOG", srcLabel: "studio_exec_log_v1 · EXEC_LOG_MAX = 20" },
  { idx: 11, id: "decision", cn: "决策栈", en: "DECISION", short: "DEC", srcLabel: "studio_decision_picks_v1 + _archived_v1" },
  { idx: 12, id: "health-sync", cn: "健康同步", en: "HEALTH-SYNC", short: "SYNC", srcLabel: "/health-sync.json · updated_at → OK / STALE" },
];

/** 落地页决策栈的内建决策 id 集（neural-landing decisions 数组同源；
 * 待决数 = 本集减去已归档命中数，与落地页 pendingCount 严格一致）。 */
const DECISION_IDS = [
  "ep001",
  "health-sync",
  "calendar-tickets",
  "xhs-decision",
  "ontology-build",
  "x-resume",
];

/** 作品库种子（hud-module-content WORK_SEED_ITEMS 同源）：键未落盘时
 * 工作台即以这 2 条种子呈现，星环计数同口径。 */
const WORKS_SEED_STATUSES = ["待公开", "待发布"];

/* ── 基础读取（全部只读，异常即缺失） ── */

const readRaw = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const readJson = (key: string): unknown => {
  const raw = readRaw(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
};

const readArr = (key: string): unknown[] | null => {
  const v = readJson(key);
  return Array.isArray(v) ? v : null;
};

const isExecLogItem = (x: unknown): x is ExecLogItem => {
  if (typeof x !== "object" || x === null) return false;
  const o = x as { ts?: unknown; text?: unknown; type?: unknown };
  return (
    typeof o.ts === "number" &&
    Number.isFinite(o.ts) &&
    (typeof o.text === "string" || typeof o.type === "string")
  );
};

/** 与落地页 loadExecLog 同口径：过滤 + 截尾 20。 */
export const loadExecLog = (): ExecLogItem[] => {
  const v = readArr("studio_exec_log_v1");
  if (!v) return [];
  return v.filter(isExecLogItem).slice(-20);
};

type HubRows = Record<string, { id: string }[]>;

const loadHubRows = (): HubRows | null => {
  const v = readJson("studio_hub_rows_v1");
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  return v as HubRows;
};

/* ── 主读取：一次拿齐原料并派生 12 槽 ── */

export async function loadRingData(): Promise<RingData> {
  const [skillsRes, healthRes] = await Promise.allSettled([
    fetch("/skills-sync.json", { cache: "no-store" }).then((r) =>
      r.ok ? (r.json() as Promise<SkillsSync>) : Promise.reject(new Error("skills")),
    ),
    fetch("/health-sync.json", { cache: "no-store" }).then((r) =>
      r.ok ? (r.json() as Promise<HealthSync>) : Promise.reject(new Error("health")),
    ),
  ]);
  const skills: SkillsSync =
    skillsRes.status === "fulfilled" ? skillsRes.value : null;
  const health: HealthSync =
    healthRes.status === "fulfilled" ? healthRes.value : null;

  const now = Date.now();
  const execLog = loadExecLog();
  const hubRows = loadHubRows();

  /* 技能 */
  const skillGroups = (skills?.agents ?? []).map((a) => ({
    agentId: a.id,
    skills: a.skills ?? [],
  }));
  const skillsTotal = skillGroups.reduce((a, g) => a + g.skills.length, 0);
  const grokN = skillGroups.find((g) => g.agentId === "grokbot")?.skills.length ?? 0;
  const lunaN = skillGroups.find((g) => g.agentId === "luna")?.skills.length ?? 0;

  /* 灵感池：步数 + 枢纽手加行（hub "top" 中非流水线派生的行） */
  const steps = readArr("studio_workflow_steps_v2");
  const stepIds = new Set(
    (steps ?? [])
      .map((s) => (s as { id?: unknown })?.id)
      .filter((x): x is string => typeof x === "string"),
  );
  const topExtra = (hubRows?.["top"] ?? []).filter(
    (r) => !stepIds.has(r.id) && !r.id.startsWith("flow-"),
  ).length;
  const inspirationCount =
    steps === null ? null : steps.length + topExtra;

  /* 作品库：存储优先，种子兜底（与工作台同口径） */
  const worksStored = readArr("studio_works_items_v1");
  const worksCount = worksStored === null ? WORKS_SEED_STATUSES.length : worksStored.length;
  const worksStatuses =
    worksStored === null
      ? WORKS_SEED_STATUSES
      : worksStored
          .map((w) => (w as { status?: unknown })?.status)
          .filter((x): x is string => typeof x === "string");
  const worksStatusText = (() => {
    const m = new Map<string, number>();
    for (const s of worksStatuses) m.set(s, (m.get(s) ?? 0) + 1);
    return [...m.entries()].map(([k, v]) => `${k} ${v}`).join(" · ");
  })();

  /* 数据库：枢纽行落盘值优先，未落盘按镜像派生（技能 + 步数行） */
  const rightRows = hubRows?.["right"];
  const databaseCount =
    rightRows !== undefined
      ? rightRows.length
      : skillsTotal + (steps?.length ?? 0);

  /* 本体 / 日历 / 健康 / 财务：各仓条数（键缺失 = 仓为空） */
  const ontologyCount = readArr("studio_ontology_notes_v1")?.length ?? 0;
  const calItems = readArr("studio_calendar_items_v1") ?? [];
  const todayISO = todayShISO();
  const calToday = calItems.filter(
    (i) => (i as { date?: unknown })?.date === todayISO,
  ).length;
  const healthCount = readArr("studio_health_checkins_v1")?.length ?? 0;
  const financeCount = readArr("studio_finance_entries_v1")?.length ?? 0;

  /* 决策栈：待决 = 内建 6 − 归档命中；意向数兼容数组/对象两形态 */
  const archivedArr = readArr("studio_decision_archived_v1") ?? [];
  const archivedIds = archivedArr.filter(
    (x): x is string => typeof x === "string",
  );
  const archivedSet = new Set(archivedIds);
  const decisionPending = DECISION_IDS.filter((id) => !archivedSet.has(id)).length;
  const picksRaw = readJson("studio_decision_picks_v1");
  const picksCount = Array.isArray(picksRaw)
    ? picksRaw.length
    : typeof picksRaw === "object" && picksRaw !== null
      ? Object.keys(picksRaw).length
      : 0;

  /* 健康同步：文件可达即 OK（落地页顶栏同判定） */
  const healthUpdated =
    typeof health?.updated_at === "string" ? health.updated_at : null;
  const healthAgeMs = healthUpdated ? now - Date.parse(healthUpdated) : NaN;
  const healthOk = health !== null && healthUpdated !== null;

  /* 底栏槽 1：模块数 = 9 内建 + 自定义模块数；实体/行数按落地页
   * MIRROR_OF 口径（数据库为技能镜像，不计实体、计行）。 */
  const customModules = (readArr("studio_custom_modules_v1") ?? []) as {
    id?: unknown;
  }[];
  const modulesCount = 9 + customModules.length;
  const customRowsRaw = readJson("studio_custom_rows_v1");
  const customRows: Record<string, unknown[]> =
    typeof customRowsRaw === "object" &&
    customRowsRaw !== null &&
    !Array.isArray(customRowsRaw)
      ? (customRowsRaw as Record<string, unknown[]>)
      : {};
  const KNOWN_CUSTOM = new Set(["health", "finance", "ontology"]);
  const extrasEntities = customModules.reduce((a, m) => {
    const id = (m as { id?: unknown })?.id;
    if (typeof id !== "string" || KNOWN_CUSTOM.has(id)) return a;
    const rowsFor = customRows[id];
    return a + (Array.isArray(rowsFor) ? rowsFor.length : 0);
  }, 0);
  const entitiesKnown =
    inspirationCount !== null && skills !== null;
  const entitiesCount = entitiesKnown
    ? (inspirationCount ?? 0) +
      skillsTotal +
      worksCount +
      ontologyCount +
      calItems.length +
      healthCount +
      financeCount +
      extrasEntities
    : null;
  const rowsCount =
    entitiesCount !== null ? entitiesCount + databaseCount : null;

  const lastItem = execLog[execLog.length - 1];
  /* LAST EVENT 播报：execLineText 原文（自带 [HH:MM:SS] 前缀）。 */
  const lastEventLine = lastItem ? execLineText(lastItem) : null;

  const numeric: (number | null)[] = [
    inspirationCount, skills ? skillsTotal : null, worksCount, databaseCount,
    ontologyCount, calItems.length, healthCount, financeCount,
    SLICES.length, execLog.length, decisionPending, null,
  ];
  const maxNumeric = Math.max(1, ...numeric.map((n) => n ?? 0));
  const ratioOf = (n: number | null): number =>
    n === null ? 0 : Math.min(1, n / maxNumeric);
  const activityOf = (n: number | null): number =>
    n === null ? 0.18 : 0.25 + 0.75 * ratioOf(n);

  const slots: SlotData[] = [
    {
      count: inspirationCount,
      src:
        inspirationCount === null
          ? "studio_workflow_steps_v2 · 键未落盘（种子步数在页面常量内，星环不臆测）"
          : `studio_workflow_steps_v2 · 流水线 ${steps?.length ?? 0} 步${topExtra ? ` + 手加行 ${topExtra}` : ""}`,
      state: inspirationCount === null ? "unknown" : inspirationCount > 0 ? "ok" : "zero",
      ratio: ratioOf(inspirationCount),
      activity: activityOf(inspirationCount),
    },
    {
      count: skills ? skillsTotal : null,
      src: `/skills-sync.json · GROKBOT ${grokN} 冰蓝 / LUNA ${lunaN} 品红`,
      state: skills ? "ok" : "unknown",
      ratio: ratioOf(skills ? skillsTotal : null),
      activity: skills ? activityOf(skillsTotal) : 0.18,
    },
    {
      count: worksCount,
      src: `studio_works_items_v1 · ${worksStatusText || "作品条数"}`,
      state: worksCount > 0 ? "ok" : "zero",
      ratio: ratioOf(worksCount),
      activity: activityOf(worksCount),
    },
    {
      count: databaseCount,
      src:
        rightRows !== undefined
          ? "studio_hub_rows_v1[right] · 数据库枢纽行（技能镜像 + 手加行）"
          : "技能 + 流水线镜像派生 · 数据库枢纽行（未落盘口径）",
      state: databaseCount > 0 ? "ok" : "zero",
      ratio: ratioOf(databaseCount),
      activity: activityOf(databaseCount),
    },
    {
      count: ontologyCount,
      src: "studio_ontology_notes_v1 · 站内笔记条目数",
      state: ontologyCount > 0 ? "ok" : "zero",
      ratio: ratioOf(ontologyCount),
      activity: activityOf(ontologyCount),
    },
    {
      count: calItems.length,
      src: `studio_calendar_items_v1 · 事项 ${calItems.length} · 今日 ${calToday}`,
      state: calItems.length > 0 ? "ok" : "zero",
      ratio: ratioOf(calItems.length),
      activity: activityOf(calItems.length),
    },
    {
      count: healthCount,
      src: "studio_health_checkins_v1 · 打卡天数",
      state: healthCount > 0 ? "ok" : "zero",
      ratio: ratioOf(healthCount),
      activity: activityOf(healthCount),
    },
    {
      count: financeCount,
      src: "studio_finance_entries_v1 · 账目条数",
      state: financeCount > 0 ? "ok" : "zero",
      ratio: ratioOf(financeCount),
      activity: activityOf(financeCount),
    },
    {
      count: SLICES.length,
      unit: "片",
      src: "SLICES · 快照登记册（import 实测长度）",
      state: "ok",
      ratio: ratioOf(SLICES.length),
      activity: activityOf(SLICES.length),
    },
    {
      count: execLog.length,
      src: `studio_exec_log_v1 · 条数（上限 20）${lastItem ? ` · 最近 ${new Date(lastItem.ts).toTimeString().slice(0, 5)}` : ""}`,
      state: execLog.length > 0 ? "ok" : "zero",
      ratio: execLog.length / 20,
      activity: activityOf(execLog.length),
    },
    {
      count: decisionPending,
      src: `待决 ${decisionPending} · 意向 ${picksCount} · 已归档 ${archivedIds.length}（picks + archived 键）`,
      state: decisionPending > 0 ? "ok" : "zero",
      ratio: ratioOf(decisionPending),
      activity: activityOf(decisionPending),
    },
    {
      count: null,
      countText: healthOk ? "OK" : "STALE",
      src: healthOk
        ? `/health-sync.json · updated_at ${healthUpdated!.slice(5, 16).replace("T", " ")} · 距今 ${ageText(healthAgeMs)}`
        : "/health-sync.json · 不可达或无 updated_at",
      state: healthOk ? "ok" : "stale",
      ratio: healthOk ? 0.9 : 0.25,
      activity: healthOk ? 0.9 : 0.45,
    },
  ];

  return {
    slots,
    skillGroups,
    execLog,
    modulesCount,
    entitiesCount,
    rowsCount,
    eventRate: eventRatePerMin(execLog),
    todayCalendar: calToday,
    lastEventLine,
    loadedAt: now,
  };
}
