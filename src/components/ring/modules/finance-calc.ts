/** 第二主题 · 财务纯计算层。
 * 逐字复刻第一主题 FinanceBody（hud-module-content.tsx）的计算口径，
 * 不 import 任何私有函数；isNonConsumption / isRepayment / fmtMoney
 * 直接取 finance-module 的现成导出。 */

import {
  isNonConsumption,
  isRepayment,
} from "@/components/studio/finance-module";
import type {
  FinanceAsset,
  FinanceEntry,
  FinanceLiability,
} from "@/components/studio/finance-module";

export type FinScope = "all" | "consume";

export type FinMonthSummary = {
  income: number;
  outflow: number;
  net: number;
  expenseCount: number;
  repay: number;
  entryCount: number;
};

export const finRound2 = (n: number) => Math.round(n * 100) / 100;
export const finMonthOf = (date: string) => date.slice(0, 7);
const finPad2 = (n: number) => String(n).padStart(2, "0");

export const finPrevMonthKey = (mk: string): string => {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${finPad2(d.getMonth() + 1)}`;
};

export const finMonthLabel = (mk: string) =>
  `${Number(mk.slice(0, 4))} 年 ${Number(mk.slice(5, 7))} 月`;

/** 与 finSummarize（hud-module-content.tsx:1910-1935）逐字同口径。 */
export function summarizeMonth(
  entries: FinanceEntry[],
  mk: string,
  scope: FinScope,
): FinMonthSummary {
  const list = entries.filter((e) => finMonthOf(e.date) === mk);
  const income = finRound2(
    list.filter((e) => e.kind === "income").reduce((s, e) => s + e.amount, 0),
  );
  const scoped = list.filter(
    (e) => e.kind === "expense" && (scope === "all" || !isNonConsumption(e)),
  );
  const outflow = finRound2(scoped.reduce((s, e) => s + e.amount, 0));
  const repay = finRound2(
    list.filter(isRepayment).reduce((s, e) => s + e.amount, 0),
  );
  return {
    income,
    outflow,
    net: finRound2(income - outflow),
    expenseCount: scoped.length,
    repay,
    entryCount: list.length,
  };
}

/** 分类小计：按月分组统计 out/inc/n，按 out 降序（:2348-2359）。
 * 注意第一主题此处不按口径过滤，只按账期过滤。 */
export function categoryBreakdown(
  entries: FinanceEntry[],
  mk: string,
): { category: string; out: number; inc: number; n: number }[] {
  const map = new Map<string, { out: number; inc: number; n: number }>();
  for (const e of entries) {
    if (finMonthOf(e.date) !== mk) continue;
    const cur = map.get(e.category) ?? { out: 0, inc: 0, n: 0 };
    if (e.kind === "expense") cur.out += e.amount;
    else cur.inc += e.amount;
    cur.n += 1;
    map.set(e.category, cur);
  }
  return [...map.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.out - a.out);
}

/** 负债合计 / 最低还款合计（:2308-2311）。 */
export function liabilityTotals(liabilities: FinanceLiability[]): {
  total: number;
  min: number;
} {
  return {
    total: finRound2(liabilities.reduce((s, l) => s + l.remaining, 0)),
    min: finRound2(liabilities.reduce((s, l) => s + (l.minPayment ?? 0), 0)),
  };
}

/** 资产成本合计 / 估值合计（有 value 才算，无则 null）（:2323-2328）。 */
export function assetTotals(assets: FinanceAsset[]): {
  cost: number;
  value: number | null;
} {
  const cost = finRound2(assets.reduce((s, a) => s + a.cost, 0));
  const withValue = assets.filter((a) => typeof a.value === "number");
  return {
    cost,
    value:
      withValue.length > 0
        ? finRound2(withValue.reduce((s, a) => s + (a.value ?? 0), 0))
        : null,
  };
}

/** 预算剩余 / 已用百分比（:2329-2339）。 */
export function budgetDerived(
  budget: number | null,
  outflow: number,
): { remaining: number | null; pct: number } {
  if (budget === null) return { remaining: null, pct: 0 };
  return {
    remaining: finRound2(budget - outflow),
    pct: budget > 0 ? Math.min(100, Math.round((outflow / budget) * 100)) : 0,
  };
}

/** 本月关键变化文案（:2340-2347）。 */
export function changeText(
  cur: FinMonthSummary,
  prev: FinMonthSummary,
  fmt: (n: number) => string,
): string {
  if (prev.entryCount === 0) return "暂无对比（上月无数据）";
  if (prev.outflow <= 0) return "上月支出为 ¥0，暂无法对比";
  const pct = ((cur.outflow - prev.outflow) / prev.outflow) * 100;
  const rounded = Math.round(pct * 10) / 10;
  if (rounded === 0) return "支出与上月持平";
  return `支出较上月 ${rounded > 0 ? "+" : ""}${rounded}%（${fmt(prev.outflow)} → ${fmt(cur.outflow)}）`;
}

/** 累计支出 · 全部期间（全部口径）。 */
export function totalAllOut(entries: FinanceEntry[]): number {
  return finRound2(
    entries
      .filter((e) => e.kind === "expense")
      .reduce((s, e) => s + e.amount, 0),
  );
}

/** 优先偿还建议：剩余 > 0 且填了年化利率者，按利率降序、剩余降序取首位。 */
export function liabAdvice(
  liabilities: FinanceLiability[],
): FinanceLiability | null {
  const open = liabilities.filter((l) => l.remaining > 0);
  const rated = open.filter(
    (l) => typeof l.annualRate === "number" && l.annualRate > 0,
  );
  if (rated.length === 0) return null;
  return [...rated].sort(
    (a, b) =>
      (b.annualRate ?? 0) - (a.annualRate ?? 0) || b.remaining - a.remaining,
  )[0];
}
