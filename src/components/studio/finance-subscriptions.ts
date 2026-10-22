/* 订阅管理 v1 数据层（2026-10-23, hud-finance-subs）
 * ——借鉴开源 SubsTracker 的数据模型与提醒语义（订阅台账 + 到期提醒 +
 * 周期支出统计），思路原生重写，不引入任何外部代码。
 * 数据只存本机 localStorage，初始为空，不播种任何示例数据。
 * 纯 TS、无 React 依赖，方便 QA 与 snapshot.ts 校验复用。 */

export const SUB_KEY = "studio_finance_subscriptions_v1";
export const SUB_REMINDED_KEY = "studio_finance_sub_reminded_v1";

export type SubCycle = "monthly" | "quarterly" | "yearly" | "custom";
export type SubRenewMode = "roll" | "fromPayment"; // 循环顺延 / 从支付日重算

export type SubPayment = {
  date: string; // YYYY-MM-DD
  amount: number;
  note?: string;
};

export type Subscription = {
  id: string;
  name: string;
  amount: number; // 周期金额（元）
  cycle: SubCycle;
  customDays?: number; // cycle === "custom" 时必填
  category: string;
  nextDue: string; // YYYY-MM-DD 下次到期/扣费日
  renewMode: SubRenewMode;
  note?: string;
  active: boolean; // 停用的订阅不提醒、不计入统计
  payments: SubPayment[];
  createdAt: string; // YYYY-MM-DD
};

export const SUB_CATEGORIES = [
  "视频",
  "音乐",
  "云服务",
  "AI 工具",
  "会员",
  "软件",
  "网盘",
  "其他",
] as const;

export const SUB_CYCLE_LABEL: Record<SubCycle, string> = {
  monthly: "每月",
  quarterly: "每季",
  yearly: "每年",
  custom: "自定义天数",
};

export const SUB_RENEWMODE_LABEL: Record<SubRenewMode, string> = {
  roll: "循环顺延（在原到期日上续）",
  fromPayment: "从支付日重算（以今天为起点续）",
};

/* 提醒语义（SubsTracker 风格）：剩余天数正好等于 7 / 3 / 1 的那天各提示一次。 */
export const REMIND_DAYS = [7, 3, 1] as const;

const pad2 = (n: number): string => String(n).padStart(2, "0");

export const subTodayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const parseLocal = (iso: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (
    d.getFullYear() !== Number(m[1]) ||
    d.getMonth() !== Number(m[2]) - 1 ||
    d.getDate() !== Number(m[3])
  )
    return null;
  return d;
};

const toStr = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const addDays = (iso: string, days: number): string | null => {
  const d = parseLocal(iso);
  if (!d) return null;
  d.setDate(d.getDate() + days);
  return toStr(d);
};

/* 月末对齐：1 月 31 日 + 1 个月 → 2 月 28 日（闰年 29 日）。 */
const addMonthsClamped = (iso: string, months: number): string | null => {
  const d = parseLocal(iso);
  if (!d) return null;
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toStr(d);
};

export const isDateIso = (s: string): boolean => parseLocal(s) !== null;

export const daysUntil = (iso: string, today: string = subTodayStr()): number | null => {
  const a = parseLocal(today);
  const b = parseLocal(iso);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
};

/* 周期步长：续费时按下一次加多少。 */
export function addCycle(iso: string, cycle: SubCycle, customDays: number): string | null {
  switch (cycle) {
    case "monthly":
      return addMonthsClamped(iso, 1);
    case "quarterly":
      return addMonthsClamped(iso, 3);
    case "yearly":
      return addMonthsClamped(iso, 12);
    case "custom":
      return addDays(iso, customDays);
  }
}

/**
 * 续费后新的下次到期日。
 * roll（循环顺延）：在原 nextDue 上续一周期——即使逾期也顺着原节奏走；
 * fromPayment（从支付日重算）：以支付日为新起点续一周期。
 */
