/**
 * 健康数据「有效视图」合并点（2026-10-22，hud-health-sync · 最终拼图三）。
 *
 * 健康数据有两个来源：
 *  1. public/health-sync.json —— 晨间任务经 gh Contents API 直写 main
 *     的机器同步文件（生成链不在本文件职责内，永不改动）；
 *  2. 剪贴板解析口手动同步的一条记录 —— 用户把健康 JSON 复制到剪贴
 *     板、经轮盘 [SYNC HEALTH] 解析校验后落盘 localStorage
 *     studio_health_manual_v1（单条最新，按 date 覆盖同日）。
 *
 * 有效视图按 date 取新：manual.date 比文件的最新睡眠记录日更新（或
 * 同日）时，消费端改用 manual 的值；manual 较旧则文件为准。合并逻辑
 * 只许在这里定义——总览（neural-landing）与健康视图（HealthBody）都
 * 从这里取 manual 记录与判定函数，禁止各消费点各算一套。
 *
 * 纪律：本文件只搬运用户亲手粘贴/复制的真实数值，绝不生成、补全或
 * 推测任何健康数据；校验不过的输入一律拒收并说明缺什么。
 */

export const HEALTH_MANUAL_KEY = "studio_health_manual_v1";

/** 归一后的手动同步记录（parseHealthClipboard 的产物）。 */
export type ManualHealth = {
  /** YYYY-MM-DD，该条记录所属日期。 */
  date: string;
  /** 睡眠时长（小时）——sleep 给了对象/数值且可归一时才有。 */
  sleepHours?: number;
  /** 睡眠起止（HH:MM）——仅当输入以 {start,end} 形式给出时保留。 */
  sleepStart?: string;
  sleepEnd?: string;
  /** 步数（非负整数）。 */
  steps?: number;
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** YYYY-MM-DD 且为真实存在的日历日（2026-02-30 之类拒收）。 */
const isRealDate = (s: string): boolean => {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
};

/** "HH:MM" → 当日分钟数。 */
const minsOf = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/* ── 剪贴板校验/归一 ── */

export type HealthParseResult =
  | { ok: true; value: ManualHealth }
  | { ok: false; error: string };

/**
 * 把剪贴板文本解析为 ManualHealth。字段口径对齐 health-sync.json
 * 实物、宽容归一：
 *  - 顶层必须是 JSON 对象，且必须有合法 date；
 *  - sleep 与 steps 至少有一项：sleep 可为 {hours 数值}、{start,end}
 *    （HH:MM，跨夜自动 +24h）或纯数值（小时）；steps 为非负整数。
 * 错误信息写明缺什么/哪不对，供终端 ERROR 行原样展示。
 */
export function parseHealthClipboard(text: string): HealthParseResult {
  let v: unknown;
  try {
    v = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "非 JSON 文本" };
  }
  if (!isPlainObject(v)) {
    return { ok: false, error: "顶层不是 JSON 对象 · 缺 date/sleep/steps" };
  }
  const date = v.date;
  if (typeof date !== "string" || !isRealDate(date)) {
    return { ok: false, error: "缺合法 date（YYYY-MM-DD）" };
  }
  const out: ManualHealth = { date };

  if (v.sleep !== undefined && v.sleep !== null) {
    const s = v.sleep;
    if (typeof s === "number" && Number.isFinite(s) && s > 0 && s <= 24) {
      out.sleepHours = s;
    } else if (isPlainObject(s)) {
      if (typeof s.hours === "number" && Number.isFinite(s.hours)) {
        if (s.hours <= 0 || s.hours > 24)
          return { ok: false, error: "sleep.hours 超出合理范围（0–24）" };
        out.sleepHours = s.hours;
        if (typeof s.start === "string" && TIME_RE.test(s.start))
          out.sleepStart = s.start;
        if (typeof s.end === "string" && TIME_RE.test(s.end))
          out.sleepEnd = s.end;
      } else if (
        typeof s.start === "string" &&
        typeof s.end === "string" &&
        TIME_RE.test(s.start) &&
        TIME_RE.test(s.end)
      ) {
        let dur = minsOf(s.end) - minsOf(s.start);
        if (dur <= 0) dur += 24 * 60; /* 跨夜 */
        out.sleepHours = Math.round((dur / 60) * 100) / 100;
        out.sleepStart = s.start;
        out.sleepEnd = s.end;
      } else {
        return {
          ok: false,
          error: "sleep 形状不对（需 {hours} 或 {start,end} 或数值小时）",
        };
      }
    } else {
      return {
        ok: false,
        error: "sleep 形状不对（需 {hours} 或 {start,end} 或数值小时）",
      };
    }
  }

  if (v.steps !== undefined && v.steps !== null) {
    const st = v.steps;
    if (typeof st !== "number" || !Number.isFinite(st) || st < 0) {
      return { ok: false, error: "steps 须为非负整数" };
    }
    out.steps = Math.round(st);
  }

  if (out.sleepHours === undefined && out.steps === undefined) {
    return { ok: false, error: "缺 sleep 与 steps（至少要有一项）" };
  }
  return { ok: true, value: out };
}

/* ── 落盘与变更通知 ── */

/** 同页变更事件：save 后广播，全部消费点同源刷新（跨标签页走 storage）。 */
export const HEALTH_MANUAL_EVENT = "hud-health-manual";

export function loadManualHealth(): ManualHealth | null {
  try {
    const raw = window.localStorage.getItem(HEALTH_MANUAL_KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (!isPlainObject(v) || typeof v.date !== "string" || !isRealDate(v.date))
      return null;
    const m: ManualHealth = { date: v.date };
    if (typeof v.sleepHours === "number" && Number.isFinite(v.sleepHours))
      m.sleepHours = v.sleepHours;
    if (typeof v.sleepStart === "string") m.sleepStart = v.sleepStart;
    if (typeof v.sleepEnd === "string") m.sleepEnd = v.sleepEnd;
    if (typeof v.steps === "number" && Number.isFinite(v.steps) && v.steps >= 0)
      m.steps = Math.round(v.steps);
    if (m.sleepHours === undefined && m.steps === undefined) return null;
    return m;
  } catch {
    return null;
  }
}

/** 落盘（单条最新，按 date 覆盖同日由「只存一条」天然达成）并广播。 */
export function saveManualHealth(m: ManualHealth): void {
  try {
    window.localStorage.setItem(HEALTH_MANUAL_KEY, JSON.stringify(m));
  } catch {
    /* 存储不可用：仍广播，消费端至少在本会话内生效 */
  }
  window.dispatchEvent(new CustomEvent(HEALTH_MANUAL_EVENT));
}

/** 订阅 manual 变更（同页事件 + 跨标签页 storage），返回取消函数。 */
export function onManualHealthChange(handler: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === HEALTH_MANUAL_KEY) handler();
  };
  window.addEventListener(HEALTH_MANUAL_EVENT, handler);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(HEALTH_MANUAL_EVENT, handler);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * 有效视图判定：manual 是否压过文件记录。manual.date 比文件的最新
 * 睡眠记录日更新、或同日 → manual 为准；文件尚无任何记录时 manual
 * 直接生效；manual 较旧 → 文件为准（返回 false）。
 */
export function manualWins(manual: ManualHealth | null, fileLastDate: string | null): boolean {
  if (!manual) return false;
  if (!fileLastDate) return true;
  return manual.date >= fileLastDate;
}
