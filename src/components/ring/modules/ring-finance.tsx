"use client";

/** 第二主题 · 财务管理：账目列表 + 收支合计（自条目实算）+ 原生记账。
 * 写入复刻第一主题 addEntry 语义（hud-module-content.tsx:2265-2271）：
 * 同一键 studio_finance_entries_v1、同口径过滤、id = fin-${Date.now()}、
 * 落盘后 emit FINANCE_ADD_ENTRY；第一主题挂载读同键即同源，本页零跳转录入。 */

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import RingModuleShell from "./ring-module-shell";
import { DetailView, GroupList, findRow, firstRowId } from "./list-ui";
import { metaOf } from "./meta";
import { loadFinance } from "./data";
import type { ModData } from "./data";
import { emit } from "@/components/studio/bus";

const FIN_KEY = "studio_finance_entries_v1";

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

type FinEntryT = {
  id: string;
  date: string;
  kind: "income" | "expense";
  amount: number;
  category: string;
  note?: string;
  source?: string;
};

/* 与第一主题 FinanceBody 读取过滤逐字同口径（含日期正则校验）。 */
const okFinEntry = (e: unknown): e is FinEntryT => {
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

type FinData = ModData & { income: number; expense: number };
type FormErrors = {
  date?: string;
  amount?: string;
  category?: string;
  note?: string;
};

export default function RingFinance() {
  const meta = metaOf("finance");
  const [data, setData] = useState<FinData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(
    null,
  );

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

  useEffect(() => {
    let on = true;
    setFDate(finTodayStr());
    Promise.resolve()
      .then(() => loadFinance())
      .then((d) => {
        if (!on) return;
        setData(d);
        setLoaded(true);
        setSelectedId(firstRowId(d));
        setStatus({
          text: `FINANCE · ${d.total} 笔 · 已同步 ${hhmmNow()}`,
          ok: false,
        });
      });
    return () => {
      on = false;
    };
  }, []);

  if (!meta) return null;

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

    const rec: Omit<FinEntryT, "id" | "source"> = {
      date: fDate,
      kind: fKind,
      amount,
      category,
      ...(noteText ? { note: noteText } : {}),
    };
    let existing: FinEntryT[] = [];
    try {
      const raw = window.localStorage.getItem(FIN_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) existing = parsed.filter(okFinEntry);
    } catch {
      existing = [];
    }
    const entry: FinEntryT = { ...rec, id: `fin-${Date.now()}` };
    try {
      window.localStorage.setItem(
        FIN_KEY,
        JSON.stringify([...existing, entry]),
      );
    } catch {
      /* storage unavailable：与第一主题同纪律，仍走广播与本页刷新 */
    }
    emit("FINANCE_ADD_ENTRY", "finance", `${rec.category} ¥${rec.amount}`);

    const next = loadFinance();
    setData(next);
    setLoaded(true);
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

  const row = findRow(data, selectedId);
  const note = data
    ? `收入合计 ¥${data.income} · 支出合计 ¥${data.expense} · 结余 ¥${data.income - data.expense}（自条目实算）`
    : undefined;
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
      detail={<DetailView row={row} />}
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
    </RingModuleShell>
  );
}
