/* 第二主题 · 只读数据适配层
 *
 * 三条纪律：
 * 1. 只读，绝不写任何键（本文件不含 setItem / removeItem）。
 * 2. 读不到就返回 0 并标 offline，绝不用随机数或时钟累加补位。
 * 3. 镜像模块（数据库）单独标 mirror，不计入实体总数。
 */

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

const SLICES_TOTAL = 32; // SnapshotRegistrar 登记册片数（常量，非读取）
const DECISIONS_TOTAL = 6; // 决策栈内置条数（常量）

function readArr(key: string): unknown[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function readHubRows(): Record<string, unknown[]> {
  try {
    const raw = localStorage.getItem("studio_hub_rows_v1");
    if (!raw) return {};
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function len(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

export function readRingData(): RingData {
  const hub = readHubRows();
  const nSkills = len(hub.ll);
  const nWorks = len(hub.left);
  const nDb = len(hub.right);
  const nInspire = len(hub.top);
  const nCal = len(hub.lr);

  const nFinance = readArr("studio_finance_entries_v1").length;
  const nHealth = readArr("studio_health_checkins_v1").length;
  const nOntology = readArr("studio_ontology_notes_v1").length;
  const nLog = readArr("studio_exec_log_v1").length;

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
    SKILLS: mk("SKILLS", "技能库", `${nSkills} 条 · skills-sync`, nSkills, "hub.ll"),
    WORKS: mk("WORKS", "作品库", `${nWorks} 件 · 手工录入`, nWorks, "hub.left"),
    DB: mk("DB", "数据库", "技能镜像 · 不重复计数", nDb, "hub.right", "mirror"),
    FINANCE: mk("FINANCE", "财务", `${nFinance} 笔 · 真台账`, nFinance, "finance_entries"),
    SNAPSHOT: mk("SNAPSHOT", "快照", `${SLICES_TOTAL} 片登记册`, SLICES_TOTAL, "SLICES"),
    SYNC: mk("SYNC", "健康同步", "1 份 · health-sync", 1, "health-sync.json"),
    DECISION: mk("DECISION", "决策栈", `${DECISIONS_TOTAL} 条 · 手写台账`, DECISIONS_TOTAL, "decision_stack"),
    INSPIRE: mk("INSPIRE", "灵感池", nInspire ? `${nInspire} 步` : "零步 · 待填装", nInspire, "hub.top"),
    ONTOLOGY: mk("ONTOLOGY", "本体库", "零条 · 从未通电", nOntology, "ontology_notes", "offline"),
    CALENDAR: mk("CALENDAR", "日历", nCal ? `${nCal} 条` : "零条 · 待填装", nCal, "hub.lr"),
    HEALTH: mk("HEALTH", "身体健康", nHealth ? `${nHealth} 条` : "零条 · 待填装", nHealth, "health_checkins"),
    LOG: mk("LOG", "执行日志", nLog ? `${nLog} 条 · 上限 20` : "零条 · 待填装", nLog, "exec_log"),
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
