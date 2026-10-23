/**
 * 星环派生层：把原始读取（surfaces.ts）加工成 HUD / 3D 直接消费的量。
 * 全部纯函数、无副作用；口径逐项与落地页对齐并在各处注明出处。
 */
import type { ExecLogItem } from "./types";

/* ── 时间口径：与落地页决策栈同一套 Asia/Shanghai 日界 ── */

export const shDayNum = (iso: string): number => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 864e5);
};

export const todayShNum = (): number => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Math.floor(
    Date.UTC(get("year"), get("month") - 1, get("day")) / 864e5,
  );
};

/** 今日 YYYY-MM-DD（Asia/Shanghai），供「今日日历事项」比对事项 date。 */
export const todayShISO = (): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) =>
    String(parts.find((p) => p.type === t)?.value).padStart(2, "0");
  return `${get("year")}-${get("month")}-${get("day")}`;
};

export const fmtClock = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
export const fmtHM = (ts: number): string => {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** 距今时长（人话）：xh ym / N天前 / 刚刚。入参为毫秒差。 */
export const ageText = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h${String(min % 60).padStart(2, "0")}m`;
  return `${Math.floor(h / 24)}天`;
};

/* ── 中文播报：逐字镜像 neural-landing 的 execLineText 模板 ──
 * 落地页文件已封板，星环不回改它加导出；在此按同模板实现，保证
 * 两屏播报同口径、不出现两套说法（方案 §2.2 的要求）。模板如有
 * 增改，两处需同步——以 neural-landing 为准。 */
export const execLineText = (item: ExecLogItem): string => {
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

/** 信号流行首的模块标签（与 execLineText 的 [x] 前缀同一套词）。 */
export const execTag = (item: ExecLogItem): string => {
  if ("text" in item) return "LEGACY";
  switch (item.type) {
    case "FINANCE_ADD_ENTRY":
    case "FINANCE_DELETE_ENTRY":
      return "财务";
    case "DECISION_ARCHIVE":
    case "DECISION_RESTORE":
    case "DECISION_PICK":
      return "决策";
    case "SNAPSHOT_IMPORT":
      return "系统";
    case "HEALTH_SYNC":
      return "健康";
    case "STUDIO_STAGE_MOVE":
      return "创作";
    case "MINDMAP_NODE":
    case "MINDMAP_EDGE":
      return "图谱";
    default:
      return "事件";
  }
};

/* ── 日志条目 → 环位映射（突触网格行 / 信号脉冲落点） ──
 * type 优先于 module：HEALTH_SYNC 是健康「同步」事件，归健康同步
 * 环位（12）而非身体健康（7）；DECISION_* 一律归决策栈（11）；
 * SNAPSHOT_IMPORT 归快照（9）。module 取 bus 发射点的模块 id；
 * "hub"（无归属的系统动作）与旧版 {text} 条目无环位，只进信号流。 */
export const slotIndexOfLogItem = (item: ExecLogItem): number | null => {
  if ("text" in item) return null;
  switch (item.type) {
    case "DECISION_ARCHIVE":
    case "DECISION_RESTORE":
    case "DECISION_PICK":
      return 10; // 决策栈（0-based 10 = 第 11 槽）
    case "SNAPSHOT_IMPORT":
      return 8; // 快照登记册
    case "HEALTH_SYNC":
      return 11; // 健康同步
    case "FINANCE_ADD_ENTRY":
    case "FINANCE_DELETE_ENTRY":
      return 7; // 财务系统
    case "STUDIO_STAGE_MOVE":
    case "MINDMAP_NODE":
    case "MINDMAP_EDGE":
      return 0; // 灵感池（流水线 / 图谱同源，见 v3 批次二合并口径）
  }
  switch (item.module) {
    case "inspiration":
    case "studio":
    case "mindmap":
      return 0;
    case "skills":
      return 1;
    case "works":
      return 2;
    case "database":
      return 3;
    case "ontology":
      return 4;
    case "calendar":
      return 5;
    case "health":
      return 6;
    case "finance":
      return 7;
    default:
      return null;
  }
};

/** 突触网格：12 环位 × 12 桶（每桶 5 分钟，末桶为当前桶）。
 * 空桶留空——格值即真实计数，0 就是不点亮（方案 §2.2）。 */
export const synapseBuckets = (
  log: ExecLogItem[],
  now: number,
): number[][] => {
  const rows: number[][] = Array.from({ length: 12 }, () =>
    new Array<number>(12).fill(0),
  );
  const bucketMs = 5 * 60 * 1000;
  const end = Math.floor(now / bucketMs) * bucketMs + bucketMs; // 当前桶右界
  for (const item of log) {
    const slot = slotIndexOfLogItem(item);
    if (slot === null) continue;
    const b = Math.floor((item.ts - (end - 12 * bucketMs)) / bucketMs);
    if (b >= 0 && b < 12) rows[slot][b] += 1;
  }
  return rows;
};

/** 能量条码环数据：72 桶 × 5 分钟 = 近 6 小时全模块事件计数。
 * 渲染为径向直方图（lane 数 = min(6, 计数)），见 energy-barcode.ts。 */
export const barcodeBuckets = (log: ExecLogItem[], now: number): number[] => {
  const out = new Array<number>(72).fill(0);
  const bucketMs = 5 * 60 * 1000;
  const start = Math.floor(now / bucketMs) * bucketMs - 71 * bucketMs;
  for (const item of log) {
    const b = Math.floor((item.ts - start) / bucketMs);
    if (b >= 0 && b < 72) out[b] += 1;
  }
  return out;
};

/** 事件吞吐（次/分）：近 ≤20 条日志的首末跨度推算（方案 §0.2：
 * 有源但样本小，角标必须注明）。条目 <2 或跨度为 0 → null（显示 —）。 */
export const eventRatePerMin = (log: ExecLogItem[]): number | null => {
  if (log.length < 2) return null;
  const first = log[0].ts;
  const last = log[log.length - 1].ts;
  const spanMin = (last - first) / 60000;
  if (!(spanMin > 0)) return null;
  return Math.round(((log.length - 1) / spanMin) * 10) / 10;
};
