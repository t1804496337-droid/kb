/**
 * 星环数据层类型（ring S0+）。
 *
 * 纪律：星环是纯只读消费者——只读 public/*.json 与既有 studio_*
 * localStorage 键，不写任何键、不新增键、不登记进快照 SLICES。
 * 拿不到的数据一律以 null / "—" 呈现，绝不编造（见方案 §0.2）。
 */

/** 执行日志条目——与 neural-landing 的 ExecLogItem 同构（同源键
 * studio_exec_log_v1 的两种历史形态：结构化 {ts,type,module,detail}
 * 与旧版 {ts,text}）。 */
export type ExecLogItem =
  | { ts: number; text: string }
  | { ts: number; type: string; module: string; detail?: string };

export type SkillEntry = {
  id: string;
  name: string;
  zh?: string;
  tag?: string;
  source?: string;
};
export type SkillAgent = { id: string; name: string; skills: SkillEntry[] };

export type SkillsSync = {
  updated_at?: string;
  agents: SkillAgent[];
} | null;

export type HealthSync = {
  updated_at?: string;
  sleep?: { last?: { date?: string; hours?: number } | null } | null;
  steps?: { today?: number | null } | null;
} | null;

export type SlotState = "ok" | "zero" | "stale" | "unknown";

export type SlotData = {
  /** 主计数；null → 显示「—」。 */
  count: number | null;
  /** 非数字主值（如健康同步的 OK / STALE）。 */
  countText?: string;
  /** 计数单位后缀（如快照的「片」）。 */
  unit?: string;
  /** 数据源行（键名 + 口径 + 附加事实），自带溯源。 */
  src: string;
  state: SlotState;
  /** 进度条填充 0..1（相对全槽最大计数，系统面按自身口径）。 */
  ratio: number;
  /** 3D 团活性 0..1（计数归一 + 新鲜度），只驱动明暗，不携带假数据。 */
  activity: number;
};

export type SlotDef = {
  /** 环位序号 1..12，与左栏、突触网格行、3D 团位严格同序。 */
  idx: number;
  id: string;
  cn: string;
  en: string;
  /** 突触网格行首短标。 */
  short: string;
  /** 静态数据源标注（mockup/方案口径），运行时 src 行在此基础上拼事实。 */
  srcLabel: string;
};

/** 一次完整读取的全部原料，HUD 与 3D 共用同一份，保证同屏同数。 */
export type RingData = {
  slots: SlotData[];
  /** 技能库团内点阵：按 agent 分组的技能（冰蓝 GROKBOT / 品红 LUNA）。 */
  skillGroups: { agentId: string; skills: SkillEntry[] }[];
  execLog: ExecLogItem[];
  /** 底栏槽 1：模块数 · 实体数（落地页 MIRROR_OF 同口径）。 */
  modulesCount: number | null;
  entitiesCount: number | null;
  rowsCount: number | null;
  /** 底栏槽 3：事件吞吐（次/分），样本不足 → null。 */
  eventRate: number | null;
  /** 底栏槽 4：今日日历事项数（date = 今日，Asia/Shanghai）。 */
  todayCalendar: number | null;
  /** 顶栏 LAST EVENT 播报行（execLineText 口径）；无日志 → null。 */
  lastEventLine: string | null;
  loadedAt: number;
};
