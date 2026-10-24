"use client";

/** 第二主题 · 财务管理：全量业务对等重构（定稿 v2）。
 * 中区：折叠记账表单 + 明细列表 + 概览条 + 月度报告（账期/口径/6 卡）
 * + 分类小计 + 负债台账 + 资产台账 + 订阅台账；
 * 右栏：预算监控卡 + 现金流监控卡 + 选中条目详情。
 * 计算口径逐字复刻第一主题 FinanceBody，见 finance-calc.ts。
 * 写入复刻第一主题语义：同一批已登记键、id 前缀按方案 §02.5、
 * 落盘后 emit FINANCE_ADD_ENTRY；第一主题挂载读同键即同源。
 * 红线：不动 hud-module-content / snapshot / bus / ring/final，
 * 不新增任何 studio_* 键，不 import 第一主题私有函数。 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import RingModuleShell from "./ring-module-shell";
import { DetailView, GroupList, findRow, firstRowId } from "./list-ui";
import { metaOf } from "./meta";
import { loadFinance } from "./data";
import type { ModData } from "./data";
import { emit } from "@/components/studio/bus";
import {
  FINANCE_ASSET_TYPES,
  currentMonthKey,
  fmtMoney,
} from "@/components/studio/finance-module";
import type {
  FinanceAsset,
  FinanceAssetType,
  FinanceEntry,
  FinanceLiability,
} from "@/components/studio/finance-module";
import {
  SUB_CYCLE_LABEL,
  daysLeftLabel,
  dueSoon,
  loadSubscriptions,
  summarizeSubs,
} from "@/components/studio/finance-subscriptions";
import type { Subscription } from "@/components/studio/finance-subscriptions";
import {
  assetTotals,
  budgetDerived,
  categoryBreakdown,
  changeText,
  finMonthLabel,
  finPrevMonthKey,
  liabilityTotals,
  liabAdvice,
  summarizeMonth,
} from "./finance-calc";
import type { FinScope } from "./finance-calc";

const FIN_KEY = "studio_finance_entries_v1";
const FIN_LIAB_KEY = "studio_finance_liabilities_v1";
const FIN_ASSET_KEY = "studio_finance_assets_v1";
const FIN_BUDGET_KEY = "studio_finance_budget_v1";

/* finRound2 / finTodayStr 是第一主题 hud-module-content.tsx（:1876/:1886）
 * 内部未导出函数：此处只读参考、本地复刻同名实现，严禁反向 import、
 * 更严禁为导出而改第一主题文件。 */
