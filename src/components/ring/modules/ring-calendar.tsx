"use client";

/** 第二主题 · 日历表：月历网格 + 分组事项列表 + 待办票派生 + 原生 CRUD。
 * 只写既有键 studio_calendar_items_v1；不发总线，刷新靠 storage 与路由重挂载。
 * 月历口径与挂载侧完全一致：周一首日偏移、当月天数、今日高亮、日格 Map 聚合。 */

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import RingModuleShell from "./ring-module-shell";

const CAL_KEY = "studio_calendar_items_v1";
const WORKS_KEY = "studio_works_items_v1";

type CalItem = {
  id?: string;
  date: string;
  title: string;
  note?: string;
  done?: boolean;
};

type WorkItem = {
  id: string;
  title: string;
  platform: string;
  status: string;
  note?: string;
};

/* 挂载侧播种口径的镜像：作品键从未落盘时，待办票按这两条播种条目计票。 */
const WORKS_SEED: WorkItem[] = [
  {
    id: "yt-ep01",
    title: "YouTube EP001 · Latent Space 首片",
    platform: "youtube",
    status: "待公开",
    note: "2026-10-18 上传 · 私享状态 · 待改公开（手机端 YouTube Studio 操作）",
  },
  {
    id: "sph-ep01",
    title: "视频号 ep01",
    platform: "channels",
    status: "待发布",
    note: "配音已定稿（Fish Audio 影视解说男声 · 2026-10-19）· 成片槽位 · 待本人点发",
  },
];

type Ticket = { id: string; title: string; detail: string; owner: string };

const pad2 = (n: number) => String(n).padStart(2, "0");
const todayLocalStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const hhmmNow = (): string => {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const isDateStr = (s: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
};
const shiftISO = (iso: string, delta: number): string => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
};

/* 读取过滤与挂载侧快照过滤同口径：date/title 必备字符串，note/done 可选且须合类型。 */
const okCal = (x: unknown): x is CalItem => {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.date === "string" &&
    typeof o.title === "string" &&
    (o.note === undefined || typeof o.note === "string") &&
    (o.done === undefined || typeof o.done === "boolean")
  );
};
const okWork = (x: unknown): x is WorkItem => {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.platform === "string" &&
    typeof o.status === "string" &&
    (o.note === undefined || typeof o.note === "string")
  );
};

