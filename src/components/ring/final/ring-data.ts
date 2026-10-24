/* 第二主题 · 只读数据适配层
 *
 * 三条纪律：
 * 1. 只读，绝不写任何键（本文件不含 setItem / removeItem）。
 * 2. 读不到就返回 0 并标 offline，绝不用随机数或时钟累加补位。
 * 3. 镜像模块（数据库）单独标 mirror，不计入实体总数。
 *
 * P2 只读对齐（2026-10-24）：12 个数据面的读取与派生逐项对齐主干
 * src/components/ring/data/surfaces.ts——技能与健康同步改走同源公共
 * 文件（/skills-sync.json、/health-sync.json，fetch + no-store）；
 * 作品种子兜底、灵感池手加行、数据库未落盘镜像派生、决策待决数、
 * 日志过滤截尾均与 surfaces 的 derive 同口径。快照面直接 import
 * 主干登记册 SLICES（只读导出），不复制数字。
 */

import { SLICES } from "@/components/studio/snapshot";
import { ageText, todayShISO } from "@/components/ring/data/derive";
import type { HealthSync, SkillsSync } from "@/components/ring/data/types";

export type RingMode = "live" | "standby" | "offline" | "mirror";

export type RingSlot = {
  /** AG 里的 k，同时是环带切向文字与大写标识 */
  k: string;
  /** 中文名 */
  zh: string;
  /** 一句话说明，必须是可核查的事实 */
  role: string;
  /** 条目数 */
  n: number;
  mode: RingMode;
  /** 数据来源，UI 上会显示成角标 */
  from: string;
};

export type RingData = {
  slots: Record<string, RingSlot>;
  /** 与第一主题顶栏 ENTRIES 完全同源：技能 + 作品 + 财务（不含镜像） */
  mainEntities: number;
  /** 同源行数：技能 + 数据库镜像 + 作品 + 财务 = 第一主题的 30 */
  mainRows: number;
  /** 独立实体数：所有非 mirror 的 n 之和 */
  entities: number;
  /** 行总数：含镜像 */
  rows: number;
  /** 在线 / 待命 / 未通电 的数据面数 */
  liveN: number;
  standbyN: number;
  offlineN: number;
  /** 是否有真实本地数据（用于顶部状态行文案） */
  hydrated: boolean;
};

/** 落地页决策栈内建决策 id 集（与 surfaces.ts DECISION_IDS /
 * neural-landing 决策栈同源；待决 = 本集减去已归档命中数）。 */
const DECISION_IDS = [
  "ep001",
  "health-sync",
  "calendar-tickets",
  "xhs-decision",
  "ontology-build",
  "x-resume",
];

/** 作品库种子状态（与 surfaces.ts WORKS_SEED_STATUSES /
 * hud-module-content WORK_SEED_ITEMS 同源）：键未落盘时工作台即以
 * 这 2 条种子呈现，本面计数同口径。 */
const WORKS_SEED_STATUSES = ["待公开", "待发布"];

/* ── 基础读取（全部只读；键缺失与异常严格区分，与 surfaces 同口径） ── */

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return undefined;
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function readArr(key: string): unknown[] {
  const v = readJson(key);
  return Array.isArray(v) ? v : [];
}

/** 键未落盘或值非数组 → null（作品种子兜底、灵感池未知态靠它区分）。 */
function readArrOrNull(key: string): unknown[] | null {
  const v = readJson(key);
  return Array.isArray(v) ? v : null;
}

function readHubRows(): Record<string, unknown[]> {
  const v = readJson("studio_hub_rows_v1");
  if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
  return v as Record<string, unknown[]>;
}

/** 与 surfaces.loadExecLog 同口径的条目形状过滤。 */
function isExecLogItem(x: unknown): boolean {
  if (typeof x !== "object" || x === null) return false;
  const o = x as { ts?: unknown; text?: unknown; type?: unknown };
  return (
    typeof o.ts === "number" &&
    Number.isFinite(o.ts) &&
    (typeof o.text === "string" || typeof o.type === "string")
  );
}