const finPad2 = (n: number) => String(n).padStart(2, "0");
const finRound2 = (n: number) => Math.round(n * 100) / 100;
const finTodayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${finPad2(d.getMonth() + 1)}-${finPad2(d.getDate())}`;
};
const hhmmNow = (): string => {
  const d = new Date();
  return `${finPad2(d.getHours())}:${finPad2(d.getMinutes())}`;
};

/* 与第一主题 FinanceBody 读取过滤逐字同口径（含日期正则校验）。 */
const okFinEntry = (e: unknown): e is FinanceEntry => {
  if (!e || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(o.date) &&
    (o.kind === "income" || o.kind === "expense") &&
    typeof o.amount === "number" &&
    Number.isFinite(o.amount) &&
    typeof o.category === "string"
  );
};

/* 负债 / 资产读取过滤与第一主题挂载过滤同口径。 */
const okLiab = (e: unknown): e is FinanceLiability => {
  if (!e || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.total === "number" &&
    typeof o.remaining === "number"
  );
};
const okAsset = (e: unknown): e is FinanceAsset => {
  if (!e || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.cost === "number"
  );
};

const readArr = (key: string): unknown[] => {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const writeArr = (key: string, arr: unknown[]): void => {
  try {
    window.localStorage.setItem(key, JSON.stringify(arr));
  } catch {
    /* storage unavailable：与第一主题同纪律，仍走广播与本页刷新 */
  }
};
const readBudget = (): number | null => {
  try {
    const raw = window.localStorage.getItem(FIN_BUDGET_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
};

type FinData = ModData & { income: number; expense: number };
type FormErrors = {
  date?: string;
  amount?: string;
  category?: string;
  note?: string;
};

/** 区块头：中文标题 + 英文 + 右侧操作区。 */
function SecHead({
  cn,
  en,
  action,
}: {
  cn: string;
  en: string;
  action?: ReactNode;
}) {
  return (
    <div className="rm-fin-head">
      <span>
        <span className="rm-fin-headCn">{cn}</span>
        <span className="rm-fin-headEn">{en}</span>
      </span>
      {action}
    </div>
  );
}

/** 指标卡：k 标题 / v 数值 / s 说明。 */
function FinCard({
  k,
  v,
  s,
  tone,
  testid,
  small,
}: {
  k: string;
  v: ReactNode;
  s: string;
  tone?: "neg" | "pos";
  testid?: string;
  small?: boolean;
}) {
  return (
    <div
      className={`rm-fin-card${tone === "neg" ? " neg" : tone === "pos" ? " pos" : ""}`}
      data-testid={testid}
    >
      <div className="rm-fin-k">{k}</div>
      <div className={`rm-fin-v${small ? " sm" : ""}`}>{v}</div>
      <div className="rm-fin-s">{s}</div>
    </div>
  );
}

/** 二次确认删除：与第一主题 InlineConfirmButton 同语义——
 * 首击进入 armed 态（4 秒自动解除），次击确认删除。 */
function ConfirmDeleteBtn({
  onConfirm,
  testid,
}: {
  onConfirm: () => void;
  testid?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  if (!armed) {
    return (
      <button
        type="button"
        className="rm-fin-miniBtn"
        data-testid={testid}
        onClick={() => setArmed(true)}
      >
        删除
      </button>
    );
  }
  return (
    <button
      type="button"
      className="rm-fin-miniBtn danger"
      data-testid={testid ? `${testid}-confirm` : undefined}
      onClick={() => {
        setArmed(false);
        onConfirm();
      }}
    >
      确认删除？
    </button>
  );
}

export default function RingFinance() {
  const meta = metaOf("finance");
  const [data, setData] = useState<FinData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(
    null,
  );

  /* 全量数据源：流水（原始条目，供月度/口径计算）+ 负债 + 资产 + 订阅 + 预算。 */
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [liabilities, setLiabilities] = useState<FinanceLiability[]>([]);
  const [assets, setAssets] = useState<FinanceAsset[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [budget, setBudget] = useState<number | null>(null);

  /* 报表控制：账期 + 口径。
   * nowMonth / todayStr 与日期初值同理：只能在挂载 effect 里求值，
   * 本仓 Next 版本拦截 Client Component 预渲染期的 new Date() 调用。 */
  const [scope, setScope] = useState<FinScope>("all");
  const [reportMonth, setReportMonth] = useState<string>("");
  const [nowMonth, setNowMonth] = useState("");
  const [todayStr, setTodayStr] = useState("");

  /* 记账表单（顶部折叠面板，.rm-center 正常流首位，展开不遮挡列表首项） */
  const [formOpen, setFormOpen] = useState(false);
  /* 日期初值在挂载 effect 里置今天：useState 初值会在预渲染期求值，
   * 本仓 Next 版本拦截 new Date() 的预渲染求值，故不在此直调 finTodayStr。 */
  const [fDate, setFDate] = useState("");
  const [fKind, setFKind] = useState<"income" | "expense">("expense");
  const [fAmount, setFAmount] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fNote, setFNote] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  /* 负债行内表单（方案 §02.5.1）。 */
  const [liabFormOpen, setLiabFormOpen] = useState(false);
  const [editingLiabId, setEditingLiabId] = useState<string | null>(null);
  const [liabForm, setLiabForm] = useState({
    name: "",
    total: "",
    remaining: "",
    rate: "",
    min: "",
    note: "",
  });
  const [liabErr, setLiabErr] = useState("");

  /* 资产行内表单（方案 §02.5.2）。 */
  const [assetFormOpen, setAssetFormOpen] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [assetForm, setAssetForm] = useState({
    name: "",
    type: "股票" as FinanceAssetType,
    cost: "",
    value: "",
  });
  const [assetErr, setAssetErr] = useState("");

  /* 右栏预算卡。 */
  const [budgetDraft, setBudgetDraft] = useState("");
  const [budgetEditing, setBudgetEditing] = useState(false);
  const [budgetErr, setBudgetErr] = useState("");

  const reloadAll = () => {
    const d = loadFinance();
    setData(d);
    setEntries(readArr(FIN_KEY).filter(okFinEntry));
    setLiabilities(readArr(FIN_LIAB_KEY).filter(okLiab));
    setAssets(readArr(FIN_ASSET_KEY).filter(okAsset));
    setSubs(loadSubscriptions());
    setBudget(readBudget());
    setLoaded(true);
  };

  useEffect(() => {
    setFDate(finTodayStr());
    setNowMonth(currentMonthKey());
    setTodayStr(finTodayStr());
    reloadAll();
    const d = loadFinance();
    setSelectedId(firstRowId(d));
    setStatus({
      text: `FINANCE · ${d.total} 笔 · 已同步 ${hhmmNow()}`,
      ok: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!meta) return null;

  /* ── 派生（全部取自 finance-calc，与第一主题逐字同口径）── */
  const reportMonths = useMemo(() => {
    const set = new Set(entries.map((e) => e.date.slice(0, 7)));
    if (nowMonth) set.add(nowMonth);
    return [...set].sort().reverse();
  }, [entries, nowMonth]);
  const activeReportMonth = reportMonths.includes(reportMonth)
    ? reportMonth
    : nowMonth;
  const ov = useMemo(
    () => summarizeMonth(entries, nowMonth, scope),
    [entries, nowMonth, scope],
  );
  const rp = useMemo(
    () => summarizeMonth(entries, activeReportMonth, scope),
    [entries, activeReportMonth, scope],
  );
  const rpPrev = useMemo(
    () => summarizeMonth(entries, finPrevMonthKey(activeReportMonth), scope),
    [entries, activeReportMonth, scope],
  );
  const change = useMemo(
    () => changeText(rp, rpPrev, fmtMoney),
    [rp, rpPrev],
  );
  const byCategory = useMemo(
    () => categoryBreakdown(entries, activeReportMonth),
    [entries, activeReportMonth],
  );
  const catTotalOut = useMemo(
    () => finRound2(byCategory.reduce((s, c) => s + c.out, 0)),
    [byCategory],
  );
  const liab = useMemo(() => liabilityTotals(liabilities), [liabilities]);
  const asset = useMemo(() => assetTotals(assets), [assets]);
  const advice = useMemo(() => liabAdvice(liabilities), [liabilities]);
  const budOv = useMemo(
    () => budgetDerived(budget, ov.outflow),
    [budget, ov.outflow],
  );
  const budRp = useMemo(
    () => budgetDerived(budget, rp.outflow),
    [budget, rp.outflow],
  );
  const subSum = useMemo(() => summarizeSubs(subs), [subs]);
  const subDueSoon = useMemo(
    () => (todayStr ? dueSoon(subs, todayStr) : []),
    [subs, todayStr],
  );

  const markSaved = (action: string) => {
    const d = loadFinance();
    setStatus({
      text: `FINANCE · ${d.total} 笔 · ${action} ${hhmmNow()}`,
      ok: true,
    });
  };

  /* ── 记账保存：与 #101 完全相同的校验与写入路径 ── */
  const onSave = (ev: FormEvent) => {
    ev.preventDefault();
    const errs: FormErrors = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fDate)) errs.date = "先选日期";
    const amount = finRound2(Number(fAmount));
    if (fAmount.trim() === "" || !Number.isFinite(amount) || amount <= 0)
      errs.amount = "金额要大于 0";
    const category = fCategory.trim();
    if (category === "") errs.category = "先填分类，如 日用 / 还款 / 工资";
    else if (category.length > 24) errs.category = "分类最多 24 字";
    const noteText = fNote.trim();
    if (noteText.length > 100) errs.note = "备注最多 100 字";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const rec: Omit<FinanceEntry, "id" | "source"> = {
      date: fDate,
      kind: fKind,
      amount,
      category,
      ...(noteText ? { note: noteText } : {}),
    };
    const existing = readArr(FIN_KEY).filter(okFinEntry);
    const entry: FinanceEntry = { ...rec, id: `fin-${Date.now()}` };
    writeArr(FIN_KEY, [...existing, entry]);
    emit("FINANCE_ADD_ENTRY", "finance", `${rec.category} ¥${rec.amount}`);

    reloadAll();
    const next = loadFinance();
    if (findRow(next, entry.id)) setSelectedId(entry.id);
    setStatus({
      text: `FINANCE · ${next.total} 笔 · 已保存 ${hhmmNow()}`,
      ok: true,
    });
    setFAmount("");
    setFCategory("");
    setFNote("");
    setErrors({});
  };

  /* ── 负债行内录入（方案 §02.5.1，校验文案逐字）── */
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
    setLiabErr("");
  };
  const submitLiab = (ev: FormEvent) => {
    ev.preventDefault();
    const name = liabForm.name.trim();
    if (name === "") {
      setLiabErr("先填负债名称");
      return;
    }
    if (name.length > 32) {
      setLiabErr("名称最多 32 字");
      return;
    }
    const total = Number(liabForm.total);
    if (liabForm.total.trim() === "" || !Number.isFinite(total) || total <= 0) {
      setLiabErr("总额要大于 0");
      return;
    }
    const remaining =
      liabForm.remaining.trim() === "" ? total : Number(liabForm.remaining);
    if (
      !Number.isFinite(remaining) ||
      remaining < 0 ||
      remaining > total
    ) {
      setLiabErr("剩余要在 0 到总额之间");
      return;
    }
    const rate =
      liabForm.rate.trim() === "" ? undefined : Number(liabForm.rate);
    if (rate !== undefined && (!Number.isFinite(rate) || rate < 0)) {
      setLiabErr("年化利率要 ≥ 0");
      return;
    }
    const min = liabForm.min.trim() === "" ? undefined : Number(liabForm.min);
    if (min !== undefined && (!Number.isFinite(min) || min < 0)) {
      setLiabErr("最低还款要 ≥ 0");
      return;
    }
    const noteText = liabForm.note.trim();
    if (noteText.length > 100) {
      setLiabErr("备注最多 100 字");
      return;
    }
    const payload: Omit<FinanceLiability, "id"> = {
      name,
      total: finRound2(total),
      remaining: finRound2(remaining),
      ...(rate !== undefined ? { annualRate: rate } : {}),
      ...(min !== undefined ? { minPayment: finRound2(min) } : {}),
      ...(noteText ? { note: noteText } : {}),
    };
    if (editingLiabId) {
      writeArr(
        FIN_LIAB_KEY,
        liabilities.map((l) =>
          l.id === editingLiabId ? { ...l, ...payload } : l,
        ),
      );
    } else {
      writeArr(FIN_LIAB_KEY, [
        ...liabilities,
        { ...payload, id: `fin-liab-${Date.now()}` },
      ]);
    }
    emit("FINANCE_ADD_ENTRY", "finance", `负债 · ${name}`);
    reloadAll();
    markSaved("负债已保存");
    setLiabFormOpen(false);
    resetLiabForm();
  };
  const deleteLiab = (id: string, name: string) => {
    writeArr(
      FIN_LIAB_KEY,
      liabilities.filter((l) => l.id !== id),
    );
    emit("FINANCE_ADD_ENTRY", "finance", `负债删除 · ${name}`);
    reloadAll();
    markSaved("负债已删除");
  };

  /* ── 资产行内录入（方案 §02.5.2，校验文案逐字）── */
  const resetAssetForm = () => {
    setEditingAssetId(null);
    setAssetForm({ name: "", type: "股票", cost: "", value: "" });
    setAssetErr("");
  };
  const submitAsset = (ev: FormEvent) => {
    ev.preventDefault();
    const name = assetForm.name.trim();
    if (name === "") {
      setAssetErr("先填资产名称");
      return;
    }
    if (name.length > 32) {
      setAssetErr("名称最多 32 字");
      return;
    }
    const cost = Number(assetForm.cost);
    if (assetForm.cost.trim() === "" || !Number.isFinite(cost) || cost < 0) {
      setAssetErr("成本要 ≥ 0");
      return;
    }
    const value =
      assetForm.value.trim() === "" ? undefined : Number(assetForm.value);
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      setAssetErr("估值要 ≥ 0");
      return;
    }
    const payload: Omit<FinanceAsset, "id"> = {
      name,
      type: assetForm.type,
      cost: finRound2(cost),
      ...(value !== undefined ? { value: finRound2(value) } : {}),
    };
    if (editingAssetId) {
      writeArr(
        FIN_ASSET_KEY,
        assets.map((a) =>
          a.id === editingAssetId ? { ...a, ...payload } : a,
        ),
      );
    } else {
      writeArr(FIN_ASSET_KEY, [
        ...assets,
        { ...payload, id: `fin-asset-${Date.now()}` },
      ]);
    }
    emit("FINANCE_ADD_ENTRY", "finance", `资产 · ${name}`);
    reloadAll();
    markSaved("资产已保存");
    setAssetFormOpen(false);
    resetAssetForm();
  };
  const deleteAsset = (id: string, name: string) => {
    writeArr(
      FIN_ASSET_KEY,
      assets.filter((a) => a.id !== id),
    );
    emit("FINANCE_ADD_ENTRY", "finance", `资产删除 · ${name}`);
    reloadAll();
    markSaved("资产已删除");
  };

  /* ── 右栏预算卡：读写形态与第一主题 saveBudget 一致
   *（数值存 String(n)，清除删键；读时须 finite 且 > 0）。── */
  const saveBudget = (n: number | null) => {
    setBudget(n);
    try {
      if (n === null) window.localStorage.removeItem(FIN_BUDGET_KEY);
      else window.localStorage.setItem(FIN_BUDGET_KEY, String(n));
    } catch {
      /* storage unavailable */
    }
  };
  const applyBudget = () => {
    const n = Number(budgetDraft);
    if (!Number.isFinite(n) || n <= 0) {
      setBudgetErr("预算要大于 0");
      return;
    }
    saveBudget(finRound2(n));
    setBudgetEditing(false);
    setBudgetErr("");
    markSaved("预算已保存");
  };
  const clearBudget = () => {
    saveBudget(null);
    setBudgetEditing(false);
    setBudgetDraft("");
    setBudgetErr("");
    markSaved("预算已清除");
  };

  const row = findRow(data, selectedId);
  const note = data
    ? `收入合计 ¥${data.income} · 支出合计 ¥${data.expense} · 结余 ¥${data.income - data.expense}（自条目实算）`
    : undefined;

  const liabFormFields = (
    <>
      <div className="rm-field">
        <label htmlFor="fin-liab-name">
          名称 NAME <b>*</b>
        </label>
        <input
          id="fin-liab-name"
          type="text"
          className="rm-input"
          value={liabForm.name}
          onChange={(e) => setLiabForm({ ...liabForm, name: e.target.value })}
        />
      </div>
      <div className="rm-field">
        <label htmlFor="fin-liab-total">
          总额 TOTAL <b>*</b>
        </label>
        <input
          id="fin-liab-total"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="0.00"
          className="rm-input"
          value={liabForm.total}
          onChange={(e) => setLiabForm({ ...liabForm, total: e.target.value })}
        />
      </div>
      <div className="rm-field">
        <label htmlFor="fin-liab-remaining">剩余 REMAINING</label>
        <input
          id="fin-liab-remaining"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="留空 = 取总额"
          className="rm-input"
          value={liabForm.remaining}
          onChange={(e) =>
            setLiabForm({ ...liabForm, remaining: e.target.value })
          }
        />
      </div>
      <div className="rm-field">
        <label htmlFor="fin-liab-rate">年利率 % RATE</label>
        <input
          id="fin-liab-rate"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="选填"
          className="rm-input"
          value={liabForm.rate}
          onChange={(e) => setLiabForm({ ...liabForm, rate: e.target.value })}
        />
      </div>
      <div className="rm-field">
        <label htmlFor="fin-liab-min">最低还款 MIN</label>
        <input
          id="fin-liab-min"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="选填"
          className="rm-input"
          value={liabForm.min}
          onChange={(e) => setLiabForm({ ...liabForm, min: e.target.value })}
        />
      </div>
      <div className="rm-field">
        <label htmlFor="fin-liab-note">备注 NOTE</label>
        <input
          id="fin-liab-note"
          type="text"
          placeholder="选填"
          className="rm-input"
          value={liabForm.note}
          onChange={(e) => setLiabForm({ ...liabForm, note: e.target.value })}
        />
      </div>
    </>
  );

  const assetFormFields = (
    <>
      <div className="rm-field">
        <label htmlFor="fin-asset-name">
          名称 NAME <b>*</b>
        </label>
        <input
          id="fin-asset-name"
          type="text"
          className="rm-input"
          value={assetForm.name}
          onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
        />
      </div>
      <div className="rm-field">
        <label htmlFor="fin-asset-type">
          类型 TYPE <b>*</b>
        </label>
        <select
          id="fin-asset-type"
          className="rm-input"
          value={assetForm.type}
          onChange={(e) =>
            setAssetForm({ ...assetForm, type: e.target.value as FinanceAssetType })
          }
        >
          {FINANCE_ASSET_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="rm-field">
        <label htmlFor="fin-asset-cost">
          成本 COST <b>*</b>
        </label>
        <input
          id="fin-asset-cost"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="0.00"
          className="rm-input"
          value={assetForm.cost}
          onChange={(e) => setAssetForm({ ...assetForm, cost: e.target.value })}
        />
      </div>
      <div className="rm-field">
        <label htmlFor="fin-asset-value">当前估值 VALUE</label>
        <input
          id="fin-asset-value"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="选填"
          className="rm-input"
          value={assetForm.value}
          onChange={(e) => setAssetForm({ ...assetForm, value: e.target.value })}
        />
      </div>
    </>
  );

  const budgetOver = budget !== null && ov.outflow > budget;
  return (
    <RingModuleShell
      active={meta.id}
      cn={meta.cn}
      en={meta.en}
      src={meta.src}
      count={loaded ? (data?.total ?? 0) : null}
      note={note}
      status={status?.text}
      statusOk={status?.ok}
      detail={
        <>
          <div className="rm-fin-sidecard" data-testid="rm-fin-budget-card">
            <div className="rm-fin-sideHead">
              <span>预算监控</span>
              <span className="rm-fin-sideEn">BUDGET</span>
            </div>
            {budget === null ? (
              <div className="rm-fin-v">未设置</div>
            ) : (
              <>
                <div className={`rm-fin-v${budgetOver ? " neg" : ""}`}>
                  剩余 {fmtMoney(budOv.remaining ?? 0)}
                </div>
                <div className="rm-fin-s">
                  预算 {fmtMoney(budget)} · 已用 {budOv.pct}%（按当前口径本月支出计）
                  {budgetOver ? " · 已超预算" : ""}
                </div>
                <div
                  className={`rm-fin-budgetbar${budgetOver ? " over" : ""}`}
                  data-testid="rm-fin-budget-bar"
                  data-pct={budOv.pct}
                >
                  <i style={{ width: `${budOv.pct}%` }} />
                </div>
              </>
            )}
            {budgetEditing || budget === null ? (
              <div className="rm-fin-budgetForm">
                <input
                  data-testid="rm-fin-budget-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  className="rm-input"
                  value={budgetDraft}
                  onChange={(e) => setBudgetDraft(e.target.value)}
                  placeholder="月度预算（元）"
                />
                <span className="rm-fin-budgetBtns">
                  <button
                    type="button"
                    className="rm-formBtn rm-formBtnPrimary"
                    data-testid="rm-fin-budget-save"
                    onClick={applyBudget}
                  >
                    保存
                  </button>
                  {budget !== null ? (
                    <>
                      <button
                        type="button"
                        className="rm-formBtn"
                        onClick={() => {
                          setBudgetEditing(false);
                          setBudgetErr("");
                        }}
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        className="rm-formBtn"
                        data-testid="rm-fin-budget-clear"
                        onClick={clearBudget}
                      >
                        清除
                      </button>
                    </>
                  ) : null}
                </span>
                {budgetErr ? <div className="rm-err">{budgetErr}</div> : null}
              </div>
            ) : (
              <button
                type="button"
                className="rm-formBtn"
                data-testid="rm-fin-budget-edit"
                onClick={() => {
                  setBudgetDraft(String(budget));
                  setBudgetEditing(true);
                }}
              >
                修改预算
              </button>
            )}
          </div>
          <div className="rm-fin-sidecard" data-testid="rm-fin-cash-card">
            <div className="rm-fin-sideHead">
              <span>现金流监控</span>
              <span className="rm-fin-sideEn">CASHFLOW · 本月</span>
            </div>
            <div
              className={`rm-fin-v${ov.net < 0 ? " neg" : ov.net > 0 ? " pos" : ""}`}
              data-testid="rm-fin-cash-net"
            >
              净 {fmtMoney(ov.net)}
            </div>
            <div className="rm-fin-s" data-testid="rm-fin-cash-io">
              收入 {fmtMoney(ov.income)} / 流出 {fmtMoney(ov.outflow)}
            </div>
            <div className="rm-fin-s">
              口径：{scope === "all" ? "全部资金流出" : "仅消费（不含还款/转账）"}
            </div>
          </div>
          <DetailView row={row} />
        </>
      }
    >
      <button
        type="button"
        className={"rm-formBtn rm-formToggle"}
        onClick={() => {
          setFormOpen((o) => !o);
          setErrors({});
        }}
      >
        {formOpen ? "− 收起记账 · CLOSE" : "+ 记一笔 · NEW ENTRY"}
      </button>
      {formOpen ? (
        <form className={"rm-form"} onSubmit={onSave} noValidate>
          <div className={"rm-formGrid"}>
            <div className={"rm-field"}>
              <label htmlFor="fin-date">
                日期 DATE <b>*</b>
              </label>
              <input
                id="fin-date"
                type="date"
                className={`rm-input${errors.date ? " err" : ""}`}
                value={fDate}
                onChange={(e) => setFDate(e.target.value)}
              />
              {errors.date ? (
                <div className={"rm-err"}>{errors.date}</div>
              ) : null}
            </div>
            <div className={"rm-field"}>
              <label htmlFor="fin-kind">
                类型 KIND <b>*</b>
              </label>
              <select
                id="fin-kind"
                className={"rm-input"}
                value={fKind}
                onChange={(e) =>
                  setFKind(e.target.value as "income" | "expense")
                }
              >
                <option value="expense">支出 expense</option>
                <option value="income">收入 income</option>
              </select>
            </div>
            <div className={"rm-field"}>
              <label htmlFor="fin-amount">
                金额 AMOUNT <b>*</b>
              </label>
              <input
                id="fin-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                className={`rm-input${errors.amount ? " err" : ""}`}
                value={fAmount}
                onChange={(e) => setFAmount(e.target.value)}
              />
              {errors.amount ? (
                <div className={"rm-err"}>{errors.amount}</div>
              ) : null}
            </div>
            <div className={"rm-field"}>
              <label htmlFor="fin-category">
                分类 CATEGORY <b>*</b>
              </label>
              <input
                id="fin-category"
                type="text"
                placeholder="日用 / 还款 / 工资"
                className={`rm-input${errors.category ? " err" : ""}`}
                value={fCategory}
                onChange={(e) => setFCategory(e.target.value)}
              />
              {errors.category ? (
                <div className={"rm-err"}>{errors.category}</div>
              ) : null}
            </div>
            <div className={"rm-field rm-fieldWide"}>
              <label htmlFor="fin-note">备注 NOTE</label>
              <input
                id="fin-note"
                type="text"
                placeholder="选填"
                className={`rm-input${errors.note ? " err" : ""}`}
                value={fNote}
                onChange={(e) => setFNote(e.target.value)}
              />
              {errors.note ? (
                <div className={"rm-err"}>{errors.note}</div>
              ) : null}
            </div>
          </div>
          <div className={"rm-formFoot"}>
            <span className={"rm-formHint"}>
              必填：日期 / 类型 / 金额 / 分类 · 保存即落盘 + 广播
            </span>
            <span className={"rm-formBtns"}>
              <button
                type="button"
                className={"rm-formBtn"}
                onClick={() => {
                  setFormOpen(false);
                  setErrors({});
                }}
              >
                取消
              </button>
              <button
                type="submit"
                className={"rm-formBtn rm-formBtnPrimary"}
              >
                ↵ 记一笔
              </button>
            </span>
          </div>
        </form>
      ) : null}
      <GroupList
        data={data}
        loaded={loaded}
        selectedId={selectedId}
        onSelect={(r) => setSelectedId(r.id)}
      />

      {/* 概览条：本月 / 支出 / 预算（当前账期 + 当前口径） */}
      <section className="rm-fin-sec" data-testid="rm-fin-overview">
        <SecHead cn="概览" en="OVERVIEW" />
        <div className="rm-fin-grid">
          <FinCard
            k={`本月净现金流 · ${finMonthLabel(nowMonth)}`}
            v={fmtMoney(ov.net)}
            s={`收入 ${fmtMoney(ov.income)} · 流出 ${fmtMoney(ov.outflow)}`}
            tone={ov.net < 0 ? "neg" : ov.net > 0 ? "pos" : undefined}
            testid="rm-fin-ov-net"
          />
          <FinCard
            k="本月支出"
            v={fmtMoney(ov.outflow)}
            s={`共 ${ov.expenseCount} 条支出明细（当前口径）`}
            testid="rm-fin-ov-expense"
          />
          <FinCard
            k="预算剩余 · 本月"
            v={budget === null ? "未设置" : fmtMoney(budOv.remaining ?? 0)}
            s={
              budget === null
                ? "去右栏设置月度预算"
                : `预算 ${fmtMoney(budget)} · 已用 ${budOv.pct}%`
            }
            testid="rm-fin-ov-budget"
          />
        </div>
      </section>

      {/* 月度报告：账期 + 口径 + 2×3 六卡 */}
      <section className="rm-fin-sec" data-testid="rm-fin-report">
        <SecHead cn="月度报告" en="MONTHLY REPORT" />
        <div className="rm-fin-ctl">
          <label className="rm-fin-ctlLabel">
            账期
            <select
              className="rm-input"
              data-testid="rm-fin-month"
              value={activeReportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
            >
              {reportMonths.map((mk) => (
                <option key={mk} value={mk}>
                  {finMonthLabel(mk)}
                </option>
              ))}
            </select>
          </label>
          <span className="rm-fin-ctlLabel">
            统计口径
            <span className="rm-fin-pickRow">
              <button
                type="button"
                data-testid="rm-fin-scope-all"
                className={`rm-fin-pickbtn${scope === "all" ? " on" : ""}`}
                onClick={() => setScope("all")}
              >
                全部资金流出
              </button>
              <button
                type="button"
                data-testid="rm-fin-scope-consume"
                className={`rm-fin-pickbtn${scope === "consume" ? " on" : ""}`}
                onClick={() => setScope("consume")}
              >
                仅消费
              </button>
            </span>
          </span>
        </div>
        <div className="rm-fin-note">
          「仅消费」排除分类含「还款」「转账」的流出；净现金流随口径计算，概览与本报告共用同一口径。
        </div>
        <div className="rm-fin-grid">
          <FinCard
            k={`净现金流 · ${finMonthLabel(activeReportMonth)}`}
            v={fmtMoney(rp.net)}
            s={`收入 ${fmtMoney(rp.income)} · 流出 ${fmtMoney(rp.outflow)}`}
            tone={rp.net < 0 ? "neg" : rp.net > 0 ? "pos" : undefined}
            testid="rm-fin-rp-net"
          />
          <FinCard
            k="本月支出"
            v={fmtMoney(rp.outflow)}
            s={`共 ${rp.expenseCount} 条支出明细（当前口径）`}
            testid="rm-fin-rp-expense"
          />
          <FinCard
            k="预算剩余"
            v={budget === null ? "未设置" : fmtMoney(budRp.remaining ?? 0)}
            s={
              budget === null
                ? "在右栏预算卡里设置月度预算。"
                : `预算 ${fmtMoney(budget)} · 已用 ${budRp.pct}%`
            }
            testid="rm-fin-rp-budget"
          />
          <FinCard
            k="偿还负债"
            v={fmtMoney(rp.repay)}
            s="来自分类为「还款」的支出 · 本金/利息/手续费未拆分"
            testid="rm-fin-rp-repay"
          />
          <FinCard
            k="追踪资产"
            v={`${assets.length} 项`}
            s={`持仓成本合计 ${fmtMoney(asset.cost)} · 手动维护，不接行情`}
            testid="rm-fin-rp-assets"
          />
          <FinCard
            k="本月关键变化"
            v={change}
            s="规则生成：本月支出与上月同口径对比"
            testid="rm-fin-rp-change"
            small
          />
        </div>
      </section>

      {/* 分类小计：按账期分组，out 降序（口径不过滤，与第一主题一致） */}
      <section className="rm-fin-sec" data-testid="rm-fin-cats">
        <SecHead cn="分类小计" en="BY CATEGORY" />
        {byCategory.length === 0 ? (
          <div className="rm-empty">
            {finMonthLabel(activeReportMonth)} 还没有流水
          </div>
        ) : (
          byCategory.map((c) => (
            <div
              className="rm-fin-cat"
              key={c.category}
              data-testid={`rm-fin-cat-${c.category}`}
            >
              <span className="rm-fin-catName">{c.category}</span>
              <span className="rm-fin-catbar">
                <i
                  style={{
                    width: `${catTotalOut > 0 ? Math.round((c.out / catTotalOut) * 100) : 0}%`,
                  }}
                />
              </span>
              <span className="rm-fin-catAmt">
                {c.out > 0 ? `支出 ${fmtMoney(c.out)}` : ""}
                {c.out > 0 && c.inc > 0 ? " · " : ""}
                {c.inc > 0 ? `收入 ${fmtMoney(c.inc)}` : ""} · {c.n} 笔
              </span>
            </div>
          ))
        )}
      </section>

      {/* 负债台账：合计 / 最低还款 / 清单 / 行内新增改删 */}
      <section className="rm-fin-sec" data-testid="rm-fin-liabs">
        <SecHead
          cn="负债台账"
          en="LIABILITIES"
          action={
            <button
              type="button"
              className="rm-formBtn"
              data-testid="rm-fin-liab-add"
              onClick={() => {
                if (editingLiabId) resetLiabForm();
                setLiabFormOpen((o) => !o);
              }}
            >
              {liabFormOpen ? "− 收起" : "+ 新增负债"}
            </button>
          }
        />
        <div
          className="rm-fin-sum"
          data-testid="rm-fin-liab-summary"
          data-total={liab.total}
          data-min={liab.min}
          data-count={liabilities.length}
        >
          总负债 {fmtMoney(liab.total)} · 月最低还款合计 {fmtMoney(liab.min)} ·{" "}
          {liabilities.length} 笔
        </div>
        {advice ? (
          <div className="rm-fin-note">
            优先偿还建议（规则 · 按利率优先）：先还「{advice.name}」：年化利率{" "}
            {advice.annualRate}% 为当前最高，剩余 {fmtMoney(advice.remaining)}，
            优先偿还能减少利息支出。
          </div>
        ) : liabilities.length > 0 ? (
          <div className="rm-fin-note">
            已记录的负债暂未填写年化利率，补上利率后这里会按从高到低给出优先顺序。
          </div>
        ) : null}
        {liabFormOpen ? (
          <form className="rm-fin-form" onSubmit={submitLiab} noValidate>
            <div className="rm-fin-formgrid liab">{liabFormFields}</div>
            {liabErr ? <div className="rm-err">{liabErr}</div> : null}
            <div className="rm-formFoot">
              <span className="rm-formHint">
                必填：名称 / 总额 · 剩余留空 = 取总额
              </span>
              <span className="rm-formBtns">
                <button
                  type="button"
                  className="rm-formBtn"
                  onClick={() => {
                    setLiabFormOpen(false);
                    resetLiabForm();
                  }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="rm-formBtn rm-formBtnPrimary"
                  data-testid="rm-fin-liab-save"
                >
                  {editingLiabId ? "保存修改" : "新增负债"}
                </button>
              </span>
            </div>
          </form>
        ) : null}
        {liabilities.length === 0 ? (
          <div className="rm-empty">
            暂无负债记录 · 点「+ 新增负债」添加一笔
          </div>
        ) : (
          liabilities.map((l) => (
            <div
              className="rm-fin-row"
              key={l.id}
              data-testid={`rm-fin-liab-${l.id}`}
            >
              <span className="rm-fin-rowMain">
                <span className="rm-fin-rowTitle">{l.name}</span>
                <span className="rm-fin-rowSub">
                  剩余 {fmtMoney(l.remaining)} / 总额 {fmtMoney(l.total)}
                  {typeof l.annualRate === "number"
                    ? ` · 年化 ${l.annualRate}%`
                    : ""}
                  {typeof l.minPayment === "number"
                    ? ` · 月最低还款 ${fmtMoney(l.minPayment)}`
                    : ""}
                  {l.note ? ` · ${l.note}` : ""}
                </span>
              </span>
              <span className="rm-fin-rowBtns">
                <button
                  type="button"
                  className="rm-fin-miniBtn"
                  data-testid={`rm-fin-liab-edit-${l.id}`}
                  onClick={() => {
                    setEditingLiabId(l.id);
                    setLiabForm({
                      name: l.name,
                      total: String(l.total),
                      remaining: String(l.remaining),
                      rate:
                        typeof l.annualRate === "number"
                          ? String(l.annualRate)
                          : "",
                      min:
                        typeof l.minPayment === "number"
                          ? String(l.minPayment)
                          : "",
                      note: l.note ?? "",
                    });
                    setLiabErr("");
                    setLiabFormOpen(true);
                  }}
                >
                  编辑
                </button>
                <ConfirmDeleteBtn
                  testid={`rm-fin-liab-del-${l.id}`}
                  onConfirm={() => deleteLiab(l.id, l.name)}
                />
              </span>
            </div>
          ))
        )}
      </section>

      {/* 资产台账：成本合计 / 清单 / 行内新增改删 */}
      <section className="rm-fin-sec" data-testid="rm-fin-assets">
        <SecHead
          cn="资产台账"
          en="ASSETS"
          action={
            <button
              type="button"
              className="rm-formBtn"
              data-testid="rm-fin-asset-add"
              onClick={() => {
                if (editingAssetId) resetAssetForm();
                setAssetFormOpen((o) => !o);
              }}
            >
              {assetFormOpen ? "− 收起" : "+ 新增资产"}
            </button>
          }
        />
        <div
          className="rm-fin-sum"
          data-testid="rm-fin-asset-summary"
          data-cost={asset.cost}
          data-value={asset.value === null ? "none" : asset.value}
          data-count={assets.length}
        >
          成本合计 {fmtMoney(asset.cost)}
          {asset.value !== null ? ` · 估值合计 ${fmtMoney(asset.value)}` : ""} ·{" "}
          {assets.length} 项
        </div>
        {assetFormOpen ? (
          <form className="rm-fin-form" onSubmit={submitAsset} noValidate>
            <div className="rm-fin-formgrid asset">{assetFormFields}</div>
            {assetErr ? <div className="rm-err">{assetErr}</div> : null}
            <div className="rm-formFoot">
              <span className="rm-formHint">
                必填：名称 / 类型 / 成本 · 估值留空则不计入估值合计
              </span>
              <span className="rm-formBtns">
                <button
                  type="button"
                  className="rm-formBtn"
                  onClick={() => {
                    setAssetFormOpen(false);
                    resetAssetForm();
                  }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="rm-formBtn rm-formBtnPrimary"
                  data-testid="rm-fin-asset-save"
                >
                  {editingAssetId ? "保存修改" : "新增资产"}
                </button>
              </span>
            </div>
          </form>
        ) : null}
        {assets.length === 0 ? (
          <div className="rm-empty">
            暂无资产记录 · 点「+ 新增资产」添加一笔
          </div>
        ) : (
          assets.map((a) => (
            <div
              className="rm-fin-row"
              key={a.id}
              data-testid={`rm-fin-asset-${a.id}`}
            >
              <span className="rm-fin-rowMain">
                <span className="rm-fin-rowTitle">
                  {a.name}
                  <span className="rm-fin-chip">{a.type}</span>
                </span>
                <span className="rm-fin-rowSub">
                  成本 {fmtMoney(a.cost)}
                  {typeof a.value === "number"
                    ? ` · 估值 ${fmtMoney(a.value)}`
                    : " · 未填估值"}
                </span>
              </span>
              <span className="rm-fin-rowBtns">
                <button
                  type="button"
                  className="rm-fin-miniBtn"
                  data-testid={`rm-fin-asset-edit-${a.id}`}
                  onClick={() => {
                    setEditingAssetId(a.id);
                    setAssetForm({
                      name: a.name,
                      type: a.type,
                      cost: String(a.cost),
                      value:
                        typeof a.value === "number" ? String(a.value) : "",
                    });
                    setAssetErr("");
                    setAssetFormOpen(true);
                  }}
                >
                  编辑
                </button>
                <ConfirmDeleteBtn
                  testid={`rm-fin-asset-del-${a.id}`}
                  onConfirm={() => deleteAsset(a.id, a.name)}
                />
              </span>
            </div>
          ))
        )}
      </section>

      {/* 订阅台账：只做展示（清单 + 月度成本 + 在用项数 + 近 7 天到期） */}
      <section className="rm-fin-sec" data-testid="rm-fin-subs">
        <SecHead cn="订阅台账" en="SUBSCRIPTIONS" />
        <div
          className="rm-fin-sum"
          data-testid="rm-fin-sub-summary"
          data-count={subSum.activeCount}
          data-monthly={subSum.monthly}
          data-annual={subSum.annual}
        >
          在用订阅 {subSum.activeCount} 项 · 折合每月 {fmtMoney(subSum.monthly)} ·
          折合每年 {fmtMoney(subSum.annual)}
        </div>
        {subDueSoon.length > 0 ? (
          <div className="rm-fin-note" data-testid="rm-fin-sub-duesoon">
            近 7 天到期：
            {subDueSoon.map(({ sub: s, daysLeft }) => (
              <span key={s.id}>
                「{s.name}」{daysLeftLabel(daysLeft)}；
              </span>
            ))}
          </div>
        ) : (
          <div className="rm-fin-note">近 7 天到期：暂无</div>
        )}
        {subs.length === 0 ? (
          <div className="rm-empty">
            暂无活跃订阅
          </div>
        ) : (
          subs.map((s) => (
            <div
              className="rm-fin-row"
              key={s.id}
              data-testid={`rm-fin-sub-${s.id}`}
            >
              <span className="rm-fin-rowMain">
                <span className="rm-fin-rowTitle">
                  {s.name}
                  {!s.active ? (
                    <span className="rm-fin-chip">已停用</span>
                  ) : null}
                </span>
                <span className="rm-fin-rowSub">
                  {SUB_CYCLE_LABEL[s.cycle]} {fmtMoney(s.amount)} · 下次到期{" "}
                  {s.nextDue}
                  {s.note ? ` · ${s.note}` : ""}
                </span>
              </span>
            </div>
          ))
        )}
      </section>
    </RingModuleShell>
  );
}
