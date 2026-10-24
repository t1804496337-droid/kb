"use client";

/** 第二主题 · 作品库：作品原生 CRUD + 待办票 + 多平台同步 + 右栏。
 * 只写既有键 studio_works_items_v1 与 studio_works_channels_intent_v1；
 * 同步缓存 studio_works_sync_v1 只读呈现；不发总线。
 * 作品表单平台词表与挂载侧 WorksBody 表单一致（SYNC_PLATFORMS），
 * 状态筹颜色与未同步筹规则与挂载侧同口径。 */

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import RingModuleShell from "./ring-module-shell";

const WORKS_KEY = "studio_works_items_v1";
const INTENT_KEY = "studio_works_channels_intent_v1";
const SYNC_CACHE_KEY = "studio_works_sync_v1";
const CAL_KEY = "studio_calendar_items_v1";

type WorkItem = {
  id: string;
  title: string;
  platform: string;
  status: string;
  note?: string;
  url?: string;
};
type CalItem = { id: string; date: string; title: string; note?: string; done?: boolean };
type SyncedWork = { platform: string; id: string; title: string; published_at: string };

/* 与挂载侧 WORK_SEED_ITEMS 逐字同源：键未落盘时才播种落盘。 */
const WORK_SEED_ITEMS: WorkItem[] = [
  {
    id: "yt-ep01",
    title: "YouTube EP001 · Latent Space 首片",
    platform: "youtube",
    status: "待公开",
    note: "2026-10-18 上传 · 私享状态 · 待改公开（手机端 YouTube Studio 操作）",
    url: "https://www.youtube.com/watch?v=nmMQWsG5w3k",
  },
  {
    id: "sph-ep01",
    title: "视频号 ep01",
    platform: "channels",
    status: "待发布",
    note: "配音已定稿（Fish Audio 影视解说男声 · 2026-10-19）· 成片槽位 · 待本人点发",
  },
];

/* 与挂载侧 SYNC_PLATFORMS 逐字同源：平台行与同步条件。 */
const SYNC_PLATFORMS: { name: string; slug: string; cond: string }[] = [
  { name: "抖音", slug: "douyin", cond: "本地抓取包回传 · MediaCrawler 在本人电脑跑，JSON 回传后接入" },
  { name: "Bilibili · B站", slug: "bilibili", cond: "接口直连 · 需扫码登录" },
  { name: "YouTube", slug: "youtube", cond: "官方 API · 待申请 key" },
  { name: "视频号", slug: "channels", cond: "无公开同步通道 · 手动发布" },
  { name: "X", slug: "x", cond: "未接入" },
  { name: "TikTok", slug: "tiktok", cond: "未接入" },
];
const WORK_STATUS_PRESETS = ["待公开", "待发布", "已发布", "已同步", "制作中"];

const WORK_PLATFORM_TAGS: Record<string, string> = {
  youtube: "YT",
  bilibili: "BILI",
  douyin: "DY",
  channels: "SPH",
  x: "X",
  tiktok: "TT",
};
const workPlatformTag = (p: string) => WORK_PLATFORM_TAGS[p] ?? p.toUpperCase();
const workStatusChip = (status: string): string =>
  status === "已发布" || status === "已同步"
    ? "rm-chipGrn"
    : status === "待公开" || status === "待发布"
      ? "rm-chipPink"
      : status === "制作中"
        ? "rm-chipYel"
        : "rm-chipDim";

const okWork = (w: unknown): w is WorkItem => {
  if (!w || typeof w !== "object") return false;
  const o = w as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.platform === "string" &&
    typeof o.status === "string"
  );
};

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
function readCalItems(): CalItem[] {
  try {
    const raw = window.localStorage.getItem(CAL_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return (v as CalItem[]).filter(
      (i) => i && typeof i.date === "string" && typeof i.title === "string",
    );
  } catch {
    return [];
  }
}
function readIntent(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(INTENT_KEY);
    if (!raw) return {};
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Record<string, boolean> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (typeof x === "boolean") out[k] = x;
    }
    return out;
  } catch {
    return {};
  }
}
function readSyncCache(): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(SYNC_CACHE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const p = (v as Record<string, unknown>).platforms;
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    return p as Record<string, unknown>;
  } catch {
    return null;
  }
}

/* 待办票口径与挂载侧 derivePendingTickets 逐字一致：作品待发布/
 * 待公开成票 + 日历未完成事项成票；作品键未落盘时按种子计。 */