/* ── 远程公共文件预取（技能 / 健康同步） ──
 * 与 surfaces.loadRingData 同源同策略（fetch + cache: "no-store"）。
 * 宿主 NeuralRing 以同步快照消费本模块（挂载时读一次，storage / bus
 * 事件触发重挂载时再读），故两个 JSON 在模块加载时即启动预取：
 * ensureThree 串行注入 three 七个文件的耗时远大于这两个小文件的
 * 往返，首次快照生成时预取已经落定；此后每次 readRingData 都在后台
 * 再验一次，重挂载读到的即最新值。预取未回或失败时按纪律 2 呈现
 * （SKILLS → 0 + offline，即 surfaces 的 unknown；SYNC → STALE）。 */

type SkillsFact = { total: number; grokN: number; lunaN: number };
type HealthFact = { updatedAt: string };

let skillsFact: SkillsFact | null = null;
let healthFact: HealthFact | null = null;
let prefetchInFlight = false;

function prefetchRemote(): void {
  if (typeof window === "undefined" || prefetchInFlight) return;
  prefetchInFlight = true;
  const done = () => {
    prefetchInFlight = false;
  };
  fetch("/skills-sync.json", { cache: "no-store" })
    .then((r) =>
      r.ok ? (r.json() as Promise<SkillsSync>) : Promise.reject(new Error("skills")),
    )
    .then((j) => {
      const agents = j?.agents ?? [];
      let total = 0,
        grokN = 0,
        lunaN = 0;
      for (const a of agents) {
        const n = (a.skills ?? []).length;
        total += n;
        if (a.id === "grokbot") grokN = n;
        else if (a.id === "luna") lunaN = n;
      }
      skillsFact = { total, grokN, lunaN };
    })
    .catch(() => {
      /* 失败保持 null：SKILLS 面按 offline 呈现 */
    })
    .finally(done);
  fetch("/health-sync.json", { cache: "no-store" })
    .then((r) =>
      r.ok ? (r.json() as Promise<HealthSync>) : Promise.reject(new Error("health")),
    )
    .then((j) => {
      const u = typeof j?.updated_at === "string" ? j.updated_at : null;
      healthFact = u ? { updatedAt: u } : null;
    })
    .catch(() => {
      /* 失败保持 null：SYNC 面按 STALE 呈现 */
    })
    .finally(done);
}

/* 浏览器端模块加载即启动预取（SSR / 预渲染时 typeof window 检查跳过）。 */
prefetchRemote();