export function nextDueAfter(
  currentNextDue: string,
  cycle: SubCycle,
  customDays: number,
  renewMode: SubRenewMode,
  payDate: string,
): string | null {
  const base = renewMode === "roll" ? currentNextDue : payDate;
  return addCycle(base, cycle, customDays);
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** 折算月成本：季费÷3、年费÷12、自定义按 30.44 天/月折算。 */
export function monthlyCost(sub: Subscription): number {
  const a = sub.amount;
  switch (sub.cycle) {
    case "monthly":
      return round2(a);
    case "quarterly":
      return round2(a / 3);
    case "yearly":
      return round2(a / 12);
    case "custom":
      return sub.customDays && sub.customDays > 0
        ? round2((a * 30.44) / sub.customDays)
        : 0;
  }
}

export type SubSummary = {
  activeCount: number;
  monthly: number;
  annual: number;
};

export function summarizeSubs(subs: Subscription[]): SubSummary {
  const active = subs.filter((s) => s.active);
  const monthly = round2(active.reduce((sum, s) => sum + monthlyCost(s), 0));
  return { activeCount: active.length, monthly, annual: round2(monthly * 12) };
}

export type SubReminder = { sub: Subscription; daysLeft: number };

/** 当天要提醒的订阅：仅 active、daysLeft 正好落在 7/3/1。 */
export function dueReminders(
  subs: Subscription[],
  today: string = subTodayStr(),
): SubReminder[] {
  const out: SubReminder[] = [];
  for (const s of subs) {
    if (!s.active) continue;
    const d = daysUntil(s.nextDue, today);
    if (d === null) continue;
    if ((REMIND_DAYS as readonly number[]).includes(d)) out.push({ sub: s, daysLeft: d });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

/** 近 7 天到期列表：逾期排最前（daysLeft<0），再按剩余天数升序。 */
export function dueSoon(
  subs: Subscription[],
  today: string = subTodayStr(),
): { sub: Subscription; daysLeft: number }[] {
  const out: { sub: Subscription; daysLeft: number }[] = [];
  for (const s of subs) {
    if (!s.active) continue;
    const d = daysUntil(s.nextDue, today);
    if (d === null) continue;
    if (d <= 7) out.push({ sub: s, daysLeft: d });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function daysLeftLabel(daysLeft: number): string {
  if (daysLeft < 0) return `已逾期 ${-daysLeft} 天`;
  if (daysLeft === 0) return "今天到期";
  return `还剩 ${daysLeft} 天`;
}

/* ── 提醒「每天只提示一次」的落盘记录 ──
 * SUB_REMINDED_KEY 存 { [subId]: "YYYY-MM-DD" }，记录该订阅当天已提醒过；
 * 加载时顺手清理非今天的旧键。 */
export function loadRemindedMap(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(SUB_REMINDED_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, string>;
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
    const today = subTodayStr();
    const kept: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === today) kept[k] = v;
    }
    return kept;
  } catch {
    return {};
  }
}

export function saveRemindedMap(map: Record<string, string>): void {
  try {
    window.localStorage.setItem(SUB_REMINDED_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable */
  }
}

/** 过滤出今天还没提醒过的；调用方负责把返回项的 id 落盘。 */
export function unclaimedReminders(
  reminders: SubReminder[],
  reminded: Record<string, string>,
  today: string = subTodayStr(),
): SubReminder[] {
  return reminders.filter((r) => reminded[r.sub.id] !== today);
}

export function loadSubscriptions(): Subscription[] {
  try {
    const raw = window.localStorage.getItem(SUB_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown[];
    if (!Array.isArray(arr)) return [];
    return arr.filter(isSubscription) as Subscription[];
  } catch {
    return [];
  }
}

export function saveSubscriptions(subs: Subscription[]): void {
  try {
    window.localStorage.setItem(SUB_KEY, JSON.stringify(subs));
  } catch {
    /* storage unavailable */
  }
}

export const isSubscription = (v: unknown): boolean => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string") return false;
  if (typeof o.amount !== "number" || !Number.isFinite(o.amount)) return false;
  if (!["monthly", "quarterly", "yearly", "custom"].includes(o.cycle as string))
    return false;
  if (o.cycle === "custom" && (typeof o.customDays !== "number" || o.customDays <= 0))
    return false;
  if (typeof o.nextDue !== "string" || !isDateIso(o.nextDue)) return false;
  if (!["roll", "fromPayment"].includes(o.renewMode as string)) return false;
  if (typeof o.category !== "string") return false;
  if (!Array.isArray(o.payments)) return false;
  if (typeof o.active !== "boolean") return false;
  return true;
};
