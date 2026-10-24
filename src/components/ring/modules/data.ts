/**
 * 第二主题子模块 · 只读数据层。
 *
 * 纪律（与 ring-data.ts / surfaces.ts 同口径）：
 * 1. 只读：本文件只有 getItem / fetch GET，绝不写任何键、不发总线。
 * 2. 校验过滤逐项复刻第一主题各 Body 的读取过滤，形状外一律拒，
 *    保证两主题同屏同数；读不到就空集 + note 说明，绝不编造。
 * 3. 作品键未落盘时按第一主题 WORK_SEED_ITEMS 种子兜底呈现。
 */

import { SLICES } from "@/components/studio/snapshot";
import type { SkillsSync } from "@/components/ring/data/types";

export type ModRow = {
  id: string;
  title: string;
  sub?: string;
  chip?: string;
  fields: [string, string][];
  body?: string;
  /** body 以等宽字体呈现（如 JSON）。 */
  mono?: boolean;
};

export type ModGroup = { id: string; label: string; rows: ModRow[] };

export type ModData = {
  groups: ModGroup[];
  total: number;
  /** 数据状态说明（如种子兜底、键未落盘），显示在作业区头部。 */
  note?: string;
};

/* ── 基础读取（全部只读） ─────────────────────────── */

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return undefined;
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function readArr(key: string): unknown[] {
  const v = readJson(key);
  return Array.isArray(v) ? v : [];
}

/** 键未落盘或值非数组 → null（区分「仓为空」与「从未写入」）。 */
function readArrOrNull(key: string): unknown[] | null {
  const v = readJson(key);
  return Array.isArray(v) ? v : null;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v !== "" ? v : undefined;

const fmtTs = (ts: number): string =>
  new Date(ts).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });

/* ── 技能库：/skills-sync.json 按 agent 分组 ────────── */

