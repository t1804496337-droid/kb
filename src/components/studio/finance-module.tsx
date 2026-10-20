import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Sparkles,
  Printer,
  Copy,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 财务系统管理 · 模块内里（参考 Equawealth 的结构，数据全用用户真实台账）
 *
 * 数据全部由页面层 state 派生（localStorage 持久化在 studio/page.tsx）：
 * 记账明细 / 负债 / 资产 / 月度预算。这里不写死任何金额——所有数字都能
 * 从传入的数组算出来；空态只给引导文案。口径切换（全部流出 / 仅消费）
 * 是本组件级状态，概览与月度报告共用，保证两处数字不打架。
 */

export type FinanceEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  kind: "income" | "expense";
  amount: number;
  category: string;
  note?: string;
  /** "ledger" = 从 Luna 台账 ledger.csv 导入的种子记录，界面标「台账导入」。 */
  source?: string;
};

export type FinanceLiability = {
  id: string;
  name: string;
  total: number;
  remaining: number;
  annualRate?: number;
  minPayment?: number;
  note?: string;
};

export const FINANCE_ASSET_TYPES = [
  "股票",
  "黄金",
  "加密",
  "现金",
  "其他",
] as const;
export type FinanceAssetType = (typeof FINANCE_ASSET_TYPES)[number];

export type FinanceAsset = {
  id: string;
  name: string;
  type: FinanceAssetType;
  cost: number;
  value?: number;
};

type Scope = "all" | "consume";

/** 「仅消费」口径排除的流出：分类含「还款」或「转账」的支出不算消费。 */
const NON_CONSUMPTION_RE = /还款|转账/;
export const isNonConsumption = (e: FinanceEntry): boolean =>
  e.kind === "expense" && NON_CONSUMPTION_RE.test(e.category);
/** 偿还负债口径：分类含「还款」的支出。 */
export const isRepayment = (e: FinanceEntry): boolean =>
  e.kind === "expense" && /还款/.test(e.category);