function readCalItems(): CalItem[] {
  try {
    const raw = window.localStorage.getItem(CAL_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter(okCal)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  } catch {
    return [];
  }
}

function readWorks(): WorkItem[] | null {
  try {
    const raw = window.localStorage.getItem(WORKS_KEY);
    if (raw === null) return null;
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter(okWork);
  } catch {
    return [];
  }
}

/* 待办票派生：作品待发（待发布/待公开）+ 日历未完成事项，各成一票。 */
function deriveTickets(works: WorkItem[] | null, cal: CalItem[]): Ticket[] {
  const wEff = works ?? WORKS_SEED;
  const fromWorks: Ticket[] = wEff
    .filter((w) => w.status === "待发布" || w.status === "待公开")
    .map((w) => ({
      id: `tk-w-${w.id}`,
      title: `${w.title} ${w.status}`,
      detail: w.note ?? "",
      owner: "作品库",
    }));
  const fromCal: Ticket[] = cal
    .filter((i) => !i.done)
    .map((i) => ({
      id: `tk-c-${i.id ?? `${i.date}:${i.title}`}`,
      title: i.title,
      detail: [i.date, i.note].filter(Boolean).join(" · "),
      owner: "日历",
    }));
  return [...fromWorks, ...fromCal];
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export default function RingCalendar() {
  const [items, setItems] = useState<CalItem[]>([]);
  const [works, setWorks] = useState<WorkItem[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [viewYear, setViewYear] = useState(0);
  const [viewMonth, setViewMonth] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [fTitle, setFTitle] = useState("");
  const [fDate, setFDate] = useState("");
  const [fNote, setFNote] = useState("");
  const [fErr, setFErr] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [eTitle, setETitle] = useState("");
  const [eDate, setEDate] = useState("");
  const [eNote, setENote] = useState("");
  const [eErr, setEErr] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /* 预渲染拦截 new Date()：今日字符串只在挂载 effect 内赋值，渲染侧用空串兜底。 */
  const [today, setToday] = useState("");
  const [delArm, setDelArm] = useState<string | null>(null);
  const [detailEditing, setDetailEditing] = useState(false);
  const [dTitle, setDTitle] = useState("");
  const [dDate, setDDate] = useState("");
  const [dNote, setDNote] = useState("");
  const [dErr, setDErr] = useState("");
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const today = todayLocalStr();
    const d = new Date();
    setItems(readCalItems());
    setWorks(readWorks());
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth() + 1);
    setFDate(today);
    setToday(today);
    setStatus({ text: `CALENDAR · 已同步 ${hhmmNow()}`, ok: false });
    setLoaded(true);
  }, []);

  const saveItems = (next: CalItem[]) => {
    try {
      window.localStorage.setItem(CAL_KEY, JSON.stringify(next));
    } catch {
      return;
    }
    setItems(next);
    setStatus({ text: "已保存", ok: true });
  };

  const validate = (title: string, date: string, note: string): string => {
    const t = title.trim();
    if (!t) return "先填事项标题";
    if (t.length > 80) return "标题最多 80 字";
    if (!isDateStr(date)) return "日期格式不对";
    if (note.trim().length > 100) return "备注最多 100 字";
    return "";
  };

  const addItem = (e: FormEvent) => {
    e.preventDefault();
    const err = validate(fTitle, fDate, fNote);
    if (err) {
      setFErr(err);
      return;
    }
    const item: CalItem = { id: `cal-${Date.now()}`, date: fDate, title: fTitle.trim() };
    const n = fNote.trim();
    if (n) item.note = n;
    saveItems([...items, item]);
    setFTitle("");
    setFNote("");
    setFErr("");
    setFormOpen(false);
    setSelectedId(item.id ?? null);
  };

  const startEdit = (it: CalItem) => {
    setEditId(it.id ?? `${it.date}:${it.title}`);
    setETitle(it.title);
    setEDate(it.date);
    setENote(it.note ?? "");
    setEErr("");
  };

  const saveEdit = (key: string, title: string, date: string, note: string): boolean => {
    const err = validate(title, date, note);
    if (err) {
      setEErr(err);
      setDErr(err);
      return false;
    }
    const next = items.map((x) => {
      const k = x.id ?? `${x.date}:${x.title}`;
      if (k !== key) return x;
      const copy: CalItem = { ...x, title: title.trim(), date };
      const n = note.trim();
      if (n) copy.note = n;
      else delete copy.note;
      return copy;
    });
    saveItems(next);
    setEditId(null);
    setDetailEditing(false);
    setEErr("");
    setDErr("");
    return true;
  };

  const deleteItem = (key: string) => {
    const next = items.filter((x) => (x.id ?? `${x.date}:${x.title}`) !== key);
    saveItems(next);
    if (selectedId === key) setSelectedId(null);
    setDelArm(null);
    setEditId(null);
    setDetailEditing(false);
  };

  const toggleDone = (key: string) => {
    saveItems(
      items.map((x) => {
        const k = x.id ?? `${x.date}:${x.title}`;
        return k === key ? { ...x, done: !x.done } : x;
      }),
    );
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth() + 1);
  };
  const backToThisMonth = () => {
    const n = new Date();
    setViewYear(n.getFullYear());
    setViewMonth(n.getMonth() + 1);
  };

  const firstDow = viewYear ? (new Date(viewYear, viewMonth - 1, 1).getDay() + 6) % 7 : 0;
  const daysInMonth = viewYear ? new Date(viewYear, viewMonth, 0).getDate() : 0;
  /* 今日高亮从 today 状态解析，不在渲染侧读当前时间。 */
  const todayHere =
    today && Number(today.slice(0, 4)) === viewYear && Number(today.slice(5, 7)) === viewMonth
      ? Number(today.slice(8, 10))
      : -1;
  const marked = new Map<string, CalItem[]>();
  for (const it of items) {
    const list = marked.get(it.date) ?? [];
    list.push(it);
    marked.set(it.date, list);
  }
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  const viewPrefix = `${viewYear}-${pad2(viewMonth)}`;
  const viewItems = items.filter((i) => i.date.startsWith(viewPrefix));
  const viewUndone = viewItems.filter((i) => !i.done).length;
  const tickets = deriveTickets(works, items);

  const curPrefix = today ? today.slice(0, 7) : "∅";
  const curItems = items.filter((i) => i.date.startsWith(curPrefix));
  const curDone = curItems.filter((i) => i.done).length;
  const curRate = curItems.length ? Math.round((curDone / curItems.length) * 100) : 0;
  const future7 = today
    ? items.filter((i) => !i.done && i.date > today && i.date <= shiftISO(today, 7)).length
    : 0;

  const groups = new Map<string, CalItem[]>();
  for (const it of sorted) {
    const arr = groups.get(it.date) ?? [];
    arr.push(it);
    groups.set(it.date, arr);
  }
  const selected =
    items.find((x) => (x.id ?? `${x.date}:${x.title}`) === selectedId) ?? sorted[0] ?? null;
  const selectedKey = selected ? (selected.id ?? `${selected.date}:${selected.title}`) : null;

  const startDetailEdit = () => {
    if (!selected) return;
    setDTitle(selected.title);
    setDDate(selected.date);
    setDNote(selected.note ?? "");
    setDErr("");
    setDetailEditing(true);
  };

  return (
    <RingModuleShell
      active="calendar"
      cn="日历表"
      en="CALENDAR"
      src="studio_calendar_items_v1 · 事项数 / 今日"
      count={loaded ? items.length : null}
      status={status?.text}
      statusOk={status?.ok}
      detail={
        <div>
          <div className="rm-detailHead">选中事项 · DETAIL</div>
          {selected && selectedKey ? (
            <div>
              <div className="rm-detailTitle">{selected.title}</div>
              {detailEditing ? (
                <div>
                  <div className="rm-field" style={{ marginBottom: 8 }}>
                    <label>标题</label>
                    <input
                      className="rm-input"
                      value={dTitle}
                      onChange={(e) => setDTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(selectedKey, dTitle, dDate, dNote);
                      }}
                    />
                  </div>
                  <div className="rm-field" style={{ marginBottom: 8 }}>
                    <label>日期</label>
                    <input
                      className="rm-input"
                      type="date"
                      value={dDate}
                      onChange={(e) => setDDate(e.target.value)}
                    />
                  </div>
                  <div className="rm-field" style={{ marginBottom: 8 }}>
                    <label>备注</label>
                    <input
                      className="rm-input"
                      value={dNote}
                      onChange={(e) => setDNote(e.target.value)}
                    />
                  </div>
                  {dErr ? <div className="rm-err" style={{ marginBottom: 8 }}>{dErr}</div> : null}
                  <div className="rm-formBtns">
                    <button
                      type="button"
                      className="rm-formBtn rm-formBtnPrimary"
                      onClick={() => saveEdit(selectedKey, dTitle, dDate, dNote)}
                    >
                      保存修改
                    </button>
                    <button
                      type="button"
                      className="rm-formBtn"
                      onClick={() => setDetailEditing(false)}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="rm-row">
                    <div className="rm-rowMain">
                      <div className="rm-rowSub">日期</div>
                      <div className="rm-rowT">{selected.date}</div>
                    </div>
                  </div>
                  <div className="rm-row">
                    <div className="rm-rowMain">
                      <div className="rm-rowSub">状态</div>
                      <div className="rm-rowT">{selected.done ? "已完成" : "待办"}</div>
                    </div>
                  </div>
                  <div className="rm-row">
                    <div className="rm-rowMain">
                      <div className="rm-rowSub">备注</div>
                      <div className="rm-rowT">{selected.note ?? "—"}</div>
                    </div>
                  </div>
                  <div className="rm-row">
                    <div className="rm-rowMain">
                      <div className="rm-rowSub">ID</div>
                      <div className="rm-rowT">{selectedKey}</div>
                    </div>
                  </div>
                  <div className="rm-formBtns" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="rm-formBtn"
                      onClick={() => toggleDone(selectedKey)}
                    >
                      {selected.done ? "标为待办" : "标为完成"}
                    </button>
                    <button type="button" className="rm-formBtn" onClick={startDetailEdit}>
                      编辑
                    </button>
                    <button
                      type="button"
                      className={`rm-formBtn${delArm === selectedKey ? " rm-miniBtnDanger" : ""}`}
                      onClick={() => {
                        if (delArm === selectedKey) deleteItem(selectedKey);
                        else setDelArm(selectedKey);
                      }}
                    >
                      {delArm === selectedKey ? "确认删除？" : "删除"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rm-empty">暂无选中事项</div>
          )}
          <div className="rm-sec" style={{ marginTop: 26 }}>
            <div className="rm-secHead">
              <span className="rm-secCn">本月统计</span>
              <span className="rm-secEn">THIS MONTH</span>
            </div>
            <div className="rm-statLine">
              <span>
                事项 <b>{curItems.length}</b>
              </span>
              <span>
                完成率 <b>{curRate}%</b>
              </span>
              <span>
                未来 7 天 <b>{future7} 条</b>
              </span>
            </div>
          </div>
        </div>
      }
    >
      {!formOpen ? (
        <button
          type="button"
          className="rm-formBtn rm-formToggle"
          onClick={() => setFormOpen(true)}
        >
          + 记事项 · NEW ITEM
        </button>
      ) : (
        <form className="rm-form" onSubmit={addItem}>
          <div className="rm-b2FormGrid">
            <div className="rm-field">
              <label>标题 *</label>
              <input
                className={`rm-input${fErr ? " err" : ""}`}
                type="text"
                value={fTitle}
                onChange={(e) => setFTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addItem(e as unknown as FormEvent);
                }}
                placeholder="新事项标题"
              />
            </div>
            <div className="rm-field">
              <label>日期 *</label>
              <input
                className="rm-input"
                type="date"
                value={fDate}
                onChange={(e) => setFDate(e.target.value)}
              />
            </div>
            <div className="rm-field">
              <label>备注</label>
              <input
                className="rm-input"
                type="text"
                value={fNote}
                onChange={(e) => setFNote(e.target.value)}
                placeholder="≤100 字，可空"
              />
            </div>
          </div>
          {fErr ? <div className="rm-err" style={{ marginTop: 8 }}>{fErr}</div> : null}
          <div className="rm-formFoot">
            <span className="rm-formHint">标题 1–80 字 · 日期默认今天 · 回车直接提交</span>
            <div className="rm-formBtns">
              <button type="submit" className="rm-formBtn rm-formBtnPrimary">
                加事项
              </button>
              <button type="button" className="rm-formBtn" onClick={() => setFormOpen(false)}>
                收起
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="rm-sec">
        <div className="rm-secHead">
          <span className="rm-secCn">月历</span>
          <span className="rm-secEn">MONTH GRID</span>
          <span className="rm-secNote">
            事项 {viewItems.length} · 未完成 {viewUndone} · 待办票 {tickets.length}
          </span>
        </div>
        <div className="rm-calHead" style={{ marginBottom: 10 }}>
          <button type="button" className="rm-miniBtn" onClick={() => shiftMonth(-1)}>
            ‹ 上月
          </button>
          <span className="rm-calTitle">
            {viewYear} 年 {pad2(viewMonth)} 月
          </span>
          <button type="button" className="rm-miniBtn" onClick={() => shiftMonth(1)}>
            下月 ›
          </button>
          <button type="button" className="rm-miniBtn" onClick={backToThisMonth}>
            回本月
          </button>
        </div>
        <div className="rm-calGrid">
          {WEEKDAYS.map((w) => (
            <div key={w} className="rm-calDow">
              {w}
            </div>
          ))}
          {Array.from({ length: firstDow }, (_, i) => (
            <div key={`b${i}`} className="rm-calCell rm-calCellBlank" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
            const ds = `${viewYear}-${pad2(viewMonth)}-${pad2(d)}`;
            const dayItems = marked.get(ds) ?? [];
            const has = dayItems.length > 0;
            const isToday = d === todayHere;
            return (
              <div
                key={d}
                className={`rm-calCell${has ? " rm-calCellHas" : ""}${isToday ? " rm-calCellToday" : ""}`}
                title={has ? dayItems.map((x) => x.title).join(" / ") : undefined}
                style={{ cursor: has ? "pointer" : "default" }}
                onClick={() => {
                  if (has) setSelectedId(dayItems[0].id ?? `${ds}:${dayItems[0].title}`);
                }}
              >
                <div className={`rm-calDay${isToday ? " rm-calDayToday" : ""}`}>{d}</div>
                {has ? <div className="rm-calCount">{dayItems.length} 条</div> : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rm-sec">
        <div className="rm-secHead">
          <span className="rm-secCn">事项列表</span>
          <span className="rm-secEn">ITEMS BY DATE</span>
          <span className="rm-secNote">共 {sorted.length} 条</span>
        </div>
        {sorted.length === 0 ? (
          <div className="rm-empty">暂无事项</div>
        ) : (
          [...groups.entries()].map(([date, rows]) => (
            <div key={date} style={{ marginBottom: 14 }}>
              <div className="rm-secNote" style={{ margin: "0 0 4px" }}>
                {date} · {rows.length} 条
              </div>
              {rows.map((it) => {
                const key = it.id ?? `${it.date}:${it.title}`;
                const editing = editId === key;
                return (
                  <div key={key} className="rm-row" onClick={() => setSelectedId(key)}>
                    <button
                      type="button"
                      className={`rm-miniBtn${it.done ? " rm-miniBtnOn" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDone(key);
                      }}
                      aria-label={it.done ? "标为待办" : "标为完成"}
                    >
                      {it.done ? "✓" : "○"}
                    </button>
                    <div className="rm-rowMain">
                      {editing ? (
                        <div>
                          <input
                            className="rm-input"
                            value={eTitle}
                            onChange={(e) => setETitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(key, eTitle, eDate, eNote);
                            }}
                            style={{ marginBottom: 6 }}
                          />
                          <input
                            className="rm-input"
                            type="date"
                            value={eDate}
                            onChange={(e) => setEDate(e.target.value)}
                            style={{ marginBottom: 6 }}
                          />
                          <input
                            className="rm-input"
                            value={eNote}
                            onChange={(e) => setENote(e.target.value)}
                            placeholder="备注"
                          />
                          {eErr ? <div className="rm-err" style={{ marginTop: 6 }}>{eErr}</div> : null}
                          <div className="rm-formBtns" style={{ marginTop: 8 }}>
                            <button
                              type="button"
                              className="rm-formBtn rm-formBtnPrimary"
                              onClick={() => saveEdit(key, eTitle, eDate, eNote)}
                            >
                              保存
                            </button>
                            <button
                              type="button"
                              className="rm-formBtn"
                              onClick={() => setEditId(null)}
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div
                            className="rm-rowT"
                            style={it.done ? { textDecoration: "line-through", opacity: 0.6 } : undefined}
                          >
                            {it.title}
                          </div>
                          {it.note ? <div className="rm-rowSub">{it.note}</div> : null}
                        </div>
                      )}
                    </div>
                    {!editing ? (
                      <div style={{ display: "flex", gap: 6, flex: "none" }}>
                        <button
                          type="button"
                          className="rm-miniBtn"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(it);
                          }}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className={`rm-miniBtn${delArm === key ? " rm-miniBtnDanger" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (delArm === key) deleteItem(key);
                            else setDelArm(key);
                          }}
                        >
                          {delArm === key ? "确认删除？" : "删除"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <div className="rm-sec">
        <div className="rm-secHead">
          <span className="rm-secCn">待办票</span>
          <span className="rm-secEn">PENDING TICKETS</span>
          <span className="rm-secNote">共 {tickets.length} 张</span>
        </div>
        {tickets.length === 0 ? (
          <div className="rm-empty">暂无待办票</div>
        ) : (
          tickets.map((t) => (
            <div key={t.id} className="rm-row">
              <span
                className={`rm-ticketOwner${t.owner === "作品库" ? " rm-ticketOwnerWorks" : ""}`}
              >
                {t.owner}
              </span>
              <div className="rm-rowMain">
                <div className="rm-rowT">{t.title}</div>
                {t.detail ? <div className="rm-rowSub">{t.detail}</div> : null}
              </div>
            </div>
          ))
        )}
      </div>
    </RingModuleShell>
  );
}