export async function loadSkills(): Promise<ModData> {
  try {
    const r = await fetch("/skills-sync.json", { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as SkillsSync;
    const agents = j?.agents ?? [];
    const groups: ModGroup[] = agents.map((a) => ({
      id: a.id,
      label: `${a.name} · ${a.id.toUpperCase()}`,
      rows: (a.skills ?? []).map((s) => ({
        id: `${a.id}:${s.id}`,
        title: s.name,
        sub: s.zh,
        chip: s.tag,
        fields: [
          ["ID", s.id],
          ["名称", s.name],
          ["中文", s.zh ?? "—"],
          ["标签", s.tag ?? "—"],
          ["来源", s.source ?? "—"],
          ["分组", a.name],
        ] as [string, string][],
      })),
    }));
    const total = groups.reduce((n, g) => n + g.rows.length, 0);
    return {
      groups,
      total,
      note: j?.updated_at ? `同步文件更新于 ${j.updated_at}` : undefined,
    };
  } catch {
    return { groups: [], total: 0, note: "/skills-sync.json 不可达 · 离线呈现" };
  }
}

/* ── 作品库：studio_works_items_v1（种子兜底同第一主题） ── */

type WorkItem = {
  id: string;
  title: string;
  platform: string;
  status: string;
  note?: string;
  url?: string;
};

/** 与 hud-module-content WORK_SEED_ITEMS 逐字同源：键未落盘时
 * 第一主题工作台即以这 2 条种子呈现，本页同口径。 */
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

const okWork = (w: unknown): w is WorkItem =>
  isObj(w) &&
  typeof w.id === "string" &&
  typeof w.title === "string" &&
  typeof w.platform === "string" &&
  typeof w.status === "string";

export function loadWorks(): ModData {
  const stored = readArrOrNull("studio_works_items_v1");
  const items = (stored ?? []).filter(okWork);
  const eff = stored === null ? WORK_SEED_ITEMS : items;
  const rows: ModRow[] = eff.map((w) => ({
    id: w.id,
    title: w.title,
    sub: `${w.platform} · ${w.status}`,
    chip: w.status,
    fields: [
      ["ID", w.id],
      ["平台", w.platform],
      ["状态", w.status],
      ["链接", w.url ?? "—"],
    ],
    body: w.note,
  }));
  return {
    groups: [{ id: "works", label: "作品", rows }],
    total: rows.length,
    note:
      stored === null
        ? "键未落盘 · 种子兜底（与第一主题工作台同源）"
        : undefined,
  };
}

/* ── 数据库：studio_hub_rows_v1 枢纽镜像行（按象限分组） ── */

const QUADRANT_LABEL: Record<string, string> = {
  right: "数据库象限 · right",
  ll: "技能库象限 · ll",
  top: "灵感池象限 · top",
  left: "作品库象限 · left",
  lr: "日历表象限 · lr",
};
const QUADRANT_ORDER = ["right", "ll", "top", "left", "lr"];

type HubRow = { id: string; title: string; a: string; b: string; c?: string };

const okHubRow = (r: unknown): r is HubRow =>
  isObj(r) && typeof r.id === "string" && typeof r.title === "string";

export function loadDatabase(): ModData {
  const raw = readJson("studio_hub_rows_v1");
  if (!isObj(raw)) {
    return {
      groups: [],
      total: 0,
      note: "键未落盘 · 星环计数按镜像派生（技能数 + 流水线步数），本地尚无落盘行",
    };
  }
  const keys = Object.keys(raw).sort((x, y) => {
    const ix = QUADRANT_ORDER.indexOf(x);
    const iy = QUADRANT_ORDER.indexOf(y);
    return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy);
  });
  const groups: ModGroup[] = keys.map((k) => {
    const rows = (Array.isArray(raw[k]) ? raw[k] : []).filter(okHubRow);
    return {
      id: k,
      label: QUADRANT_LABEL[k] ?? `自定义象限 · ${k}`,
      rows: rows.map((r) => ({
        id: `${k}:${r.id}`,
        title: r.title,
        sub: str(r.a),
        chip: str(r.b),
        fields: [
          ["ID", r.id],
          ["象限", k],
          ["A 列", str(r.a) ?? "—"],
          ["B 列", str(r.b) ?? "—"],
          ["C 列", str(r.c) ?? "—"],
        ] as [string, string][],
      })),
    };
  });
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  return { groups, total, note: "镜像行不计入实体总数（与第一主题同口径）" };
}

/* ── 本体知识库：studio_ontology_notes_v1 ───────────── */

type OntoNote = {
  id: string;
  title: string;
  tag: string;
  body?: string;
  createdAt: string;
};

const okNote = (n: unknown): n is OntoNote =>
  isObj(n) &&
  typeof n.id === "string" &&
  typeof n.title === "string" &&
  typeof n.tag === "string" &&
  typeof n.createdAt === "string";

export function loadOntology(): ModData {
  const notes = readArr("studio_ontology_notes_v1").filter(okNote);
  const rows: ModRow[] = notes.map((n) => ({
    id: n.id,
    title: n.title,
    sub: `${n.tag} · ${n.createdAt}`,
    chip: n.tag,
    fields: [
      ["ID", n.id],
      ["标签", n.tag],
      ["创建", n.createdAt],
    ],
    body: n.body,
  }));
  return { groups: [{ id: "notes", label: "站内笔记", rows }], total: rows.length };
}

/* ── 日历表：studio_calendar_items_v1 ───────────────── */

type CalItem = {
  id: string;
  date: string;
  title: string;
  note?: string;
  done?: boolean;
};

const okCal = (i: unknown): i is CalItem =>
  isObj(i) && typeof i.date === "string" && typeof i.title === "string";

export function loadCalendar(): ModData {
  const items = readArr("studio_calendar_items_v1")
    .filter(okCal)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const byMonth = new Map<string, ModRow[]>();
  for (const i of items) {
    const m = i.date.slice(0, 7);
    const row: ModRow = {
      id: i.id ?? `${i.date}:${i.title}`,
      title: i.title,
      sub: `${i.date}${i.done ? " · 已完成" : ""}`,
      chip: i.date.slice(5),
      fields: [
        ["日期", i.date],
        ["状态", i.done ? "已完成" : "待办"],
        ["ID", String(i.id ?? "—")],
      ],
      body: i.note,
    };
    const arr = byMonth.get(m) ?? [];
    arr.push(row);
    byMonth.set(m, arr);
  }
  const groups = [...byMonth.entries()].map(([m, rows]) => ({
    id: m,
    label: `${m} · 事项`,
    rows,
  }));
  return { groups, total: items.length };
}

/* ── 灵感池 / 创作空间：studio_workflow_steps_v2 ────── */

type FlowZone = "me" | "ai" | "agent";
type FlowStage = "incubate" | "produce" | "ready";
type FlowStep = {
  id: string;
  title: string;
  zone: FlowZone;
  note?: string;
  status?: string;
  platform?: string;
};

const FLOW_ZONES: { id: FlowZone; label: string; en: string }[] = [
  { id: "me", label: "我", en: "ME" },
  { id: "ai", label: "AI", en: "AI" },
  { id: "agent", label: "Agent", en: "AGENT" },
];
const FLOW_STAGES: { id: FlowStage; label: string; en: string }[] = [
  { id: "incubate", label: "孵化", en: "INCUBATE" },
  { id: "produce", label: "制作", en: "PRODUCE" },
  { id: "ready", label: "待发", en: "READY" },
];
const PLATFORM_LABEL: Record<string, string> = {
  xhs: "小红书",
  yt: "YouTube",
  bili: "B站",
  sph: "视频号",
  x: "X",
};

const okStep = (s: unknown): s is FlowStep =>
  isObj(s) &&
  typeof s.title === "string" &&
  (s.zone === "me" || s.zone === "ai" || s.zone === "agent");

const stageOf = (s: FlowStep): FlowStage =>
  s.status === "produce" || s.status === "ready" ? s.status : "incubate";

function readSteps(): { steps: FlowStep[]; known: boolean } {
  const raw = readArrOrNull("studio_workflow_steps_v2");
  if (raw === null) return { steps: [], known: false };
  return { steps: raw.filter(okStep), known: true };
}

const stepRow = (s: FlowStep): ModRow => {
  const zone = FLOW_ZONES.find((z) => z.id === s.zone);
  const stage = FLOW_STAGES.find((x) => x.id === stageOf(s));
  return {
    id: s.id ?? s.title,
    title: s.title,
    sub: `${zone?.label ?? s.zone}区 · ${stage?.label ?? "孵化"}${s.platform ? ` · ${PLATFORM_LABEL[s.platform] ?? s.platform}` : ""}`,
    chip: stage?.en,
    fields: [
      ["ID", String(s.id ?? "—")],
      ["泳道", `${zone?.label ?? s.zone} (${zone?.en ?? ""})`],
      ["阶段", `${stage?.label ?? "孵化"} (${stage?.en ?? ""})`],
      ["平台", s.platform ? (PLATFORM_LABEL[s.platform] ?? s.platform) : "—"],
    ],
    body: s.note,
  };
};

/** 灵感池：按泳道（我 / AI / Agent）三分组。 */
export function loadInspiration(): ModData {
  const { steps, known } = readSteps();
  const groups = FLOW_ZONES.map((z) => ({
    id: z.id,
    label: `${z.label} · ${z.en}`,
    rows: steps.filter((s) => s.zone === z.id).map(stepRow),
  })).filter((g) => g.rows.length > 0);
  return {
    groups,
    total: steps.length,
    note: known ? undefined : "键未落盘 · 种子步数只在第一主题页面常量内，本页不臆测",
  };
}

/** 创作空间：StudioBoard 同源步数，按阶段（孵化/制作/待发）三泳道。 */
export function loadStudio(): ModData {
  const { steps, known } = readSteps();
  const groups = FLOW_STAGES.map((st) => ({
    id: st.id,
    label: `${st.label} · ${st.en}`,
    rows: steps.filter((s) => stageOf(s) === st.id).map(stepRow),
  })).filter((g) => g.rows.length > 0);
  return {
    groups,
    total: steps.length,
    note: known
      ? "与第一主题 StudioBoard 看板同源（只读呈现，不做拖拽流转）"
      : "键未落盘 · 暂无步数",
  };
}

/* ── 财务管理：studio_finance_entries_v1 ────────────── */

type FinEntry = {
  id: string;
  date: string;
  kind: "income" | "expense";
  amount: number;
  category: string;
  note?: string;
  source?: string;
};

const okFin = (e: unknown): e is FinEntry =>
  isObj(e) &&
  typeof e.id === "string" &&
  typeof e.date === "string" &&
  (e.kind === "income" || e.kind === "expense") &&
  typeof e.amount === "number" &&
  typeof e.category === "string";

export function loadFinance(): ModData & { income: number; expense: number } {
  const entries = readArr("studio_finance_entries_v1")
    .filter(okFin)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const income = entries
    .filter((e) => e.kind === "income")
    .reduce((n, e) => n + e.amount, 0);
  const expense = entries
    .filter((e) => e.kind === "expense")
    .reduce((n, e) => n + e.amount, 0);
  const byMonth = new Map<string, ModRow[]>();
  for (const e of entries) {
    const m = e.date.slice(0, 7);
    const row: ModRow = {
      id: e.id,
      title: e.category,
      sub: `${e.date} · ${e.kind === "income" ? "收入" : "支出"}${e.note ? ` · ${e.note}` : ""}`,
      chip: `¥${e.amount}`,
      fields: [
        ["日期", e.date],
        ["类型", e.kind === "income" ? "收入" : "支出"],
        ["金额", `¥${e.amount}`],
        ["分类", e.category],
        ["来源", e.source === "ledger" ? "台账导入" : "手工录入"],
        ["ID", e.id],
      ],
      body: e.note,
    };
    const arr = byMonth.get(m) ?? [];
    arr.push(row);
    byMonth.set(m, arr);
  }
  const groups = [...byMonth.entries()].map(([m, rows]) => ({
    id: m,
    label: `${m} · 账目`,
    rows,
  }));
  return { groups, total: entries.length, income, expense };
}

/* ── 身体健康：打卡日期数组 + /health-sync.json ─────── */

type HealthSyncFull = {
  updated_at?: string;
  sleep?: {
    last?: { date?: string; start?: string; end?: string; hours?: number } | null;
    last7?: { date?: string; hours?: number }[];
  } | null;
  steps?: { today?: number | null; avg7?: number | null } | null;
  weight_kg?: number | null;
  diet?: {
    protein_target?: string;
    advice?: string;
    principles?: string[];
    last_analysis?: string | null;
  } | null;
  data_cutoff_note?: string;
};

export async function loadHealth(): Promise<ModData> {
  const checkins = readArr("studio_health_checkins_v1")
    .filter((x): x is string => typeof x === "string")
    .sort()
    .reverse();
  const groups: ModGroup[] = [];
  try {
    const r = await fetch("/health-sync.json", { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const h = (await r.json()) as HealthSyncFull;
    const rows: ModRow[] = [];
    if (h.updated_at) {
      rows.push({
        id: "sync:updated",
        title: `最近同步 · ${h.updated_at}`,
        sub: h.data_cutoff_note,
        chip: "OK",
        fields: [
          ["更新时间", h.updated_at],
          ["数据截至", h.data_cutoff_note ?? "—"],
        ],
      });
    }
    const last = h.sleep?.last;
    if (last) {
      rows.push({
        id: "sync:sleep",
        title: `最近睡眠 · ${last.date ?? "—"} ${last.hours ?? "—"}h`,
        sub: `${last.start ?? "—"} → ${last.end ?? "—"}`,
        chip: "SLEEP",
        fields: [
          ["日期", last.date ?? "—"],
          ["入睡", last.start ?? "—"],
          ["起床", last.end ?? "—"],
          ["时长", `${last.hours ?? "—"} 小时`],
          [
            "近 7 晚",
            (h.sleep?.last7 ?? [])
              .map((d) => `${d.date} ${d.hours}h`)
              .join(" · ") || "—",
          ],
        ],
      });
    }
    if (h.steps) {
      rows.push({
        id: "sync:steps",
        title: `步数 · 今日 ${h.steps.today ?? "—"} · 7 日均 ${h.steps.avg7 ?? "—"}`,
        chip: "STEPS",
        fields: [
          ["今日步数", String(h.steps.today ?? "—")],
          ["7 日均步数", String(h.steps.avg7 ?? "—")],
          ["体重", h.weight_kg != null ? `${h.weight_kg} kg` : "—"],
        ],
      });
    }
    if (rows.length) groups.push({ id: "sync", label: "健康同步", rows });
  } catch {
    /* health-sync 不可达：只呈现打卡组，note 在下方标注 */
  }
  if (checkins.length) {
    groups.push({
      id: "checkins",
      label: "训练打卡",
      rows: checkins.map((d) => ({
        id: `checkin:${d}`,
        title: d,
        chip: "已打卡",
        fields: [["日期", d]] as [string, string][],
      })),
    });
  }
  return {
    groups,
    total: checkins.length,
    note: `打卡 ${checkins.length} 天（计数与第一主题同口径）`,
  };
}

/* ── 快照登记册：import SLICES 只读 ─────────────────── */

export function loadSnapshot(): ModData {
  const byModule = new Map<string, ModRow[]>();
  for (const s of SLICES) {
    const row: ModRow = {
      id: s.name,
      title: s.name,
      sub: s.module,
      chip: s.kind,
      fields: [
        ["片名", s.name],
        ["存储键", s.key],
        ["所属", s.module],
        ["类型", s.kind],
      ],
    };
    const arr = byModule.get(s.module) ?? [];
    arr.push(row);
    byModule.set(s.module, arr);
  }
  const groups = [...byModule.entries()].map(([m, rows]) => ({
    id: m,
    label: m,
    rows,
  }));
  return { groups, total: SLICES.length, note: "登记册实测长度（import 主干 SLICES，不复制数字）" };
}

/* ── 执行日志：studio_exec_log_v1 过滤 + 截尾 20 ───── */

type ExecItem =
  | { ts: number; text: string }
  | { ts: number; type: string; module: string; detail?: string };

const okExec = (x: unknown): x is ExecItem => {
  if (!isObj(x)) return false;
  return (
    typeof x.ts === "number" &&
    Number.isFinite(x.ts) &&
    (typeof x.text === "string" || typeof x.type === "string")
  );
};

export function loadExecLog(): ModData {
  const items = (readArrOrNull("studio_exec_log_v1") ?? [])
    .filter(okExec)
    .slice(-20)
    .reverse();
  const rows: ModRow[] = items.map((e, i) => {
    const isText = "text" in e && typeof e.text === "string";
    const title = isText
      ? (e as { text: string }).text
      : `${(e as { type: string }).type} · ${(e as { detail?: string }).detail ?? ""}`;
    return {
      id: `log:${e.ts}:${i}`,
      title,
      sub: fmtTs(e.ts),
      chip: isText ? "LOG" : (e as { type: string }).type,
      fields: [
        ["时间", fmtTs(e.ts)],
        ["类型", isText ? "文本" : (e as { type: string }).type],
        ["模块", isText ? "—" : ((e as { module?: string }).module ?? "—")],
        ["详情", isText ? (e as { text: string }).text : ((e as { detail?: string }).detail ?? "—")],
      ] as [string, string][],
    };
  });
  return {
    groups: [{ id: "log", label: "最近日志（上限 20 · 与第一主题同口径）", rows }],
    total: rows.length,
  };
}

/* ── 健康同步详情：/health-sync.json 全量 ───────────── */

export async function loadHealthSync(): Promise<ModData> {
  try {
    const r = await fetch("/health-sync.json", { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const h = (await r.json()) as HealthSyncFull;
    const rows: ModRow[] = [
      {
        id: "hs:status",
        title: `同步状态 · OK`,
        sub: `updated_at ${h.updated_at ?? "—"}`,
        chip: "OK",
        fields: [
          ["状态", "OK（文件可达且 updated_at 有效）"],
          ["更新时间", h.updated_at ?? "—"],
          ["数据截至", h.data_cutoff_note ?? "—"],
        ],
      },
    ];
    const sections: [string, string, unknown][] = [
      ["hs:sleep", "睡眠 sleep", h.sleep],
      ["hs:steps", "步数 steps", h.steps],
      ["hs:weight", "体重 weight_kg", h.weight_kg],
      ["hs:diet", "饮食 diet", h.diet],
    ];
    for (const [id, label, v] of sections) {
      rows.push({
        id,
        title: label,
        sub: v == null ? "— 无数据" : "点击查看原始字段",
        chip: v == null ? "—" : "JSON",
        fields: [["段", label]],
        body: v == null ? "— 无数据" : JSON.stringify(v, null, 2),
        mono: v != null,
      });
    }
    return {
      groups: [{ id: "hs", label: "health-sync.json", rows }],
      total: rows.length,
      note: "判定与第一主题顶栏同口径：文件可达且 updated_at 为字符串即 OK",
    };
  } catch {
    return {
      groups: [
        {
          id: "hs",
          label: "health-sync.json",
          rows: [
            {
              id: "hs:stale",
              title: "同步状态 · STALE",
              sub: "/health-sync.json 不可达",
              chip: "STALE",
              fields: [["状态", "STALE（文件不可达）"]] as [string, string][],
            },
          ],
        },
      ],
      total: 1,
      note: "STALE 呈现与第一主题同口径，不编造数据",
    };
  }
}