const round2 = (n: number) => Math.round(n * 100) / 100;
export const fmtMoney = (n: number): string =>
  `¥${round2(n).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;

const monthOf = (date: string) => date.slice(0, 7);
const pad2 = (n: number) => String(n).padStart(2, "0");
export const currentMonthKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};
const prevMonthKey = (mk: string): string => {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};
const monthLabel = (mk: string) =>
  `${Number(mk.slice(0, 4))} 年 ${Number(mk.slice(5, 7))} 月`;
const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const greeting = (): string => {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 12) return "上午好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
};

type MonthSummary = {
  income: number;
  outflow: number;
  net: number;
  expenseCount: number;
  repay: number;
  entryCount: number;
};

function summarize(
  entries: FinanceEntry[],
  mk: string,
  scope: Scope,
): MonthSummary {
  const list = entries.filter((e) => monthOf(e.date) === mk);
  const income = round2(
    list.filter((e) => e.kind === "income").reduce((s, e) => s + e.amount, 0),
  );
  const scopedExpenses = list.filter(
    (e) => e.kind === "expense" && (scope === "all" || !isNonConsumption(e)),
  );
  const outflow = round2(scopedExpenses.reduce((s, e) => s + e.amount, 0));
  const repay = round2(
    list.filter(isRepayment).reduce((s, e) => s + e.amount, 0),
  );
  return {
    income,
    outflow,
    net: round2(income - outflow),
    expenseCount: scopedExpenses.length,
    repay,
    entryCount: list.length,
  };
}

const inputCls =
  "w-full rounded-[10px] border border-[color:var(--studio-border)] bg-black/20 px-3 py-2 text-[13px] outline-none";
const labelCls = "mb-1 block text-[10px] text-[color:var(--studio-muted)]";

function FinSection({
  title,
  en,
  testid,
  action,
  children,
}: {
  title: string;
  en: string;
  testid: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section data-testid={testid} className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-[13px] font-semibold">
          {title}
          <span className="ml-2 text-[10px] font-normal uppercase tracking-wider text-[color:var(--studio-muted)]">
            {en}
          </span>
        </p>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatCard({
  label,
  children,
  testid,
  data,
}: {
  label: string;
  children: React.ReactNode;
  testid: string;
  data?: Record<string, string | number>;
}) {
  const dataProps: Record<string, string> = {};
  if (data) {
    for (const [k, v] of Object.entries(data))
      dataProps[`data-${k}`] = String(v);
  }
  return (
    <div
      data-testid={testid}
      {...dataProps}
      className="studio-glass p-4"
    >
      <p className="text-[11px] text-[color:var(--studio-muted)]">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export type FinanceModuleProps = {
  entries: FinanceEntry[];
  liabilities: FinanceLiability[];
  assets: FinanceAsset[];
  budget: number | null;
  onAddEntry: (e: Omit<FinanceEntry, "id">) => void;
  onUpdateEntry: (id: string, e: Omit<FinanceEntry, "id" | "source">) => void;
  onDeleteEntry: (id: string) => void;
  onAddLiability: (l: Omit<FinanceLiability, "id">) => void;
  onUpdateLiability: (id: string, l: Omit<FinanceLiability, "id">) => void;
  onDeleteLiability: (id: string) => void;
  onAddAsset: (a: Omit<FinanceAsset, "id">) => void;
  onUpdateAsset: (id: string, a: Omit<FinanceAsset, "id">) => void;
  onDeleteAsset: (id: string) => void;
  onSetBudget: (n: number | null) => void;
  showToast: (msg: string) => void;
};

export function FinanceModuleView(props: FinanceModuleProps) {
  const { entries, liabilities, assets, budget, showToast } = props;
  const [scope, setScope] = React.useState<Scope>("all");
  const nowMonth = currentMonthKey();
  const [reportMonth, setReportMonth] = React.useState<string>(nowMonth);

  const reportMonths = React.useMemo(() => {
    const set = new Set(entries.map((e) => monthOf(e.date)));
    set.add(nowMonth);
    return [...set].sort().reverse();
  }, [entries, nowMonth]);
  const activeReportMonth = reportMonths.includes(reportMonth)
    ? reportMonth
    : nowMonth;

  const ov = React.useMemo(
    () => summarize(entries, nowMonth, scope),
    [entries, nowMonth, scope],
  );
  const rp = React.useMemo(
    () => summarize(entries, activeReportMonth, scope),
    [entries, activeReportMonth, scope],
  );
  const rpPrev = React.useMemo(
    () => summarize(entries, prevMonthKey(activeReportMonth), scope),
    [entries, activeReportMonth, scope],
  );

  const liabTotal = round2(liabilities.reduce((s, l) => s + l.remaining, 0));
  const liabMin = round2(
    liabilities.reduce((s, l) => s + (l.minPayment ?? 0), 0),
  );
  const advice = React.useMemo(() => {
    const open = liabilities.filter((l) => l.remaining > 0);
    const rated = open.filter(
      (l) => typeof l.annualRate === "number" && l.annualRate > 0,
    );
    if (rated.length === 0) return null;
    return [...rated].sort(
      (a, b) =>
        (b.annualRate ?? 0) - (a.annualRate ?? 0) || b.remaining - a.remaining,
    )[0];
  }, [liabilities]);

  const assetCost = round2(assets.reduce((s, a) => s + a.cost, 0));
  const assetsWithValue = assets.filter((a) => typeof a.value === "number");
  const assetValue =
    assetsWithValue.length > 0
      ? round2(assetsWithValue.reduce((s, a) => s + (a.value ?? 0), 0))
      : null;

  const budgetRemaining = budget !== null ? round2(budget - ov.outflow) : null;
  const budgetPct =
    budget !== null && budget > 0
      ? Math.min(100, Math.round((ov.outflow / budget) * 100))
      : 0;
  const rpBudgetRemaining =
    budget !== null ? round2(budget - rp.outflow) : null;
  const rpBudgetPct =
    budget !== null && budget > 0
      ? Math.min(100, Math.round((rp.outflow / budget) * 100))
      : 0;

  const changeText = React.useMemo(() => {
    if (rpPrev.entryCount === 0) return "暂无对比（上月无数据）";
    if (rpPrev.outflow <= 0) return "上月支出为 ¥0，暂无法对比";
    const pct = ((rp.outflow - rpPrev.outflow) / rpPrev.outflow) * 100;
    const rounded = Math.round(pct * 10) / 10;
    if (rounded === 0) return "支出与上月持平";
    return `支出较上月 ${rounded > 0 ? "+" : ""}${rounded}%（${fmtMoney(rpPrev.outflow)} → ${fmtMoney(rp.outflow)}）`;
  }, [rp, rpPrev]);

  // ---- entry form (add / edit-in-place) ----
  const [editingEntryId, setEditingEntryId] = React.useState<string | null>(
    null,
  );
  const [entryForm, setEntryForm] = React.useState({
    date: todayStr(),
    kind: "expense" as "income" | "expense",
    amount: "",
    category: "",
    note: "",
  });
  const resetEntryForm = () => {
    setEditingEntryId(null);
    setEntryForm({
      date: todayStr(),
      kind: "expense",
      amount: "",
      category: "",
      note: "",
    });
  };
  const submitEntry = () => {
    const amount = Number(entryForm.amount);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entryForm.date)) {
      showToast("先选一个日期");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("金额要大于 0");
      return;
    }
    if (!entryForm.category.trim()) {
      showToast("先填分类，如 日用 / 还款 / 工资");
      return;
    }
    const payload = {
      date: entryForm.date,
      kind: entryForm.kind,
      amount: round2(amount),
      category: entryForm.category.trim(),
      ...(entryForm.note.trim() ? { note: entryForm.note.trim() } : {}),
    };
    if (editingEntryId) {
      props.onUpdateEntry(editingEntryId, payload);
      showToast("明细已更新");
    } else {
      props.onAddEntry(payload);
      showToast("已记一笔");
    }
    resetEntryForm();
  };
  const sortedEntries = React.useMemo(
    () =>
      [...entries].sort((a, b) =>
        a.date === b.date ? (a.id < b.id ? 1 : -1) : a.date < b.date ? 1 : -1,
      ),
    [entries],
  );

  // ---- liability form ----
  const [editingLiabId, setEditingLiabId] = React.useState<string | null>(null);
  const [liabForm, setLiabForm] = React.useState({
    name: "",
    total: "",
    remaining: "",
    rate: "",
    min: "",
    note: "",
  });
  const resetLiabForm = () => {
    setEditingLiabId(null);
    setLiabForm({
      name: "",
      total: "",
      remaining: "",
      rate: "",
      min: "",
      note: "",
    });
  };
  const submitLiab = () => {
    const total = Number(liabForm.total);
    const remaining =
      liabForm.remaining.trim() === "" ? total : Number(liabForm.remaining);
    if (!liabForm.name.trim()) {
      showToast("先填负债名称");
      return;
    }
    if (!Number.isFinite(total) || total < 0) {
      showToast("总额需为不小于 0 的数字");
      return;
    }
    if (!Number.isFinite(remaining) || remaining < 0) {
      showToast("剩余需为不小于 0 的数字");
      return;
    }
    const rate =
      liabForm.rate.trim() === "" ? undefined : Number(liabForm.rate);
    if (rate !== undefined && (!Number.isFinite(rate) || rate < 0)) {
      showToast("年化利率需为不小于 0 的数字");
      return;
    }
    const min = liabForm.min.trim() === "" ? undefined : Number(liabForm.min);
    if (min !== undefined && (!Number.isFinite(min) || min < 0)) {
      showToast("月最低还款需为不小于 0 的数字");
      return;
    }
    const payload: Omit<FinanceLiability, "id"> = {
      name: liabForm.name.trim(),
      total: round2(total),
      remaining: round2(remaining),
      ...(rate !== undefined ? { annualRate: rate } : {}),
      ...(min !== undefined ? { minPayment: round2(min) } : {}),
      ...(liabForm.note.trim() ? { note: liabForm.note.trim() } : {}),
    };
    if (editingLiabId) {
      props.onUpdateLiability(editingLiabId, payload);
      showToast("负债已更新");
    } else {
      props.onAddLiability(payload);
      showToast("负债已添加");
    }
    resetLiabForm();
  };

  // ---- asset form ----
  const [editingAssetId, setEditingAssetId] = React.useState<string | null>(
    null,
  );
  const [assetForm, setAssetForm] = React.useState({
    name: "",
    type: "股票" as FinanceAssetType,
    cost: "",
    value: "",
  });
  const resetAssetForm = () => {
    setEditingAssetId(null);
    setAssetForm({ name: "", type: "股票", cost: "", value: "" });
  };
  const submitAsset = () => {
    const cost = Number(assetForm.cost);
    if (!assetForm.name.trim()) {
      showToast("先填资产名称");
      return;
    }
    if (assetForm.cost.trim() === "" || !Number.isFinite(cost) || cost < 0) {
      showToast("持仓成本需为不小于 0 的数字");
      return;
    }
    const value =
      assetForm.value.trim() === "" ? undefined : Number(assetForm.value);
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      showToast("现值需为不小于 0 的数字");
      return;
    }
    const payload: Omit<FinanceAsset, "id"> = {
      name: assetForm.name.trim(),
      type: assetForm.type,
      cost: round2(cost),
      ...(value !== undefined ? { value: round2(value) } : {}),
    };
    if (editingAssetId) {
      props.onUpdateAsset(editingAssetId, payload);
      showToast("资产已更新");
    } else {
      props.onAddAsset(payload);
      showToast("资产已添加");
    }
    resetAssetForm();
  };

  // ---- budget editor (in the overview budget card) ----
  const [budgetDraft, setBudgetDraft] = React.useState("");
  const [budgetEditing, setBudgetEditing] = React.useState(false);
  const saveBudget = () => {
    const n = Number(budgetDraft);
    if (!Number.isFinite(n) || n <= 0) {
      showToast("预算要大于 0");
      return;
    }
    props.onSetBudget(round2(n));
    setBudgetEditing(false);
    showToast("月度预算已保存");
  };

  const copyAiSummary = async () => {
    const lines = [
      ``,
      `收入 ${fmtMoney(rp.income)} · 流出 ${fmtMoney(rp.outflow)} · 净现金流 ${fmtMoney(rp.net)}`,
      `本月支出 ${rp.expenseCount} 条 · 偿还负债 ${fmtMoney(rp.repay)}`,
      budget !== null
        ? `月度预算 ${fmtMoney(budget)} · 剩余 ${fmtMoney(rpBudgetRemaining ?? 0)}`
        : "月度预算 未设置",
      `总负债 ${fmtMoney(liabTotal)}（${liabilities.length} 笔） · 资产 ${assets.length} 项（成本 ${fmtMoney(assetCost)}）`,
      `关键变化：${changeText}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      showToast("摘要已复制，发给 Luna 即可诊断");
    } catch {
      showToast("复制失败，请截图发给 Luna");
    }
  };

  const scopeNote =
    scope === "all" ? "口径：全部资金流出" : "口径：仅消费（不含还款/转账）";

  return (
    <div data-testid="finance-view" className="space-y-6">
      {/* ---------- 概览 ---------- */}
      <FinSection title="概览" en="Overview" testid="fin-overview">
        <div className="studio-glass flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="text-[13px]">
            {greeting()}，这是你在 {monthLabel(nowMonth)} 的财务概览。
            <span className="ml-2 text-[11px] text-[color:var(--studio-muted)]">
              {scopeNote} · 在月度报告里切换
            </span>
          </p>
          <button
            type="button"
            className="xuan-btn shrink-0"
            onClick={() =>
              document
                .getElementById("finance-report")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            月度报告 ↓
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label={`本月净现金流 · ${monthLabel(nowMonth)}`}
            testid="fin-ov-netflow"
            data={{ income: ov.income, outflow: ov.outflow, net: ov.net }}
          >
            <p
              className={cn(
                "text-xl font-semibold tabular-nums",
                ov.net < 0 ? "text-orange-400" : "text-emerald-500",
              )}
            >
              {fmtMoney(ov.net)}
            </p>
            <p className="mt-1 text-[11px] tabular-nums text-[color:var(--studio-muted)]">
              收入 {fmtMoney(ov.income)} · 流出 {fmtMoney(ov.outflow)}
            </p>
          </StatCard>
          <StatCard
            label="本月支出"
            testid="fin-ov-expense"
            data={{ amount: ov.outflow, count: ov.expenseCount }}
          >
            <p className="text-xl font-semibold tabular-nums">
              {fmtMoney(ov.outflow)}
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--studio-muted)]">
              共 {ov.expenseCount} 条支出明细
            </p>
          </StatCard>
          <StatCard
            label="预算剩余 · 本月"
            testid="fin-ov-budget"
            data={{
              budget: budget === null ? "none" : budget,
              remaining: budgetRemaining === null ? "none" : budgetRemaining,
              pct: budgetPct,
            }}
          >
            {budget === null ? (
              <>
                <p className="text-xl font-semibold">未设置</p>
                <p className="mt-1 text-[11px] text-[color:var(--studio-muted)]">
                  设一个月度预算，这里会显示剩余与进度。
                </p>
              </>
            ) : (
              <>
                <p
                  className={cn(
                    "text-xl font-semibold tabular-nums",
                    (budgetRemaining ?? 0) < 0 && "text-orange-400",
                  )}
                >
                  {fmtMoney(budgetRemaining ?? 0)}
                </p>
                <p className="mt-1 text-[11px] tabular-nums text-[color:var(--studio-muted)]">
                  预算 {fmtMoney(budget)} · 已用 {budgetPct}
                  %（按当前口径支出计）
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-all"
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              </>
            )}
            {budgetEditing || budget === null ? (
              <div className="mt-3 flex items-center gap-2">
                <input
                  data-testid="fin-budget-input"
                  type="number"
                  min="0"
                  value={budgetDraft}
                  onChange={(e) => setBudgetDraft(e.target.value)}
                  placeholder="月度预算（元）"
                  className={cn(inputCls, "max-w-[160px] py-1.5")}
                />
                <button
                  type="button"
                  data-testid="fin-budget-save"
                  className="xuan-btn xuan-btn-primary shrink-0"
                  onClick={saveBudget}
                >
                  保存
                </button>
                {budget !== null && (
                  <>
                    <button
                      type="button"
                      className="xuan-btn shrink-0"
                      onClick={() => setBudgetEditing(false)}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      data-testid="fin-budget-clear"
                      className="xuan-btn shrink-0"
                      onClick={() => {
                        props.onSetBudget(null);
                        setBudgetEditing(false);
                        setBudgetDraft("");
                        showToast("月度预算已清除");
                      }}
                    >
                      清除
                    </button>
                  </>
                )}
              </div>
            ) : (
              <button
                type="button"
                data-testid="fin-budget-edit"
                className="xuan-btn mt-3"
                onClick={() => {
                  setBudgetDraft(String(budget));
                  setBudgetEditing(true);
                }}
              >
                修改预算
              </button>
            )}
          </StatCard>
          <StatCard
            label="借款负债"
            testid="fin-ov-liab"
            data={{ total: liabTotal, count: liabilities.length }}
          >
            {liabilities.length === 0 ? (
              <>
                <p className="text-xl font-semibold">暂无负债</p>
                <p className="mt-1 text-[11px] text-[color:var(--studio-muted)]">
                  还没有负债记录，去下方「负债管理」添加第一笔。
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-semibold tabular-nums">
                  {fmtMoney(liabTotal)}
                </p>
                <p className="mt-1 text-[11px] tabular-nums text-[color:var(--studio-muted)]">
                  {liabilities.length} 笔 · 月最低还款合计 {fmtMoney(liabMin)}
                </p>
              </>
            )}
          </StatCard>
          <StatCard
            label="追踪资产"
            testid="fin-ov-asset"
            data={{
              count: assets.length,
              cost: assetCost,
              value: assetValue === null ? "none" : assetValue,
            }}
          >
            {assets.length === 0 ? (
              <>
                <p className="text-xl font-semibold">暂无资产</p>
                <p className="mt-1 text-[11px] text-[color:var(--studio-muted)]">
                  还没有资产记录，去下方「资产台账」添加第一项。
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-semibold tabular-nums">
                  {fmtMoney(assetCost)}
                </p>
                <p className="mt-1 text-[11px] tabular-nums text-[color:var(--studio-muted)]">
                  {assets.length} 项持仓成本
                  {assetValue !== null && ` · 现值合计 ${fmtMoney(assetValue)}`}
                </p>
              </>
            )}
          </StatCard>
        </div>
      </FinSection>

      {/* ---------- 记账明细 ---------- */}
      <FinSection title="记账明细" en="Entries" testid="fin-entries-section">
        <form
          className="studio-glass grid gap-2 p-4 md:grid-cols-[150px_110px_130px_1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            submitEntry();
          }}
        >
          <label>
            <span className={labelCls}>日期</span>
            <input
              data-testid="fin-entry-date"
              type="date"
              value={entryForm.date}
              onChange={(e) =>
                setEntryForm({ ...entryForm, date: e.target.value })
              }
              className={inputCls}
            />
          </label>
          <label>
            <span className={labelCls}>类型</span>
            <select
              data-testid="fin-entry-kind"
              value={entryForm.kind}
              onChange={(e) =>
                setEntryForm({
                  ...entryForm,
                  kind: e.target.value as "income" | "expense",
                })
              }
              className={inputCls}
            >
              <option value="expense">支出</option>
              <option value="income">收入</option>
            </select>
          </label>
          <label>
            <span className={labelCls}>金额（元）</span>
            <input
              data-testid="fin-entry-amount"
              type="number"
              min="0"
              step="0.01"
              value={entryForm.amount}
              onChange={(e) =>
                setEntryForm({ ...entryForm, amount: e.target.value })
              }
              placeholder="0.00"
              className={inputCls}
            />
          </label>
          <label>
            <span className={labelCls}>分类</span>
            <input
              data-testid="fin-entry-category"
              value={entryForm.category}
              onChange={(e) =>
                setEntryForm({ ...entryForm, category: e.target.value })
              }
              placeholder="日用 / 还款 / 工资…"
              list="fin-category-list"
              className={inputCls}
            />
            <datalist id="fin-category-list">
              {[
                "日用",
                "餐饮",
                "交通",
                "购物",
                "娱乐",
                "还款",
                "转账",
                "工资",
                "其他",
              ].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label>
            <span className={labelCls}>备注（可选）</span>
            <input
              data-testid="fin-entry-note"
              value={entryForm.note}
              onChange={(e) =>
                setEntryForm({ ...entryForm, note: e.target.value })
              }
              placeholder="这笔钱花在哪"
              className={inputCls}
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              data-testid="fin-entry-submit"
              className="xuan-btn xuan-btn-primary shrink-0"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {editingEntryId ? "保存修改" : "记一笔"}
            </button>
            {editingEntryId && (
              <button
                type="button"
                className="xuan-btn shrink-0"
                onClick={resetEntryForm}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </form>
        <div data-testid="fin-entries" data-count={entries.length}>
          {sortedEntries.length === 0 ? (
            <p className="px-1 text-[12px] text-[color:var(--studio-muted)]">
              还没有记账明细，用上面的表单记第一笔。
            </p>
          ) : (
            <ul className="space-y-2">
              {sortedEntries.map((e) => (
                <li
                  key={e.id}
                  data-testid="fin-entry-row"
                  data-entry-id={e.id}
                  className="studio-glass flex items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {e.category}
                      {e.source === "ledger" && (
                        <span className="rounded-full border border-violet-400/40 px-1.5 py-0.5 text-[10px] text-violet-400">
                          台账导入
                        </span>
                      )}
                      {e.note && (
                        <span className="truncate text-[12px] font-normal text-[color:var(--studio-muted)]">
                          {e.note}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[10px] tabular-nums text-[color:var(--studio-muted)]">
                      {e.date} · {e.kind === "income" ? "收入" : "支出"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      e.kind === "income"
                        ? "text-emerald-500"
                        : "text-orange-400",
                    )}
                  >
                    {e.kind === "income" ? "+" : "−"}
                    {fmtMoney(e.amount)}
                  </span>
                  <button
                    type="button"
                    data-testid={`fin-entry-edit-${e.id}`}
                    className="xuan-btn shrink-0"
                    aria-label="编辑"
                    onClick={() => {
                      setEditingEntryId(e.id);
                      setEntryForm({
                        date: e.date,
                        kind: e.kind,
                        amount: String(e.amount),
                        category: e.category,
                        note: e.note ?? "",
                      });
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    data-testid={`fin-entry-del-${e.id}`}
                    className="xuan-btn shrink-0"
                    aria-label="删除"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `删除这笔明细（${e.date} ${e.category} ${fmtMoney(e.amount)}）？`,
                        )
                      )
                        return;
                      props.onDeleteEntry(e.id);
                      if (editingEntryId === e.id) resetEntryForm();
                      showToast("明细已删除");
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </FinSection>

      {/* ---------- 月度报告 ---------- */}
      <div id="finance-report" className="scroll-mt-4">
        <FinSection
          title="月度报告"
          en="Monthly Report"
          testid="fin-report"
          action={
            <button
              type="button"
              data-testid="fin-print"
              className="xuan-btn shrink-0"
              onClick={() => window.print()}
            >
              <Printer className="mr-1 h-3.5 w-3.5" />
              导出（简版打印）
            </button>
          }
        >
          <div className="flex flex-wrap items-center gap-2 px-1">
            <label className="flex items-center gap-2 text-[12px] text-[color:var(--studio-muted)]">
              账期
              <select
                data-testid="fin-report-month"
                value={activeReportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
                className="rounded-[10px] border border-[color:var(--studio-border)] bg-black/20 px-3 py-1.5 text-[13px] text-[color:var(--studio-text)] outline-none"
              >
                {reportMonths.map((mk) => (
                  <option key={mk} value={mk}>
                    {monthLabel(mk)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex overflow-hidden rounded-full border border-[color:var(--studio-border)]">
              <button
                type="button"
                data-testid="fin-scope-all"
                className={cn(
                  "px-3 py-1.5 text-[12px]",
                  scope === "all" && "studio-pill-active",
                )}
                onClick={() => setScope("all")}
              >
                全部资金流出
              </button>
              <button
                type="button"
                data-testid="fin-scope-consume"
                className={cn(
                  "px-3 py-1.5 text-[12px]",
                  scope === "consume" && "studio-pill-active",
                )}
                onClick={() => setScope("consume")}
              >
                仅消费
              </button>
            </div>
            <span className="text-[10px] text-[color:var(--studio-muted)]">
              「仅消费」排除分类含「还款」「转账」的流出；净现金流随口径计算。
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label={`净现金流 · ${monthLabel(activeReportMonth)}`}
              testid="fin-rp-netflow"
              data={{ income: rp.income, outflow: rp.outflow, net: rp.net }}
            >
              <p
                className={cn(
                  "text-xl font-semibold tabular-nums",
                  rp.net < 0 ? "text-orange-400" : "text-emerald-500",
                )}
              >
                {fmtMoney(rp.net)}
              </p>
              <p className="mt-1 text-[11px] tabular-nums text-[color:var(--studio-muted)]">
                收入 {fmtMoney(rp.income)} · 流出 {fmtMoney(rp.outflow)}
              </p>
            </StatCard>
            <StatCard
              label="本月支出"
              testid="fin-rp-expense"
              data={{ amount: rp.outflow, count: rp.expenseCount }}
            >
              <p className="text-xl font-semibold tabular-nums">
                {fmtMoney(rp.outflow)}
              </p>
              <p className="mt-1 text-[11px] text-[color:var(--studio-muted)]">
                共 {rp.expenseCount} 条支出明细（当前口径）
              </p>
            </StatCard>
            <StatCard
              label="预算剩余"
              testid="fin-rp-budget"
              data={{
                budget: budget === null ? "none" : budget,
                remaining:
                  rpBudgetRemaining === null ? "none" : rpBudgetRemaining,
                pct: rpBudgetPct,
              }}
            >
              {budget === null ? (
                <>
                  <p className="text-xl font-semibold">未设置</p>
                  <p className="mt-1 text-[11px] text-[color:var(--studio-muted)]">
                    在上方概览的预算卡里设置月度预算。
                  </p>
                </>
              ) : (
                <>
                  <p
                    className={cn(
                      "text-xl font-semibold tabular-nums",
                      (rpBudgetRemaining ?? 0) < 0 && "text-orange-400",
                    )}
                  >
                    {fmtMoney(rpBudgetRemaining ?? 0)}
                  </p>
                  <p className="mt-1 text-[11px] tabular-nums text-[color:var(--studio-muted)]">
                    预算 {fmtMoney(budget)} · 已用 {rpBudgetPct}%
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-violet-500 transition-all"
                      style={{ width: `${rpBudgetPct}%` }}
                    />
                  </div>
                </>
              )}
            </StatCard>
            <StatCard
              label="偿还负债"
              testid="fin-rp-repay"
              data={{ amount: rp.repay }}
            >
              <p className="text-xl font-semibold tabular-nums">
                {fmtMoney(rp.repay)}
              </p>
              <p className="mt-1 text-[11px] text-[color:var(--studio-muted)]">
                来自分类为「还款」的支出 · 本金/利息/手续费未拆分
              </p>
            </StatCard>
            <StatCard
              label="追踪资产"
              testid="fin-rp-assets"
              data={{ count: assets.length, cost: assetCost }}
            >
              <p className="text-xl font-semibold tabular-nums">
                {assets.length} 项
              </p>
              <p className="mt-1 text-[11px] tabular-nums text-[color:var(--studio-muted)]">
                持仓成本合计 {fmtMoney(assetCost)} · 手动维护，不接行情
              </p>
            </StatCard>
            <StatCard label="本月关键变化" testid="fin-rp-change">
              <p className="flex items-center gap-1.5 text-[13px] font-medium">
                {changeText.startsWith("支出较上月 +") ? (
                  <TrendingUp className="h-4 w-4 shrink-0 text-orange-400" />
                ) : changeText.startsWith("支出较上月 -") ? (
                  <TrendingDown className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <Minus className="h-4 w-4 shrink-0 text-[color:var(--studio-muted)]" />
                )}
                <span data-testid="fin-rp-change-text">{changeText}</span>
              </p>
              <p className="mt-1 text-[11px] text-[color:var(--studio-muted)]">
                规则生成：本月支出与上月同口径对比。
              </p>
            </StatCard>
          </div>
        </FinSection>
      </div>

      {/* ---------- 负债管理 ---------- */}
      <FinSection title="负债管理" en="Liabilities" testid="fin-liab-section">
        <div
          data-testid="fin-liab-summary"
          data-total={liabTotal}
          data-min={liabMin}
          data-count={liabilities.length}
          className="studio-glass flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-[13px]"
        >
          <span>
            总负债 <b className="tabular-nums">{fmtMoney(liabTotal)}</b>
          </span>
          <span>
            月最低还款合计 <b className="tabular-nums">{fmtMoney(liabMin)}</b>
          </span>
          <span className="text-[color:var(--studio-muted)]">
            共 {liabilities.length} 笔
          </span>
        </div>
        <div
          data-testid="fin-liab-advice"
          data-name={advice ? advice.name : "none"}
          className="studio-glass border-l-4 border-l-violet-500 p-4"
        >
          <p className="flex items-center gap-2 text-[13px] font-semibold">
            优先偿还建议
            <span className="rounded-full px-2 py-0.5 text-[10px] studio-pill-active">
              规则建议 · 按利率优先
            </span>
          </p>
          {advice ? (
            <p className="mt-1 text-[12px] text-[color:var(--studio-muted)]">
              先还「{advice.name}」：年化利率 {advice.annualRate}% 为当前最高，
              剩余 {fmtMoney(advice.remaining)}，优先偿还能减少利息支出。
            </p>
          ) : liabilities.length > 0 ? (
            <p className="mt-1 text-[12px] text-[color:var(--studio-muted)]">
              已记录的负债暂未填写年化利率，补上利率后这里会按从高到低给出优先顺序。
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-[color:var(--studio-muted)]">
              暂无负债记录。添加负债并填写年化利率后，这里会给出优先偿还建议。
            </p>
          )}
        </div>
        <form
          className="studio-glass grid gap-2 p-4 md:grid-cols-[1fr_120px_120px_110px_120px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            submitLiab();
          }}
        >
          <label>
            <span className={labelCls}>名称</span>
            <input
              data-testid="fin-liab-name"
              value={liabForm.name}
              onChange={(e) =>
                setLiabForm({ ...liabForm, name: e.target.value })
              }
              placeholder="如 微信分付"
              className={inputCls}
            />
          </label>
          <label>
            <span className={labelCls}>总额（元）</span>
            <input
              data-testid="fin-liab-total"
              type="number"
              min="0"
              step="0.01"
              value={liabForm.total}
              onChange={(e) =>
                setLiabForm({ ...liabForm, total: e.target.value })
              }
              placeholder="0.00"
              className={inputCls}
            />
          </label>
          <label>
            <span className={labelCls}>剩余（元，空=同总额）</span>
            <input
              data-testid="fin-liab-remaining"
              type="number"
              min="0"
              step="0.01"
              value={liabForm.remaining}
              onChange={(e) =>
                setLiabForm({ ...liabForm, remaining: e.target.value })
              }
              placeholder="0.00"
              className={inputCls}
            />
          </label>
          <label>
            <span className={labelCls}>年化利率 %（可选）</span>
            <input
              data-testid="fin-liab-rate"
              type="number"
              min="0"
              step="0.01"
              value={liabForm.rate}
              onChange={(e) =>
                setLiabForm({ ...liabForm, rate: e.target.value })
              }
              placeholder="如 18"
              className={inputCls}
            />
          </label>
          <label>
            <span className={labelCls}>月最低还款（可选）</span>
            <input
              data-testid="fin-liab-min"
              type="number"
              min="0"
              step="0.01"
              value={liabForm.min}
              onChange={(e) =>
                setLiabForm({ ...liabForm, min: e.target.value })
              }
              placeholder="0.00"
              className={inputCls}
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              data-testid="fin-liab-submit"
              className="xuan-btn xuan-btn-primary shrink-0"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {editingLiabId ? "保存修改" : "添加负债"}
            </button>
            {editingLiabId && (
              <button
                type="button"
                className="xuan-btn shrink-0"
                onClick={resetLiabForm}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <label className="md:col-span-6">
            <span className={labelCls}>备注（可选）</span>
            <input
              data-testid="fin-liab-note"
              value={liabForm.note}
              onChange={(e) =>
                setLiabForm({ ...liabForm, note: e.target.value })
              }
              placeholder="补充说明"
              className={inputCls}
            />
          </label>
        </form>
        <div data-testid="fin-liabs" data-count={liabilities.length}>
          {liabilities.length === 0 ? (
            <p className="px-1 text-[12px] text-[color:var(--studio-muted)]">
              还没有负债记录，用上面的表单添加第一笔。
            </p>
          ) : (
            <ul className="space-y-2">
              {liabilities.map((l) => (
                <li
                  key={l.id}
                  data-testid="fin-liab-row"
                  data-liab-id={l.id}
                  className="studio-glass flex items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {l.name}
                      {l.note && (
                        <span className="ml-2 text-[12px] font-normal text-[color:var(--studio-muted)]">
                          {l.note}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[10px] tabular-nums text-[color:var(--studio-muted)]">
                      总额 {fmtMoney(l.total)}
                      {typeof l.annualRate === "number" &&
                        ` · 年化 ${l.annualRate}%`}
                      {typeof l.minPayment === "number" &&
                        ` · 月最低 ${fmtMoney(l.minPayment)}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-orange-400">
                    剩 {fmtMoney(l.remaining)}
                  </span>
                  <button
                    type="button"
                    data-testid={`fin-liab-edit-${l.id}`}
                    className="xuan-btn shrink-0"
                    aria-label="编辑"
                    onClick={() => {
                      setEditingLiabId(l.id);
                      setLiabForm({
                        name: l.name,
                        total: String(l.total),
                        remaining: String(l.remaining),
                        rate:
                          l.annualRate !== undefined
                            ? String(l.annualRate)
                            : "",
                        min:
                          l.minPayment !== undefined
                            ? String(l.minPayment)
                            : "",
                        note: l.note ?? "",
                      });
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    data-testid={`fin-liab-del-${l.id}`}
                    className="xuan-btn shrink-0"
                    aria-label="删除"
                    onClick={() => {
                      if (!window.confirm(`删除负债「${l.name}」？`)) return;
                      props.onDeleteLiability(l.id);
                      if (editingLiabId === l.id) resetLiabForm();
                      showToast("负债已删除");
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </FinSection>

      {/* ---------- 资产台账 ---------- */}
      <FinSection title="资产台账" en="Assets" testid="fin-asset-section">
        <div
          data-testid="fin-asset-summary"
          data-count={assets.length}
          data-cost={assetCost}
          data-value={assetValue === null ? "none" : assetValue}
          className="studio-glass flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-[13px]"
        >
          <span>
            共 <b className="tabular-nums">{assets.length}</b> 项
          </span>
          <span>
            持仓成本合计 <b className="tabular-nums">{fmtMoney(assetCost)}</b>
          </span>
          <span>
            现值合计{" "}
            <b className="tabular-nums">
              {assetValue === null ? "未填现值" : fmtMoney(assetValue)}
            </b>
          </span>
          <span className="text-[11px] text-[color:var(--studio-muted)]">
            手动维护，不接行情
          </span>
        </div>
        <form
          className="studio-glass grid gap-2 p-4 md:grid-cols-[1fr_110px_130px_130px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            submitAsset();
          }}
        >
          <label>
            <span className={labelCls}>名称</span>
            <input
              data-testid="fin-asset-name"
              value={assetForm.name}
              onChange={(e) =>
                setAssetForm({ ...assetForm, name: e.target.value })
              }
              placeholder="如 招商银行持仓"
              className={inputCls}
            />
          </label>
          <label>
            <span className={labelCls}>类型</span>
            <select
              data-testid="fin-asset-type"
              value={assetForm.type}
              onChange={(e) =>
                setAssetForm({
                  ...assetForm,
                  type: e.target.value as FinanceAssetType,
                })
              }
              className={inputCls}
            >
              {FINANCE_ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelCls}>持仓成本（元）</span>
            <input
              data-testid="fin-asset-cost"
              type="number"
              min="0"
              step="0.01"
              value={assetForm.cost}
              onChange={(e) =>
                setAssetForm({ ...assetForm, cost: e.target.value })
              }
              placeholder="0.00"
              className={inputCls}
            />
          </label>
          <label>
            <span className={labelCls}>现值（元，可选）</span>
            <input
              data-testid="fin-asset-value"
              type="number"
              min="0"
              step="0.01"
              value={assetForm.value}
              onChange={(e) =>
                setAssetForm({ ...assetForm, value: e.target.value })
              }
              placeholder="不填则不计"
              className={inputCls}
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              data-testid="fin-asset-submit"
              className="xuan-btn xuan-btn-primary shrink-0"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {editingAssetId ? "保存修改" : "添加资产"}
            </button>
            {editingAssetId && (
              <button
                type="button"
                className="xuan-btn shrink-0"
                onClick={resetAssetForm}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </form>
        <div data-testid="fin-assets" data-count={assets.length}>
          {assets.length === 0 ? (
            <p className="px-1 text-[12px] text-[color:var(--studio-muted)]">
              还没有资产记录，用上面的表单添加第一项。
            </p>
          ) : (
            <ul className="space-y-2">
              {assets.map((a) => (
                <li
                  key={a.id}
                  data-testid="fin-asset-row"
                  data-asset-id={a.id}
                  className="studio-glass flex items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {a.name}
                      <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] studio-pill-active">
                        {a.type}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[10px] tabular-nums text-[color:var(--studio-muted)]">
                      成本 {fmtMoney(a.cost)}
                      {typeof a.value === "number" &&
                        ` · 现值 ${fmtMoney(a.value)}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid={`fin-asset-edit-${a.id}`}
                    className="xuan-btn shrink-0"
                    aria-label="编辑"
                    onClick={() => {
                      setEditingAssetId(a.id);
                      setAssetForm({
                        name: a.name,
                        type: a.type,
                        cost: String(a.cost),
                        value: a.value !== undefined ? String(a.value) : "",
                      });
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    data-testid={`fin-asset-del-${a.id}`}
                    className="xuan-btn shrink-0"
                    aria-label="删除"
                    onClick={() => {
                      if (!window.confirm(`删除资产「${a.name}」？`)) return;
                      props.onDeleteAsset(a.id);
                      if (editingAssetId === a.id) resetAssetForm();
                      showToast("资产已删除");
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </FinSection>

      {/* ---------- AI 诊断（占位，走聊天回路） ---------- */}
      <div
        data-testid="fin-ai-card"
        className="studio-glass border-violet-400/30 p-4"
      >
        <p className="flex items-center gap-2 text-[13px] font-semibold">
          <Sparkles className="h-4 w-4 text-violet-400" />
          AI 资产诊断
          <span className="rounded-full px-2 py-0.5 text-[10px] studio-pill-active">
            接入阶段开放
          </span>
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--studio-muted)]">
          自动诊断还在接入阶段。现在可以把当月数据摘要复制下来，发给 Luna
          在聊天里做诊断。
        </p>
        <button
          type="button"
          data-testid="fin-ai-copy"
          className="xuan-btn mt-3"
          onClick={copyAiSummary}
        >
          <Copy className="mr-1 h-3.5 w-3.5" />
          复制本月摘要给 Luna
        </button>
      </div>
    </div>
  );
}