export function readRingData(): RingData {
  /* 首次调用兜底启动；后续调用后台再验，刷新缓存供下一次重挂载。 */
  prefetchRemote();

  const hub = readHubRows();

  /* 技能：/skills-sync.json，agents[].skills.length 求和（surfaces 同口径） */
  const nSkills = skillsFact?.total ?? 0;

  /* 作品：存储优先、种子兜底；状态文案按条目 status 聚合（surfaces 同口径） */
  const worksStored = readArrOrNull("studio_works_items_v1");
  const nWorks =
    worksStored === null ? WORKS_SEED_STATUSES.length : worksStored.length;
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

  /* 灵感池：流水线步数 + 枢纽 top 中非流水线派生的手加行（surfaces 同口径）；
   * steps 键未落盘 → 未知态（种子步数只在页面常量内，本面不臆测）。 */
  const steps = readArrOrNull("studio_workflow_steps_v2");
  const stepIds = new Set(
    (steps ?? [])
      .map((s) => (s as { id?: unknown })?.id)
      .filter((x): x is string => typeof x === "string"),
  );
  const topExtra = (hub.top ?? []).filter((r) => {
    const id = (r as { id?: unknown })?.id;
    return typeof id === "string" && !stepIds.has(id) && !id.startsWith("flow-");
  }).length;
  const inspireKnown = steps !== null;
  const nInspire = inspireKnown ? (steps?.length ?? 0) + topExtra : 0;

  /* 数据库：枢纽 right 落盘值优先，未落盘按镜像派生 = 技能数 + 流水线步数
   * （surfaces 同口径）；镜像面，mode 恒 mirror。 */
  const rightRows = hub.right;
  const nDb = Array.isArray(rightRows)
    ? rightRows.length
    : nSkills + (steps?.length ?? 0);

  /* 日历：事项总数 + 今日事项数（surfaces 同口径，今日按 Asia/Shanghai） */
  const calItems = readArr("studio_calendar_items_v1");
  const todayISO = todayShISO();
  const calToday = calItems.filter(
    (i) => (i as { date?: unknown })?.date === todayISO,
  ).length;
  const nCal = calItems.length;

  /* 本体 / 健康 / 财务：各仓条数（键缺失 = 仓为空，surfaces 同口径） */
  const nOntology = readArr("studio_ontology_notes_v1").length;
  const nHealth = readArr("studio_health_checkins_v1").length;
  const nFinance = readArr("studio_finance_entries_v1").length;

  /* 执行日志：形状过滤 + 截尾 20（surfaces.loadExecLog 同口径） */
  const nLog = (readArrOrNull("studio_exec_log_v1") ?? [])
    .filter(isExecLogItem)
    .slice(-20).length;

  /* 决策栈：待决 = 内建条集 − 已归档命中；意向数兼容数组/对象（surfaces 同口径） */
  const archivedIds = readArr("studio_decision_archived_v1").filter(
    (x): x is string => typeof x === "string",
  );
  const archivedSet = new Set(archivedIds);
  const decisionPending = DECISION_IDS.filter(
    (id) => !archivedSet.has(id),
  ).length;
  const picksRaw = readJson("studio_decision_picks_v1");
  const picksCount = Array.isArray(picksRaw)
    ? picksRaw.length
    : typeof picksRaw === "object" && picksRaw !== null
      ? Object.keys(picksRaw).length
      : 0;

  /* 快照：登记册实测长度（import SLICES，不复制数字；surfaces 同口径） */
  const nSnapshot = SLICES.length;

  /* 健康同步：文件可达且 updated_at 为字符串即 OK（surfaces 同判定）；
   * 距今时长自 updated_at 在读取时实算。 */
  const healthAgeMs = healthFact
    ? Date.now() - Date.parse(healthFact.updatedAt)
    : NaN;

  const mk = (
    k: string,
    zh: string,
    role: string,
    n: number,
    from: string,
    forceMode?: RingMode
  ): RingSlot => {
    let mode: RingMode = forceMode ?? (n > 0 ? "live" : "standby");
    return { k, zh, role, n, mode, from };
  };

  const slots: Record<string, RingSlot> = {
    HUB: mk("HUB", "总核", "只读消费 · 不写一字节", 0, "localStorage", "live"),
    SKILLS: skillsFact
      ? mk(
          "SKILLS",
          "技能库",
          `${nSkills} 条 · GROKBOT ${skillsFact.grokN} 冰蓝 / LUNA ${skillsFact.lunaN} 品红`,
          nSkills,
          "/skills-sync.json",
        )
      : mk("SKILLS", "技能库", "未取得 · skills-sync", 0, "/skills-sync.json", "offline"),
    WORKS: mk(
      "WORKS",
      "作品库",
      `${nWorks} 件 · ${worksStatusText || "手工录入"}`,
      nWorks,
      "studio_works_items_v1",
    ),
    DB: mk("DB", "数据库", "技能镜像 · 不重复计数", nDb, "studio_hub_rows_v1", "mirror"),
    FINANCE: mk("FINANCE", "财务", `${nFinance} 笔 · 真台账`, nFinance, "studio_finance_entries_v1"),
    SNAPSHOT: mk("SNAPSHOT", "快照", `${nSnapshot} 片登记册`, nSnapshot, "SLICES"),
    SYNC: healthFact
      ? mk(
          "SYNC",
          "健康同步",
          `OK · ${healthFact.updatedAt.slice(5, 16).replace("T", " ")} · 距今 ${ageText(healthAgeMs)}`,
          1,
          "/health-sync.json",
        )
      : mk("SYNC", "健康同步", "STALE · health-sync 不可达", 0, "/health-sync.json", "offline"),
    DECISION: mk(
      "DECISION",
      "决策栈",
      `待决 ${decisionPending} · 意向 ${picksCount} · 已归档 ${archivedIds.length}`,
      decisionPending,
      "studio_decision_archived_v1",
    ),
    INSPIRE: inspireKnown
      ? mk(
          "INSPIRE",
          "灵感池",
          nInspire
            ? `${nInspire} 步 · 流水线 ${steps?.length ?? 0}${topExtra ? ` + 手加行 ${topExtra}` : ""}`
            : "零步 · 待填装",
          nInspire,
          "studio_workflow_steps_v2",
        )
      : mk("INSPIRE", "灵感池", "未落盘 · 种子步数不臆测", 0, "studio_workflow_steps_v2", "offline"),
    ONTOLOGY: mk(
      "ONTOLOGY",
      "本体库",
      nOntology ? `${nOntology} 条 · 站内笔记` : "零条 · 从未通电",
      nOntology,
      "studio_ontology_notes_v1",
      "offline",
    ),
    CALENDAR: mk(
      "CALENDAR",
      "日历",
      nCal ? `${nCal} 条 · 今日 ${calToday}` : "零条 · 待填装",
      nCal,
      "studio_calendar_items_v1",
    ),
    HEALTH: mk("HEALTH", "身体健康", nHealth ? `${nHealth} 条` : "零条 · 待填装", nHealth, "studio_health_checkins_v1"),
    LOG: mk("LOG", "执行日志", nLog ? `${nLog} 条 · 上限 20` : "零条 · 待填装", nLog, "studio_exec_log_v1"),
    CRAWLER: mk("CRAWLER", "巡检蛛", "只读扫描 · 不改数据", 0, "localStorage", "live"),
  };

  // 本体库：即使有残留条目，只要从未被主站写入过就仍是 offline —— 该项目前零写入方，
  // 所以按 n>0 才算通电；这里不额外特判，交给上面 forceMode 的语义。
  if (nOntology > 0) slots.ONTOLOGY.mode = "live";

  let entities = 0;
  let rows = 0;
  let liveN = 0,
    standbyN = 0,
    offlineN = 0;
  for (const k of Object.keys(slots)) {
    const s = slots[k];
    if (s.k === "HUB" || s.k === "CRAWLER") continue; // 中心与探针不是数据面
    rows += s.n;
    if (s.mode === "mirror") continue; // 镜像不计实体
    entities += s.n;
    if (s.mode === "live") liveN++;
    else if (s.mode === "offline") offlineN++;
    else standbyN++;
  }

  const hydrated = nSkills + nWorks + nFinance > 0;

  /* 与第一主题 studio_page.tsx 的 ENTRIES 口径严格一致：
   * 实体 = 技能 + 作品 + 财务；行数 = 上述 + 数据库镜像。快照/决策/同步不在 ENTRIES 里。 */
  const mainEntities = nSkills + nWorks + nFinance;
  const mainRows = mainEntities + nDb;

  return { slots, entities, rows, mainEntities, mainRows, liveN, standbyN, offlineN, hydrated };
}

/** 1..12 号环位在 AG 中的固定次序（索引 0 是 HUB，13 是探针，不可动） */
export const RING_ORDER = [
  "SKILLS",
  "WORKS",
  "DB",
  "FINANCE",
  "SNAPSHOT",
  "SYNC",
  "DECISION", // 索引 7 = 原版 PROOF 位，承担「复核/卡口」语义
  "INSPIRE",
  "ONTOLOGY",
  "CALENDAR",
  "HEALTH",
  "LOG",
] as const;