type Ticket = { id: string; title: string; detail: string; owner: string };
function deriveTickets(works: WorkItem[] | null, cal: CalItem[]): Ticket[] {
  const wEff = works ?? WORK_SEED_ITEMS;
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
      id: `tk-c-${i.id}`,
      title: i.title,
      detail: [i.date, i.note].filter(Boolean).join(" · "),
      owner: "日历",
    }));
  return [...fromWorks, ...fromCal];
}

export default function RingWorks() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [calItems, setCalItems] = useState<CalItem[]>([]);
  const [intent, setIntent] = useState<Record<string, boolean>>({});
  const [synced, setSynced] = useState<SyncedWork[] | null>(null);
  const [syncCache, setSyncCache] = useState<Record<string, unknown> | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [fTitle, setFTitle] = useState("");
  const [fPlatform, setFPlatform] = useState("youtube");
  const [fStatus, setFStatus] = useState("待发布");
  const [fStatusCustom, setFStatusCustom] = useState("");
  const [fNote, setFNote] = useState("");
  const [fUrl, setFUrl] = useState("");
  const [fErr, setFErr] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [eTitle, setETitle] = useState("");
  const [ePlatform, setEPlatform] = useState("youtube");
  const [eStatus, setEStatus] = useState("待发布");
  const [eStatusCustom, setEStatusCustom] = useState("");
  const [eNote, setENote] = useState("");
  const [eUrl, setEUrl] = useState("");
  const [eErr, setEErr] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [delArm, setDelArm] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const cur = readWorks();
    if (cur === null) {
      try {
        window.localStorage.setItem(WORKS_KEY, JSON.stringify(WORK_SEED_ITEMS));
        setItems(WORK_SEED_ITEMS);
        setSeeded(true);
      } catch {
        setItems(WORK_SEED_ITEMS);
      }
    } else {
      setItems(cur);
    }
    setCalItems(readCalItems());
    setIntent(readIntent());
    setSyncCache(readSyncCache());
    let live = true;
    fetch("/works-sync.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { platforms?: Record<string, SyncedWork[]> } | null) => {
        if (!live || !j || typeof j.platforms !== "object" || !j.platforms) return;
        setSynced(Object.values(j.platforms).flat());
      })
      .catch(() => {
        /* 未投递 → 未接入 */
      });
    setLoaded(true);
    return () => {
      live = false;
    };
  }, []);

  /* 落盘纪律：写盘成功才更新状态；不发总线。 */
  const commit = (next: WorkItem[]): boolean => {
    try {
      window.localStorage.setItem(WORKS_KEY, JSON.stringify(next));
    } catch {
      return false;
    }
    setItems(next);
    setStatus({ text: "已保存", ok: true });
    return true;
  };

  const validate = (title: string, note: string, url: string): string => {
    const t = title.trim();
    if (!t) return "先填作品标题";
    if (t.length > 80) return "标题最多 80 字";
    if (note.trim().length > 200) return "备注最多 200 字";
    const u = url.trim();
    if (u && !/^https?:\/\//.test(u)) return "链接须为 http(s) 地址";
    return "";
  };
  const resolveStatus = (sel: string, custom: string): string =>
    sel === "__custom" ? custom.trim() : sel;

  const addItem = (e: FormEvent) => {
    e.preventDefault();
    const err = validate(fTitle, fNote, fUrl);
    if (err) {
      setFErr(err);
      return;
    }
    const st = resolveStatus(fStatus, fStatusCustom);
    if (!st) {
      setFErr("先填作品状态");
      return;
    }
    const item: WorkItem = {
      id: `work-${Date.now()}`,
      title: fTitle.trim(),
      platform: fPlatform,
      status: st,
    };
    const note = fNote.trim();
    if (note) item.note = note;
    const url = fUrl.trim();
    if (url) item.url = url;
    if (commit([...items, item])) {
      setFTitle("");
      setFNote("");
      setFUrl("");
      setFStatusCustom("");
      setFStatus("待发布");
      setFPlatform("youtube");
      setFErr("");
      setFormOpen(false);
      setSelectedId(item.id);
    }
  };

  const startEdit = (w: WorkItem) => {
    setEditId(w.id);
    setETitle(w.title);
    setEPlatform(w.platform);
    if (WORK_STATUS_PRESETS.includes(w.status)) {
      setEStatus(w.status);
      setEStatusCustom("");
    } else {
      setEStatus("__custom");
      setEStatusCustom(w.status);
    }
    setENote(w.note ?? "");
    setEUrl(w.url ?? "");
    setEErr("");
  };
  const saveEdit = () => {
    if (!editId) return;
    const err = validate(eTitle, eNote, eUrl);
    if (err) {
      setEErr(err);
      return;
    }
    const st = resolveStatus(eStatus, eStatusCustom);
    if (!st) {
      setEErr("先填作品状态");
      return;
    }
    const next = items.map((w) => {
      if (w.id !== editId) return w;
      const copy: WorkItem = {
        ...w,
        title: eTitle.trim(),
        platform: ePlatform,
        status: st,
      };
      const note = eNote.trim();
      if (note) copy.note = note;
      else delete copy.note;
      const url = eUrl.trim();
      if (url) copy.url = url;
      else delete copy.url;
      return copy;
    });
    if (commit(next)) setEditId(null);
  };
  const delItem = (w: WorkItem) => {
    if (editId === w.id) setEditId(null);
    if (selectedId === w.id) setSelectedId(null);
    setDelArm(null);
    /* 删作品不连带删视频号意向记录（挂载侧同口径）。 */
    commit(items.filter((x) => x.id !== w.id));
  };
  const toggleIntent = (workId: string) => {
    const next = { ...intent, [workId]: !intent[workId] };
    try {
      window.localStorage.setItem(INTENT_KEY, JSON.stringify(next));
    } catch {
      return;
    }
    setIntent(next);
  };

  const tickets = loaded ? deriveTickets(items, calItems) : [];
  const pendingN = items.filter(
    (w) => w.status === "待发布" || w.status === "待公开",
  ).length;
  const intentN = items.filter((w) => intent[w.id]).length;
  const selected = items.find((w) => w.id === selectedId) ?? items[0] ?? null;

  const editForm = (
    title: string,
    setTitle: (v: string) => void,
    platform: string,
    setPlatform: (v: string) => void,
    st: string,
    setSt: (v: string) => void,
    stCustom: string,
    setStCustom: (v: string) => void,
    note: string,
    setNote: (v: string) => void,
    url: string,
    setUrl: (v: string) => void,
    err: string,
    onSave: () => void,
    onCancel: () => void,
    testPrefix: string,
  ) => (
    <div onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        <div className="rm-field" style={{ flex: 2 }}>
          <label>标题 *</label>
          <input
            className={`rm-input${err ? " err" : ""}`}
            data-testid={`${testPrefix}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="作品标题（必填）"
          />
        </div>
        <div className="rm-field" style={{ flex: 1 }}>
          <label>平台 *</label>
          <select
            className="rm-input"
            data-testid={`${testPrefix}-platform`}
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            {SYNC_PLATFORMS.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
            {SYNC_PLATFORMS.some((p) => p.slug === platform) ? null : (
              <option value={platform}>{platform}</option>
            )}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        <div className="rm-field" style={{ flex: 1 }}>
          <label>状态 *</label>
          <select
            className="rm-input"
            data-testid={`${testPrefix}-status`}
            value={st}
            onChange={(e) => setSt(e.target.value)}
          >
            {WORK_STATUS_PRESETS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="__custom">自定义…</option>
          </select>
        </div>
        {st === "__custom" ? (
          <div className="rm-field" style={{ flex: 1 }}>
            <label>自定义状态 *</label>
            <input
              className="rm-input"
              data-testid={`${testPrefix}-status-custom`}
              value={stCustom}
              onChange={(e) => setStCustom(e.target.value)}
              placeholder="自定义状态（必填）"
            />
          </div>
        ) : null}
        <div className="rm-field" style={{ flex: 1 }}>
          <label>链接</label>
          <input
            className="rm-input"
            data-testid={`${testPrefix}-url`}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http(s) 地址，可空"
          />
        </div>
      </div>
      <div className="rm-field" style={{ marginBottom: 6 }}>
        <label>备注</label>
        <input
          className="rm-input"
          data-testid={`${testPrefix}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="≤200 字，可空"
        />
      </div>
      {err ? (
        <div className="rm-err" style={{ marginBottom: 6 }}>
          {err}
        </div>
      ) : null}
      <div className="rm-formBtns">
        <button
          type="button"
          className="rm-formBtn rm-formBtnPrimary"
          data-testid={`${testPrefix}-save`}
          onClick={onSave}
        >
          保存
        </button>
        <button type="button" className="rm-formBtn" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );

  const cardBody = (w: WorkItem) => (
    <div>
      <div className="rm-worksCardTitle">{w.title}</div>
      {w.note ? <div className="rm-worksCardNote">{w.note}</div> : null}
      {w.url ? (
        <a
          className="rm-worksLink"
          href={w.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {w.url.replace(/^https?:\/\//, "")} ↗
        </a>
      ) : null}
      <div className="rm-worksChips" onClick={(e) => e.stopPropagation()}>
        <span className="rm-chip rm-chipCyan">[{workPlatformTag(w.platform)}]</span>
        <span className={`rm-chip ${workStatusChip(w.status)}`}>{w.status}</span>
        {w.status !== "已同步" ? (
          <span className="rm-chip rm-chipDim">未同步</span>
        ) : null}
        {intent[w.id] ? (
          <span className="rm-chip rm-chipPink">视频号意向</span>
        ) : null}
      </div>
      <div
        style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={`rm-miniBtn${intent[w.id] ? " rm-miniBtnOn" : ""}`}
          data-testid={`rm-works-intent-${w.id}`}
          aria-pressed={!!intent[w.id]}
          onClick={() => toggleIntent(w.id)}
        >
          {intent[w.id] ? "视频号意向 · 已标记" : "标为视频号意向"}
        </button>
        <button type="button" className="rm-miniBtn" onClick={() => startEdit(w)}>
          编辑
        </button>
        <button
          type="button"
          className={`rm-miniBtn${delArm === w.id ? " rm-miniBtnDanger" : ""}`}
          onClick={() => {
            if (delArm === w.id) delItem(w);
            else setDelArm(w.id);
          }}
        >
          {delArm === w.id ? "确认删除？" : "删除"}
        </button>
      </div>
    </div>
  );

  return (
    <RingModuleShell
      active="works"
      cn="作品库"
      en="WORKS"
      src="studio_works_items_v1 · 作品条数"
      count={loaded ? items.length : null}
      note={seeded ? "键未落盘 · 已按两件真实作品播种" : undefined}
      status={status?.text}
      statusOk={status?.ok}
      detail={
        <div>
          <div className="rm-detailHead">选中作品 · DETAIL</div>
          {selected ? (
            <div>
              <div className="rm-detailTitle">{selected.title}</div>
              <div className="rm-row">
                <div className="rm-rowMain">
                  <div className="rm-rowSub">平台</div>
                  <div className="rm-rowT">
                    {SYNC_PLATFORMS.find((p) => p.slug === selected.platform)?.name ??
                      selected.platform}
                  </div>
                </div>
              </div>
              <div className="rm-row">
                <div className="rm-rowMain">
                  <div className="rm-rowSub">状态</div>
                  <div className="rm-rowT">{selected.status}</div>
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
                  <div className="rm-rowSub">链接</div>
                  <div className="rm-rowT">{selected.url ?? "—"}</div>
                </div>
              </div>
              <div className="rm-row">
                <div className="rm-rowMain">
                  <div className="rm-rowSub">ID</div>
                  <div className="rm-rowT">{selected.id}</div>
                </div>
              </div>
              <div className="rm-row">
                <div className="rm-rowMain">
                  <div className="rm-rowSub">视频号意向</div>
                  <div className="rm-rowT">{intent[selected.id] ? "已标记" : "未标记"}</div>
                </div>
              </div>
              <div className="rm-formBtns" style={{ marginTop: 12 }}>
                <button type="button" className="rm-formBtn" onClick={() => startEdit(selected)}>
                  编辑
                </button>
                <button
                  type="button"
                  className={`rm-formBtn${delArm === selected.id ? " rm-miniBtnDanger" : ""}`}
                  onClick={() => {
                    if (delArm === selected.id) delItem(selected);
                    else setDelArm(selected.id);
                  }}
                >
                  {delArm === selected.id ? "确认删除？" : "删除"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rm-empty">暂无选中作品</div>
          )}
          <div className="rm-sec" style={{ marginTop: 26 }}>
            <div className="rm-secHead">
              <span className="rm-secCn">统计</span>
              <span className="rm-secEn">STATS</span>
            </div>
            <div className="rm-statLine">
              <span>
                共 <b>{items.length}</b> 件
              </span>
              <span>
                待发 <b>{pendingN}</b>
              </span>
              <span>
                视频号意向 <b>{intentN}</b>
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
          data-testid="rm-works-add"
          onClick={() => setFormOpen(true)}
        >
          + 新增作品 · NEW WORK
        </button>
      ) : (
        <form className="rm-form" onSubmit={addItem}>
          {editForm(
            fTitle,
            setFTitle,
            fPlatform,
            setFPlatform,
            fStatus,
            setFStatus,
            fStatusCustom,
            setFStatusCustom,
            fNote,
            setFNote,
            fUrl,
            setFUrl,
            fErr,
            () => addItem({ preventDefault: () => {} } as FormEvent),
            () => setFormOpen(false),
            "rm-works-f",
          )}
          <div className="rm-formFoot">
            <span className="rm-formHint">标题 1–80 字 · 备注 ≤200 字 · 链接可空</span>
          </div>
        </form>
      )}

      <div className="rm-sec">
        <div className="rm-secHead">
          <span className="rm-secCn">作品卡列</span>
          <span className="rm-secEn">WORKS</span>
          <span className="rm-secNote">共 {items.length} 件</span>
        </div>
        {items.length === 0 ? (
          <div className="rm-empty">
            暂无本地作品 · 点「+ 新增作品」登记第一件 · 平台同步接入后同步条目在下方分区呈现
          </div>
        ) : (
          items.map((w) => (
            <div
              key={w.id}
              className={`rm-worksCard${selected?.id === w.id ? " rm-worksCardActive" : ""}`}
              data-testid={`rm-works-card-${w.id}`}
              onClick={() => setSelectedId(w.id)}
            >
              {editId === w.id
                ? editForm(
                    eTitle,
                    setETitle,
                    ePlatform,
                    setEPlatform,
                    eStatus,
                    setEStatus,
                    eStatusCustom,
                    setEStatusCustom,
                    eNote,
                    setENote,
                    eUrl,
                    setEUrl,
                    eErr,
                    saveEdit,
                    () => setEditId(null),
                    "rm-works-e",
                  )
                : cardBody(w)}
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
          <div className="rm-empty">暂无待办票 · 作品待发与日历未完成事项都已清零</div>
        ) : (
          tickets.map((t) => (
            <div key={t.id} className="rm-row" data-testid={`rm-works-ticket-${t.id}`}>
              <div className="rm-rowMain">
                <div className="rm-rowT">{t.title}</div>
                {t.detail ? <div className="rm-rowSub">{t.detail}</div> : null}
              </div>
              <span className={`rm-ticketOwner${t.owner === "作品库" ? " rm-ticketOwnerWorks" : ""}`}>
                {t.owner}
              </span>
              <span className="rm-chip rm-chipYel">待办</span>
            </div>
          ))
        )}
      </div>

      <div className="rm-sec">
        <div className="rm-secHead">
          <span className="rm-secCn">多平台同步</span>
          <span className="rm-secEn">PLATFORM SYNC</span>
          {syncCache ? (
            <span className="rm-secNote">
              本地同步缓存 {Object.keys(syncCache).length} 平台有记录
            </span>
          ) : null}
        </div>
        {synced && synced.length > 0
          ? synced.map((w) => (
              <div key={`${w.platform}:${w.id}`} className="rm-row">
                <div className="rm-rowMain">
                  <div className="rm-rowT">{w.title}</div>
                  <div className="rm-rowSub">
                    {w.platform} · {w.published_at}
                  </div>
                </div>
                <span className="rm-chip rm-chipCyan">[{workPlatformTag(w.platform)}]</span>
                <span className="rm-chip rm-chipGrn">已同步</span>
              </div>
            ))
          : null}
        {SYNC_PLATFORMS.map((p) => (
          <div key={p.slug} className="rm-row" data-testid={`rm-works-sync-${p.slug}`}>
            <div className="rm-rowMain">
              <div className="rm-rowT">{p.name}</div>
              <div className="rm-rowSub">同步条件：{p.cond}</div>
            </div>
            <span className="rm-chip rm-chipDim">未接入</span>
          </div>
        ))}
        <div className="rm-rowSub" style={{ marginTop: 8 }}>
          works-sync.json 尚未投递；接入进度见各平台行，接入后此处自动点亮。
        </div>
      </div>
    </RingModuleShell>
  );
}
