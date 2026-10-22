"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  FINANCE_ASSET_TYPES,
  currentMonthKey,
  fmtMoney,
  isNonConsumption,
  isRepayment,
  type FinanceAsset,
  type FinanceAssetType,
  type FinanceEntry,
  type FinanceLiability,
} from "@/components/studio/finance-module";
import { InlineConfirmButton } from "@/components/ui/inline-confirm";
import { emit } from "@/components/studio/bus";
import {
  loadManualHealth,
  onManualHealthChange,
  manualWins,
  type ManualHealth,
} from "@/components/studio/health-effective";
import skillsSyncJson from "../../../public/skills-sync.json";
import healthSyncJson from "../../../public/health-sync.json";

/**
 * HUD module content views (2026-10-21; completed pass on branch
 * module-complete). Clicking a module on the E home (tree row / console
 * card) swaps the CORE MAP overview for that module's content;
 * 「← 返回总览」 goes back. Every value renders an existing data
 * source — nothing is invented; empty sources render honest empty
 * states and gaps are labelled 缺口/未接入/未同步：
 *
 * - skills    ← public/skills-sync.json（同文件实时再拉）+ 搜索 + 详情
 *               （Luna 5 个带 detail 长文；grokbot 8 个源文件无 desc）
 * - database  ← 总索引三区：技能（skills-sync.json 13）/ 流程（灵感池
 *               同源 studio_workflow_steps_v2）/ 条目（作品·台账·睡眠）
 * - works     ← 作品区（YouTube EP001 真链接 + 视频号 ep01 槽位）与
 *               待办票分区；平台同步六平台如实标未接入
 * - calendar  ← 2026-10 月历 + 事项（localStorage
 *               studio_calendar_items_v1，可增删，本地保存）+ 待办票
 * - finance   ← 旧版五区接回（概览/记账明细/月度报告/负债管理/
 *               资产台账）：数据层与旧模块同构（localStorage 同键 +
 *               台账 2 条种子），数字全由条目实时派生；记账明细带
 *               图片记账（tesseract.js 本地 OCR + chi_sim 自托管，
 *               提取金额/日期/对方/分类 → 待确认卡 → 确认才入账）
 * - health    ← public/health-sync.json（睡眠/步数/饮食）+ 训练记录区
 *               （计划＝塑形计划-轻器械高次数.md，完成状态无确认数据
 *               → 标计划态，不代填）+ 教学视频（/health-media.json
 *               运行时拉取，键＝动作 id，点开展开 B 站嵌入播放器；
 *               拉不到就只显文字，不编造）
 * - ontology  ← 结构与口径：条目源＝第二大脑笔记
 *               （goals/ai-2/hidden_files/notes/，现仅框架 README、
 *               笔记 0 条）→ 如实标建设中；库内文件带 [ OBSIDIAN ]
 *               直达（库名本机填写 studio_obsidian_vault_v1，未填
 *               不拼链接）
 * - inspiration ← 我/AI/Agent 三区（WORKFLOW-ZONES-SPEC），步骤读
 *               studio_workflow_steps_v2（初始为空，三区如实空）
 * - studio    ← HUB 入口卡 + 创作组总览（计数与最近动态，皆真事实）
 *               + 创作流水线看板（workflow steps 按 status 三泳道
 *               孵化/制作/待发，拖拽与箭头换道、落盘发总线事件）
 */

type SkillEntry = {
  id: string;
  name: string;
  zh: string;
  tag: string;
  source: string;
  desc?: string;
  detail?: string;
};
type SkillAgentGroup = { id: string; name: string; skills: SkillEntry[] };

const SKILLS_SYNC = skillsSyncJson as unknown as {
  agents: SkillAgentGroup[];
  updated_at?: string;
};
const ALL_SKILLS: SkillEntry[] = SKILLS_SYNC.agents.flatMap((a) => a.skills);

/* ── page.tsx mirrors (read-only copies of the source constants) ── */

type Ticket = { id: string; title: string; detail: string; owner: string };
/** PENDING_TICKETS in page.tsx（文案已按 2026-10-21 事实更新）。 */
const PENDING_TICKETS: Ticket[] = [
  {
    id: "t-ep01",
    title: "视频号 ep01 待发布",
    detail: "配音已定稿（Fish Audio）· 待本人点发",
    owner: "Muse + 本人",
  },
];

/** FINANCE_SEED_ENTRIES in page.tsx (ledger.csv, both 2026-10-17). */
const FINANCE_LEDGER_ENTRIES = [
  {
    id: "fin-seed-ledger-1",
    date: "2026-10-17",
    kind: "expense" as const,
    amount: 22,
    category: "日用",
    channel: "现金/未知",
    note: "水+烟",
  },
  {
    id: "fin-seed-ledger-2",
    date: "2026-10-17",
    kind: "expense" as const,
    amount: 401.54,
    category: "还款",
    channel: "微信分付",
    note: "微信分付还款",
  },
];

/* ── health training plan（塑形计划-轻器械高次数.md，只读镜像） ──
 * id 与 public/health-media.json 的键对齐（旧 health-module.tsx 的
 * MAIN_ITEMS 同一套 id），教学视频运行时从 /health-media.json 拉取。 */
const TRAINING_MOVES: { id: string; name: string; reps: string; cue: string }[] = [
  { id: "main-band-squat", name: "弹力带深蹲", reps: "15–20 次", cue: "膝盖顺着脚尖方向" },
  { id: "main-bottle-press", name: "水瓶推举", reps: "12–15 次", cue: "水瓶代哑铃 · 核心收紧抓牢瓶身" },
  { id: "main-band-row", name: "弹力带划船", reps: "12–15 次", cue: "拉到胸前时肩胛骨夹紧" },
  { id: "main-glute-bridge", name: "臀桥", reps: "15–20 次", cue: "环形带套膝盖上方 · 顶到最高夹紧 1 秒" },
  { id: "main-bottle-curl", name: "水瓶弯举", reps: "12–15 次", cue: "大臂贴紧身体别动" },
  { id: "main-ab-wheel", name: "跪姿腹肌轮推出", reps: "8–10 次", cue: "推到快贴地就拉回 · 全程别塌腰" },
];

/** public/health-media.json 的条目形状（同旧 health-module.tsx）。 */
type HealthMediaItem = {
  title: string;
  embed?: string;
  link: string;
  source: string;
};
type HealthMediaMap = Record<string, HealthMediaItem>;
const TRAINING_EQUIP = ["弹力带套装（已有）", "腹肌轮（已有）", "水瓶代哑铃 1.5–2L 灌满", "瑜伽垫（可选）"];

/* ── inspiration zones（WORKFLOW-ZONES-SPEC：我 / AI / Agent） ── */
type FlowZone = "me" | "ai" | "agent";
const FLOW_ZONES: { id: FlowZone; label: string; en: string }[] = [
  { id: "me", label: "我", en: "ME" },
  { id: "ai", label: "AI", en: "AI" },
  { id: "agent", label: "Agent", en: "AGENT" },
];
/* 创作流水线阶段（hud-empower）：status 是在 zone 之外补的字段，
 * 旧数据没有它——缺省一律按「孵化」（流水线入口）呈现，第一次换道
 * 时才真正落盘，旧字段（id/title/zone/note）一个不动。 */
type FlowStage = "incubate" | "produce" | "ready";
const FLOW_STAGES: { id: FlowStage; label: string; en: string }[] = [
  { id: "incubate", label: "孵化", en: "INCUBATE" },
  { id: "produce", label: "制作", en: "PRODUCE" },
  { id: "ready", label: "待发", en: "READY" },
];

type FlowStep = {
  id: string;
  title: string;
  zone: FlowZone;
  note?: string;
  status?: FlowStage;
};

const stepStage = (s: FlowStep): FlowStage =>
  s.status === "produce" || s.status === "ready" ? s.status : "incubate";

function readFlowSteps(): FlowStep[] {
  try {
    const raw = window.localStorage.getItem("studio_workflow_steps_v2");
    if (!raw) return [];
    const arr = JSON.parse(raw) as FlowStep[];
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (s) =>
        s &&
        typeof s.title === "string" &&
        (s.zone === "me" || s.zone === "ai" || s.zone === "agent"),
    );
  } catch {
    return [];
  }
}

function writeFlowSteps(steps: FlowStep[]): boolean {
  try {
    window.localStorage.setItem(
      "studio_workflow_steps_v2",
      JSON.stringify(steps),
    );
    return true;
  } catch {
    return false;
  }
}

type HealthSync = {
  updated_at?: string;
  data_cutoff_note?: string;
  sleep?: {
    /* start/end optional: a manual clipboard record may carry only
     * the duration (hud-health-sync) — never borrow the file's
     * start/end for a different night. */
    last?: { date: string; start?: string; end?: string; hours: number };
    last7?: { date: string; hours: number }[];
  };
  steps?: { today?: number | null; avg7?: number | null };
  weight_kg?: number | null;
  diet?: {
    protein_target?: string;
    advice?: string;
    principles?: string;
  };
};
const HEALTH_SYNC_STATIC = healthSyncJson as unknown as HealthSync;

type CalItem = { id: string; date: string; title: string; note?: string };
const CAL_KEY = "studio_calendar_items_v1";

/* ─────────────────────────── shared bits ─────────────────────────── */

function SecHead({
  title,
  en,
  right,
}: {
  title: string;
  en: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="hud-module-sec">
      <span className="hud-module-sec-t">
        {title} <span className="hud-module-sec-en">{en}</span>
      </span>
      {right}
    </div>
  );
}

function EmptyState({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="hud-module-empty" data-testid="hud-module-empty">
      <div className="hud-module-empty-t">{title}</div>
      <div className="hud-module-empty-s">{sub}</div>
    </div>
  );
}

function Row({
  children,
  testid,
}: {
  children: React.ReactNode;
  testid?: string;
}) {
  return (
    <div className="hud-module-row" data-testid={testid}>
      {children}
    </div>
  );
}

function Kv({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="hud-module-kv">
      <span>{k}</span>
      <b>{children}</b>
    </div>
  );
}

/* ─────────────────────────── 5 · skills ─────────────────────────── */

/** 技能分组折叠态的本机存储键（与日历事项同机制：只存这台设备）。 */
const SKILLS_COLLAPSED_KEY = "studio_skills_collapsed_v1";

function SkillsBody() {
  const [agents, setAgents] = React.useState<SkillAgentGroup[]>(
    SKILLS_SYNC.agents,
  );
  const [updatedAt, setUpdatedAt] = React.useState<string | undefined>(
    SKILLS_SYNC.updated_at,
  );
  const [query, setQuery] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>(
    {},
  );
  /* COPY PROMPT 反馈态（hud-empower）：复制的是哪一类必须如实回显——
   * detail 技能复制指令全文（prompt），无 detail 的复制拼装调用卡
   * （card）；writeText 与 execCommand 两级都失败才落 fail。反馈
   * 1.2 秒后自动复原为 COPY PROMPT。 */
  const [copyState, setCopyState] = React.useState<{
    id: string;
    kind: "prompt" | "card" | "fail";
  } | null>(null);
  const copyTimer = React.useRef<number | undefined>(undefined);
  React.useEffect(
    () => () => {
      if (copyTimer.current !== undefined)
        window.clearTimeout(copyTimer.current);
    },
    [],
  );
  const copySkill = async (s: SkillEntry) => {
    const isPrompt = typeof s.detail === "string" && s.detail.length > 0;
    const text = isPrompt
      ? (s.detail as string)
      : [
          `技能：${s.name}（${s.zh}）`,
          `标签：${s.tag}`,
          `来源：${s.source}`,
          `调用：在对话中点名调用「${s.name}」，由 Luna 读取该技能源文件后执行。`,
        ].join("\n");
    let done = false;
    try {
      await navigator.clipboard.writeText(text);
      done = true;
    } catch {
      /* 权限/非安全上下文 → textarea + execCommand 降级 */
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        done = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        done = false;
      }
    }
    setCopyState({
      id: s.id,
      kind: done ? (isPrompt ? "prompt" : "card") : "fail",
    });
    if (copyTimer.current !== undefined)
      window.clearTimeout(copyTimer.current);
    /* 成功反馈 1.2 秒复原；失败文案留住，等下一次点击再变。 */
    if (done)
      copyTimer.current = window.setTimeout(() => setCopyState(null), 1200);
  };
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SKILLS_COLLAPSED_KEY);
      if (raw) {
        const obj = JSON.parse(raw) as Record<string, unknown>;
        const next: Record<string, boolean> = {};
        for (const [k, v] of Object.entries(obj ?? {})) {
          if (typeof v === "boolean") next[k] = v;
        }
        setCollapsed(next);
      }
    } catch {
      /* storage unavailable → 默认全展开 */
    }
  }, []);
  const toggleGroup = (id: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        window.localStorage.setItem(
          SKILLS_COLLAPSED_KEY,
          JSON.stringify(next),
        );
      } catch {
        /* storage unavailable → 仅本次会话内生效 */
      }
      return next;
    });
  };
  React.useEffect(() => {
    let live = true;
    fetch("/skills-sync.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { agents?: SkillAgentGroup[]; updated_at?: string } | null) => {
        if (!live || !j || !Array.isArray(j.agents)) return;
        setAgents(j.agents);
        if (typeof j.updated_at === "string") setUpdatedAt(j.updated_at);
      })
      .catch(() => {
        /* bundled copy stays */
      });
    return () => {
      live = false;
    };
  }, []);
  const total = agents.reduce((acc, a) => acc + a.skills.length, 0);
  const q = query.trim().toLowerCase();
  const match = (s: SkillEntry) =>
    !q ||
    [s.zh, s.name, s.tag, s.source, s.desc ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(q);
  const visibleTotal = agents.reduce(
    (acc, a) => acc + a.skills.filter(match).length,
    0,
  );
  return (
    <div>
      <SecHead
        title="已装技能"
        en="INSTALLED SKILLS"
        right={
          <span className="hud-module-note">
            数据源 /skills-sync.json
            {updatedAt ? ` · 更新 ${updatedAt.slice(0, 16).replace("T", " ")}` : ""} ·
            共 {total} 个
          </span>
        }
      />
      <input
        className="hud-module-input"
        data-testid="hud-skill-search"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索技能 · 名称 / 标签 / 来源"
        aria-label="搜索技能"
      />
      {agents.map((agent) => {
        const list = agent.skills.filter(match);
        if (list.length === 0) return null;
        const hasDetail = agent.skills.some((s) => s.detail);
        /* 搜索时含命中的分组强制展开；清空搜索后恢复用户折叠态 */
        const isCollapsed = !q && !!collapsed[agent.id];
        return (
          <div
            key={agent.id}
            className="hud-module-group"
            data-testid={`hud-skill-group-${agent.id}`}
          >
            <div
              className="hud-module-group-h hud-module-group-fold"
              data-testid={`hud-skill-group-toggle-${agent.id}`}
              role="button"
              tabIndex={0}
              aria-expanded={!isCollapsed}
              onClick={() => toggleGroup(agent.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleGroup(agent.id);
                }
              }}
            >
              <span className="hud-module-group-n">{agent.name}</span>
              <span className="hud-chip hud-c-pur">AGENT</span>
              <span className="hud-module-note">
                {list.length} SKILLS
                {q ? ` / 共 ${agent.skills.length}` : ""}
              </span>
              <span className="hud-module-note">
                {hasDetail
                  ? "· 点「详情」展开 SKILL.md 全文"
                  : "· 源文件未提供简介字段，仅列现有字段"}
              </span>
              <span className="hud-module-group-arrow" aria-hidden="true">
                {isCollapsed ? "▸" : "▾"}
              </span>
            </div>
            {isCollapsed
              ? null
              : list.map((s) => (
                  <React.Fragment key={s.id}>
                    <Row testid={`hud-skill-${s.id}`}>
                      <div className="hud-module-row-main">
                        <div className="hud-module-row-t">
                          {s.zh}
                          <span className="hud-module-row-en">{s.name}</span>
                        </div>
                        {s.desc ? (
                          <div className="hud-module-row-sub">{s.desc}</div>
                        ) : null}
                        <div className="hud-module-row-src">{s.source}</div>
                      </div>
                      <span className="hud-chip hud-c-cyan">{s.tag}</span>
                      <button
                        type="button"
                        className={cn(
                          "hud-module-toggle hud-module-copy",
                          copyState?.id === s.id &&
                            copyState.kind !== "fail" &&
                            "hud-module-copy-ok",
                          copyState?.id === s.id &&
                            copyState.kind === "fail" &&
                            "hud-module-copy-fail",
                        )}
                        data-testid={`hud-skill-copy-${s.id}`}
                        onClick={() => void copySkill(s)}
                      >
                        {copyState?.id === s.id
                          ? copyState.kind === "prompt"
                            ? "已复制提示词"
                            : copyState.kind === "card"
                              ? "已复制调用卡"
                              : "复制失败·请检查权限"
                          : "COPY PROMPT"}
                      </button>
                      {s.detail ? (
                        <button
                          type="button"
                          className="hud-module-toggle"
                          data-testid={`hud-skill-toggle-${s.id}`}
                          onClick={() =>
                            setOpenId(openId === s.id ? null : s.id)
                          }
                        >
                          {openId === s.id ? "收起" : "详情"}
                        </button>
                      ) : null}
                    </Row>
                    {s.detail && openId === s.id ? (
                      <div
                        className="hud-module-detail"
                        data-testid={`hud-skill-detail-${s.id}`}
                      >
                        {s.detail}
                      </div>
                    ) : null}
                  </React.Fragment>
                ))}
          </div>
        );
      })}
      {q && visibleTotal === 0 ? (
        <EmptyState
          title="无匹配技能"
          sub={`没有技能命中「${query.trim()}」· 清空搜索看全部 ${total} 个`}
        />
      ) : null}
    </div>
  );
}

/* ─────────────────────────── 6 · database ─────────────────────────── */

function DatabaseBody() {
  const [steps, setSteps] = React.useState<FlowStep[]>([]);
  React.useEffect(() => {
    setSteps(readFlowSteps());
  }, []);
  const sleepN = HEALTH_SYNC_STATIC.sleep?.last7?.length ?? 0;
  const entryRows: {
    id: string;
    title: string;
    sub: string;
    kind: string;
    cls: string;
  }[] = [
    {
      id: "e-yt-ep01",
      title: "YouTube EP001 · Latent Space 首片",
      sub: "作品库 · 已上传 · 待公开",
      kind: "WORKS",
      cls: "hud-c-pink",
    },
    {
      id: "e-sph-ep01",
      title: "视频号 ep01 · 配音已定稿待发布",
      sub: "作品库 · 成片槽位",
      kind: "WORKS",
      cls: "hud-c-pink",
    },
    ...FINANCE_LEDGER_ENTRIES.map((e) => ({
      id: `e-${e.id}`,
      title: `台账 · ${e.note} ${fmtMoney(e.amount)}`,
      sub: `财务系统 · ${e.date} · ${e.category}`,
      kind: "FINANCE",
      cls: "hud-c-yel",
    })),
    {
      id: "e-sleep",
      title: `健康同步 · 睡眠记录 ${sleepN} 晚`,
      sub: `身体健康 · 截至 ${HEALTH_SYNC_STATIC.sleep?.last?.date ?? "—"} · STALE`,
      kind: "HEALTH",
      cls: "hud-c-amb",
    },
  ];
  return (
    <div>
      <p className="hud-module-note" style={{ marginBottom: 4 }}>
        定位：全站总索引——技能 / 流程 / 条目三区。技能库是「已装技能的
        使用视图」，这里是「有什么」的登记表，两边同源不同视角。
      </p>
      <SecHead
        title="技能索引"
        en="SKILLS INDEX"
        right={
          <span className="hud-module-note">
            源 skills-sync.json · {ALL_SKILLS.length} 条
          </span>
        }
      />
      {ALL_SKILLS.map((s) => (
        <Row key={`db-s-${s.id}`} testid={`hud-db-s-${s.id}`}>
          <div className="hud-module-row-main">
            <div className="hud-module-row-t">
              {s.zh} · {s.name}
            </div>
            <div className="hud-module-row-src">
              {s.source} · {SKILLS_SYNC.agents.find((a) => a.skills.some((x) => x.id === s.id))?.name ?? ""}
            </div>
          </div>
          <span className="hud-chip hud-c-cyan">SKILL</span>
        </Row>
      ))}
      <SecHead
        title="流程索引"
        en="WORKFLOW INDEX"
        right={
          <span className="hud-module-note">
            与灵感池同源 studio_workflow_steps_v2 · {steps.length} 步
          </span>
        }
      />
      {steps.length > 0 ? (
        steps.map((s) => (
          <Row key={`db-f-${s.id}`} testid={`hud-db-f-${s.id}`}>
            <div className="hud-module-row-main">
              <div className="hud-module-row-t">{s.title}</div>
              {s.note ? (
                <div className="hud-module-row-sub">{s.note}</div>
              ) : null}
            </div>
            <span className="hud-chip hud-c-pur">
              {FLOW_ZONES.find((z) => z.id === s.zone)?.label ?? s.zone}区
            </span>
          </Row>
        ))
      ) : (
        <EmptyState
          title="流程 0 步"
          sub="灵感池三区皆空（旧 8 步已于 2026-10-20 清空）· 在灵感池新增步骤后这里同步出现"
        />
      )}
      <SecHead
        title="条目索引"
        en="ENTRY INDEX"
        right={
          <span className="hud-module-note">跨模块登记 · {entryRows.length} 条</span>
        }
      />
      {entryRows.map((r) => (
        <Row key={r.id} testid={`hud-db-${r.id}`}>
          <div className="hud-module-row-main">
            <div className="hud-module-row-t">{r.title}</div>
            <div className="hud-module-row-sub">{r.sub}</div>
          </div>
          <span className={cn("hud-chip", r.cls)}>{r.kind}</span>
        </Row>
      ))}
    </div>
  );
}

/* ─────────────────────────── 1 · works ─────────────────────────── */

type SyncedWork = {
  platform: string;
  id: string;
  title: string;
  published_at: string;
};
const SYNC_PLATFORMS: { name: string; note: string }[] = [
  { name: "Bilibili · B站", note: "接口直连已备 · 待扫码登录后接入" },
  { name: "抖音", note: "待抓取包回传后接入" },
  { name: "视频号", note: "无公开同步通道 · 手工维护" },
  { name: "YouTube", note: "待 API key 后接入" },
  { name: "X", note: "未接入" },
  { name: "TikTok", note: "未接入" },
];

function WorksBody() {
  const [synced, setSynced] = React.useState<SyncedWork[] | null>(null);
  React.useEffect(() => {
    let live = true;
    fetch("/works-sync.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { platforms?: Record<string, SyncedWork[]> } | null) => {
        if (!live || !j || typeof j.platforms !== "object" || !j.platforms)
          return;
        setSynced(Object.values(j.platforms).flat());
      })
      .catch(() => {
        /* 未投递 → 未接入 */
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <div>
      <SecHead
        title="作品"
        en="WORKS"
        right={<span className="hud-module-note">已产出 / 待发布 · 2 件</span>}
      />
      <Row testid="hud-work-yt-ep01">
        <div className="hud-module-row-main">
          <div className="hud-module-row-t">
            YouTube EP001 · Latent Space 首片
          </div>
          <div className="hud-module-row-sub">
            2026-10-18 上传 · 私享状态 · 待改公开（手机端 YouTube Studio 操作）
          </div>
          <a
            className="hud-module-link"
            href="https://www.youtube.com/watch?v=nmMQWsG5w3k"
            target="_blank"
            rel="noreferrer"
          >
            youtube.com/watch?v=nmMQWsG5w3k ↗
          </a>
        </div>
        <span className="hud-chip hud-c-pink">待公开</span>
      </Row>
      <Row testid="hud-work-slot-ep01">
        <div className="hud-module-row-main">
          <div className="hud-module-row-t">视频号 ep01 · 待发布</div>
          <div className="hud-module-row-sub">
            配音已定稿（Fish Audio 影视解说男声 · 2026-10-19）· 成片槽位 ·
            待本人点发
          </div>
        </div>
        <span className="hud-module-note">2026-10</span>
        <span className="hud-chip hud-c-pink">待发布</span>
      </Row>
      <SecHead
        title="待办票"
        en="PENDING TICKETS"
        right={
          <span className="hud-module-note">
            待办在日历表清 · 这里只作关联展示
          </span>
        }
      />
      {PENDING_TICKETS.map((t) => (
        <Row key={t.id} testid={`hud-wticket-${t.id}`}>
          <div className="hud-module-row-main">
            <div className="hud-module-row-t">{t.title}</div>
            <div className="hud-module-row-sub">{t.detail}</div>
          </div>
          <span className="hud-module-note">{t.owner}</span>
          <span className="hud-chip hud-c-yel">待办</span>
        </Row>
      ))}
      <SecHead title="多平台同步" en="PLATFORM SYNC" />
      {synced && synced.length > 0 ? (
        synced.map((w) => (
          <Row key={`${w.platform}:${w.id}`}>
            <div className="hud-module-row-main">
              <div className="hud-module-row-t">{w.title}</div>
              <div className="hud-module-row-src">
                {w.platform} · {w.published_at}
              </div>
            </div>
            <span className="hud-chip hud-c-grn">已同步</span>
          </Row>
        ))
      ) : null}
      {SYNC_PLATFORMS.map((p) => (
        <Row key={p.name} testid={`hud-sync-${p.name}`}>
          <div className="hud-module-row-main">
            <div className="hud-module-row-t">{p.name}</div>
            <div className="hud-module-row-sub">{p.note}</div>
          </div>
          <span className="hud-chip hud-c-dim">未接入</span>
        </Row>
      ))}
      <p className="hud-module-note" style={{ marginTop: 8 }}>
        works-sync.json 尚未投递；接入进度见各平台行，接入后此处自动点亮。
      </p>
    </div>
  );
}

/* ─────────────────────────── 4 · calendar ─────────────────────────── */

function CalendarBody() {
  const [items, setItems] = React.useState<CalItem[]>([]);
  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState("2026-10-21");
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CAL_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as CalItem[];
        if (Array.isArray(arr)) {
          setItems(
            arr.filter(
              (i) =>
                i && typeof i.date === "string" && typeof i.title === "string",
            ),
          );
        }
      }
    } catch {
      /* storage unavailable → 事项为空 */
    }
  }, []);
  const saveItems = (next: CalItem[]) => {
    setItems(next);
    try {
      window.localStorage.setItem(CAL_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };
  const addItem = () => {
    const t = title.trim();
    if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    saveItems([
      ...items,
      { id: `cal-${Date.now()}`, date, title: t },
    ]);
    setTitle("");
  };
  const year = 2026;
  const month = 10;
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const dateStr = (d: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const now = new Date();
  const todayHere =
    now.getFullYear() === year && now.getMonth() + 1 === month
      ? now.getDate()
      : -1;
  const marked = new Map<string, CalItem[]>();
  for (const it of items) {
    const list = marked.get(it.date) ?? [];
    list.push(it);
    marked.set(it.date, list);
  }
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div>
      <SecHead
        title={`${year} 年 ${month} 月`}
        en="MONTH GRID"
        right={
          <span className="hud-module-note">
            事项 {items.length} 条 · 待办票 {PENDING_TICKETS.length} 张
          </span>
        }
      />
      <div className="hud-module-cal" data-testid="hud-cal-grid">
        {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
          <div key={d} className="hud-module-cal-h">
            {d}
          </div>
        ))}
        {Array.from({ length: firstDow }, (_, i) => (
          <div key={`b${i}`} className="hud-module-cal-d hud-module-cal-off" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
          const has = marked.has(dateStr(d));
          return (
            <div
              key={d}
              className={cn(
                "hud-module-cal-d",
                has && "hud-module-cal-on",
                d === todayHere && "hud-module-cal-today",
              )}
              title={marked.get(dateStr(d))?.map((x) => x.title).join(" / ")}
            >
              {d}
              {has ? <span className="hud-module-cal-dot" /> : null}
            </div>
          );
        })}
      </div>
      <SecHead
        title="事项列表"
        en="ITEMS"
        right={
          <span className="hud-module-note">
            本地保存 studio_calendar_items_v1 · 跨设备同步待后端方案
          </span>
        }
      />
      <div className="hud-module-form">
        <input
          className="hud-module-input hud-module-input-flex"
          data-testid="hud-cal-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addItem();
          }}
          placeholder="新事项标题"
          aria-label="新事项标题"
        />
        <input
          className="hud-module-input hud-module-input-date"
          data-testid="hud-cal-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="事项日期"
        />
        <button
          type="button"
          className="hud-module-toggle"
          data-testid="hud-cal-add"
          onClick={addItem}
        >
          ＋ 加事项
        </button>
      </div>
      {sorted.length > 0 ? (
        sorted.map((it) => (
          <Row key={it.id} testid={`hud-cal-item-${it.id}`}>
            <div className="hud-module-row-main">
              <div className="hud-module-row-t">{it.title}</div>
              {it.note ? (
                <div className="hud-module-row-sub">{it.note}</div>
              ) : null}
            </div>
            <span className="hud-module-note">{it.date}</span>
            <button
              type="button"
              className="hud-module-del"
              aria-label={`删除事项 ${it.title}`}
              onClick={() => saveItems(items.filter((x) => x.id !== it.id))}
            >
              删除
            </button>
          </Row>
        ))
      ) : (
        <EmptyState
          title="暂无日历事项"
          sub="本月事项 0 条 · 用上方表单添加（保存在本机浏览器）"
        />
      )}
      <SecHead title="待办票" en="PENDING TICKETS" />
      {PENDING_TICKETS.map((t) => (
        <Row key={t.id} testid={`hud-ticket-${t.id}`}>
          <div className="hud-module-row-main">
            <div className="hud-module-row-t">{t.title}</div>
            <div className="hud-module-row-sub">{t.detail}</div>
          </div>
          <span className="hud-module-note">{t.owner}</span>
          <span className="hud-chip hud-c-yel">待办</span>
        </Row>
      ))}
    </div>
  );
}

/* ─────────────────────────── 3 · finance ─────────────────────────── */

/* 财务数据层：与旧模块（page.tsx 状态层 + finance-module.tsx）完全同构——
 * 同一套 localStorage 键、同样的种子（台账真实 2 条）与校验、同样的
 * 首次播种语义（删过的条目不复活）。旧版在本机浏览器存过的数据，
 * 打开这里会自动读回来。所有数字都由 entries / liabilities / assets
 * 实时派生，概览与月度报告共用同一个 finSummarize，不写死金额。 */
const FIN_ENTRIES_KEY = "studio_finance_entries_v1";
const FIN_LIABILITIES_KEY = "studio_finance_liabilities_v1";
const FIN_ASSETS_KEY = "studio_finance_assets_v1";
const FIN_BUDGET_KEY = "studio_finance_budget_v1";
const FIN_SEEDED_KEY = "studio_finance_seeded_v1";

const FIN_SEED_ENTRIES: FinanceEntry[] = [
  {
    id: "fin-seed-ledger-1",
    date: "2026-10-17",
    kind: "expense",
    amount: 22,
    category: "日用",
    note: "水+烟",
    source: "ledger",
  },
  {
    id: "fin-seed-ledger-2",
    date: "2026-10-17",
    kind: "expense",
    amount: 401.54,
    category: "还款",
    note: "微信分付还款",
    source: "ledger",
  },
];

const FIN_CATEGORIES = [
  "日用",
  "餐饮",
  "交通",
  "购物",
  "娱乐",
  "还款",
  "转账",
  "工资",
  "其他",
];

const finRound2 = (n: number) => Math.round(n * 100) / 100;
const finMonthOf = (date: string) => date.slice(0, 7);
const finPad2 = (n: number) => String(n).padStart(2, "0");
const finPrevMonthKey = (mk: string): string => {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${finPad2(d.getMonth() + 1)}`;
};
const finMonthLabel = (mk: string) =>
  `${Number(mk.slice(0, 4))} 年 ${Number(mk.slice(5, 7))} 月`;
const finTodayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${finPad2(d.getMonth() + 1)}-${finPad2(d.getDate())}`;
};
const finGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 12) return "上午好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
};

type FinScope = "all" | "consume";
type FinMonthSummary = {
  income: number;
  outflow: number;
  net: number;
  expenseCount: number;
  repay: number;
  entryCount: number;
};

/** 与旧 finance-module 的 summarize 同口径：仅消费口径排除还款/转账流出。 */
function finSummarize(
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

/* ── 图片记账：本地 OCR 提取（规则独立成函数，方便调参）──
 * 金额：优先「金额类标签」后面的数字 → 其次 ¥ 标记的最大值 → 其次
 * 两位小数的最大值；都没有就返回 null（上层留空让用户补，不瞎填）。
 * 日期：YYYY-MM-DD / YYYY/MM/DD / YYYY年M月D日 / M月D日（当年）。
 * 对方：「收款方/商户/对方」行文本，否则已知平台名。
 * 分类：关键词规则（顺序即优先级），兜底「其他」。 */
export type BillExtract = {
  amount: number | null;
  date: string | null;
  counterparty: string | null;
  category: string;
};

const OCR_CATEGORY_RULES: { category: string; re: RegExp }[] = [
  { category: "还款", re: /分付|花呗|白条|信用卡还款|还款/ },
  {
    category: "餐饮",
    re: /餐饮|餐厅|食堂|面馆|拉面|面条|米线|小吃|火锅|烧烤|咖啡|奶茶|外卖|美团|饿了么|饭店|吃饭/,
  },
  { category: "交通", re: /滴滴|打车|地铁|公交|加油|停车|出行|高铁|火车票|机票/ },
  { category: "购物", re: /淘宝|天猫|京东|拼多多|抖音电商|商城|购物/ },
  { category: "日用", re: /超市|便利店|日用|药房|水费|电费|燃气|话费/ },
];

export function extractBillFields(rawText: string): BillExtract {
  /* OCR（chi_sim）实测特性：中文字间会带空格、¥ 常被读成「半」、
   * 「收款方」可能读成「收蒜方」。先按行去掉全部空白再匹配，
   * 标签与数字之间容忍少量杂字，对方行用模糊标签兜底。 */
  const text = rawText
    .replace(/,/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, ""))
    .join("\n");
  let amount: number | null = null;
  const labeled = text.match(
    /(?:付款金额|实付金额|实付|实际付款|支付金额|消费金额|交易金额|订单金额|总金额|金额)[^0-9]{0,4}?(\d+(?:\.\d{1,2})?)/,
  );
  if (labeled) {
    const v = parseFloat(labeled[1]);
    if (Number.isFinite(v) && v > 0) amount = finRound2(v);
  }
  if (amount === null) {
    const yen = [...text.matchAll(/[¥￥]\s*(\d+(?:\.\d{1,2})?)/g)]
      .map((m) => parseFloat(m[1]))
      .filter((v) => Number.isFinite(v) && v > 0);
    if (yen.length > 0) amount = finRound2(Math.max(...yen));
  }
  if (amount === null) {
    const dec = [...text.matchAll(/(\d+\.\d{2})(?!\d)/g)]
      .map((m) => parseFloat(m[1]))
      .filter((v) => Number.isFinite(v) && v > 0 && v < 1000000);
    if (dec.length > 0) amount = finRound2(Math.max(...dec));
  }

  let date: string | null = null;
  const dm =
    text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/) ??
    text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (dm) {
    const mo = Number(dm[2]);
    const da = Number(dm[3]);
    if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31)
      date = `${dm[1]}-${finPad2(mo)}-${finPad2(da)}`;
  }
  if (date === null) {
    const md = text.match(/(\d{1,2})月(\d{1,2})日/);
    if (md) {
      const mo = Number(md[1]);
      const da = Number(md[2]);
      if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31)
        date = `${new Date().getFullYear()}-${finPad2(mo)}-${finPad2(da)}`;
    }
  }

  let counterparty: string | null = null;
  for (const line of text.split(/\n/)) {
    const m = line.match(
      /(?:收.方|收款人|商户名称|商户|对方|付款给|卖家)[:：]?(.+)$/,
    );
    if (m) {
      const v = m[1].trim();
      if (v.length >= 2) {
        counterparty = v.slice(0, 24);
        break;
      }
    }
  }
  if (counterparty === null) {
    for (const b of [
      "美团",
      "饿了么",
      "滴滴出行",
      "淘宝",
      "京东",
      "拼多多",
      "天猫",
      "星巴克",
      "麦当劳",
      "肯德基",
    ]) {
      if (text.includes(b)) {
        counterparty = b;
        break;
      }
    }
  }

  let category = "其他";
  for (const rule of OCR_CATEGORY_RULES) {
    if (rule.re.test(text)) {
      category = rule.category;
      break;
    }
  }
  return { amount, date, counterparty, category };
}

type OcrWorkerLike = {
  recognize: (img: File) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<unknown>;
};

type OcrDraft = {
  date: string;
  kind: "income" | "expense";
  amount: string;
  category: string;
  note: string;
  thumb: string;
  amountMissing: boolean;
};

function FinField({
  label,
  w,
  children,
}: {
  label: string;
  w?: number;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        ...(w ? { width: w, flex: "none" } : { flex: "1 1 120px" }),
      }}
    >
      <span className="hud-module-note">{label}</span>
      {children}
    </label>
  );
}

function FinStat({
  k,
  v,
  sub,
  testid,
  data,
}: {
  k: string;
  v: React.ReactNode;
  sub?: string;
  testid: string;
  data?: Record<string, string | number>;
}) {
  const dataProps: Record<string, string> = {};
  if (data) {
    for (const [key, val] of Object.entries(data))
      dataProps[`data-${key}`] = String(val);
  }
  return (
    <div className="hud-module-stat" data-testid={testid} {...dataProps}>
      <div className="hud-module-stat-v">{v}</div>
      <div className="hud-module-stat-k">{k}</div>
      {sub ? (
        <div className="hud-module-note" style={{ marginTop: 3 }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function FinanceBody() {
  const [entries, setEntries] = React.useState<FinanceEntry[]>([]);
  const [liabilities, setLiabilities] = React.useState<FinanceLiability[]>([]);
  const [assets, setAssets] = React.useState<FinanceAsset[]>([]);
  const [budget, setBudget] = React.useState<number | null>(null);
  const [toast, setToast] = React.useState("");
  const toastTimer = React.useRef<number | undefined>(undefined);
  const showToast = React.useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  }, []);

  /* 读取：与 page.tsx 完全相同的校验与播种语义。 */
  React.useEffect(() => {
    try {
      const rawE = window.localStorage.getItem(FIN_ENTRIES_KEY);
      let loaded: FinanceEntry[] = [];
      if (rawE) {
        const arr = JSON.parse(rawE) as FinanceEntry[];
        if (Array.isArray(arr)) {
          loaded = arr.filter(
            (e) =>
              e &&
              typeof e.id === "string" &&
              typeof e.date === "string" &&
              /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
              (e.kind === "income" || e.kind === "expense") &&
              typeof e.amount === "number" &&
              Number.isFinite(e.amount) &&
              typeof e.category === "string",
          );
        }
      }
      if (!window.localStorage.getItem(FIN_SEEDED_KEY)) {
        if (!rawE) {
          loaded = [...FIN_SEED_ENTRIES];
          window.localStorage.setItem(
            FIN_ENTRIES_KEY,
            JSON.stringify(loaded),
          );
        }
        window.localStorage.setItem(FIN_SEEDED_KEY, "1");
      }
      setEntries(loaded);
      const rawL = window.localStorage.getItem(FIN_LIABILITIES_KEY);
      if (rawL) {
        const arr = JSON.parse(rawL) as FinanceLiability[];
        if (Array.isArray(arr)) {
          setLiabilities(
            arr.filter(
              (l) =>
                l &&
                typeof l.id === "string" &&
                typeof l.name === "string" &&
                typeof l.total === "number" &&
                typeof l.remaining === "number",
            ),
          );
        }
      }
      const rawA = window.localStorage.getItem(FIN_ASSETS_KEY);
      if (rawA) {
        const arr = JSON.parse(rawA) as FinanceAsset[];
        if (Array.isArray(arr)) {
          setAssets(
            arr.filter(
              (a) =>
                a &&
                typeof a.id === "string" &&
                typeof a.name === "string" &&
                typeof a.cost === "number",
            ),
          );
        }
      }
      const rawB = window.localStorage.getItem(FIN_BUDGET_KEY);
      if (rawB) {
        const n = Number(rawB);
        if (Number.isFinite(n) && n > 0) setBudget(n);
      }
    } catch {
      /* storage unavailable → 空态 */
    }
  }, []);

  const saveEntries = (next: FinanceEntry[]) => {
    setEntries(next);
    try {
      window.localStorage.setItem(FIN_ENTRIES_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };
  const saveLiabilities = (next: FinanceLiability[]) => {
    setLiabilities(next);
    try {
      window.localStorage.setItem(FIN_LIABILITIES_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };
  const saveAssets = (next: FinanceAsset[]) => {
    setAssets(next);
    try {
      window.localStorage.setItem(FIN_ASSETS_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };
  const saveBudget = (n: number | null) => {
    setBudget(n);
    try {
      if (n === null) window.localStorage.removeItem(FIN_BUDGET_KEY);
      else window.localStorage.setItem(FIN_BUDGET_KEY, String(n));
    } catch {
      /* storage unavailable */
    }
  };

  const addEntry = (data: Omit<FinanceEntry, "id">) => {
    const entry: FinanceEntry = { ...data, id: `fin-${Date.now()}` };
    saveEntries([...entries, entry]);
    /* 业务总线（hud-bus-pulse）：手工记账与 OCR 确认入账共用这一条
     * 新增路径，落盘后只发一次 FINANCE_ADD_ENTRY。detail 带类别与
     * 金额（hud-ux-dock），终端拼成「[财务] 新增记录：日用 ¥22」。 */
    emit("FINANCE_ADD_ENTRY", "finance", `${data.category} ¥${data.amount}`);
    return entry;
  };

  /* ---- 派生（概览与月度报告共用口径） ---- */
  const [scope, setScope] = React.useState<FinScope>("all");
  const nowMonth = currentMonthKey();
  const [reportMonth, setReportMonth] = React.useState<string>(nowMonth);
  const reportMonths = React.useMemo(() => {
    const set = new Set(entries.map((e) => finMonthOf(e.date)));
    set.add(nowMonth);
    return [...set].sort().reverse();
  }, [entries, nowMonth]);
  const activeReportMonth = reportMonths.includes(reportMonth)
    ? reportMonth
    : nowMonth;
  const ov = React.useMemo(
    () => finSummarize(entries, nowMonth, scope),
    [entries, nowMonth, scope],
  );
  const rp = React.useMemo(
    () => finSummarize(entries, activeReportMonth, scope),
    [entries, activeReportMonth, scope],
  );
  const rpPrev = React.useMemo(
    () => finSummarize(entries, finPrevMonthKey(activeReportMonth), scope),
    [entries, activeReportMonth, scope],
  );
  const totalAllOut = React.useMemo(
    () =>
      finRound2(
        entries
          .filter((e) => e.kind === "expense")
          .reduce((s, e) => s + e.amount, 0),
      ),
    [entries],
  );
  const liabTotal = finRound2(liabilities.reduce((s, l) => s + l.remaining, 0));
  const liabMin = finRound2(
    liabilities.reduce((s, l) => s + (l.minPayment ?? 0), 0),
  );
  const liabAdvice = React.useMemo(() => {
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
  const assetCost = finRound2(assets.reduce((s, a) => s + a.cost, 0));
  const assetsWithValue = assets.filter((a) => typeof a.value === "number");
  const assetValue =
    assetsWithValue.length > 0
      ? finRound2(assetsWithValue.reduce((s, a) => s + (a.value ?? 0), 0))
      : null;
  const budgetRemaining = budget !== null ? finRound2(budget - ov.outflow) : null;
  const budgetPct =
    budget !== null && budget > 0
      ? Math.min(100, Math.round((ov.outflow / budget) * 100))
      : 0;
  const rpBudgetRemaining =
    budget !== null ? finRound2(budget - rp.outflow) : null;
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
  const reportByCategory = React.useMemo(() => {
    const map = new Map<string, { out: number; inc: number; n: number }>();
    for (const e of entries) {
      if (finMonthOf(e.date) !== activeReportMonth) continue;
      const cur = map.get(e.category) ?? { out: 0, inc: 0, n: 0 };
      if (e.kind === "expense") cur.out += e.amount;
      else cur.inc += e.amount;
      cur.n += 1;
      map.set(e.category, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].out - a[1].out);
  }, [entries, activeReportMonth]);

  /* ---- 记账表单（新增 / 行内编辑） ---- */
  const [editingEntryId, setEditingEntryId] = React.useState<string | null>(null);
  const [entryForm, setEntryForm] = React.useState({
    date: finTodayStr(),
    kind: "expense" as "income" | "expense",
    amount: "",
    category: "",
    note: "",
  });
  const resetEntryForm = () => {
    setEditingEntryId(null);
    setEntryForm({
      date: finTodayStr(),
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
    const payload: Omit<FinanceEntry, "id" | "source"> = {
      date: entryForm.date,
      kind: entryForm.kind,
      amount: finRound2(amount),
      category: entryForm.category.trim(),
      ...(entryForm.note.trim() ? { note: entryForm.note.trim() } : {}),
    };
    if (editingEntryId) {
      saveEntries(
        entries.map((e) => (e.id === editingEntryId ? { ...e, ...payload } : e)),
      );
      showToast("明细已更新");
    } else {
      addEntry(payload);
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

  /* ---- 负债表单 ---- */
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
    setLiabForm({ name: "", total: "", remaining: "", rate: "", min: "", note: "" });
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
    const rate = liabForm.rate.trim() === "" ? undefined : Number(liabForm.rate);
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
      total: finRound2(total),
      remaining: finRound2(remaining),
      ...(rate !== undefined ? { annualRate: rate } : {}),
      ...(min !== undefined ? { minPayment: finRound2(min) } : {}),
      ...(liabForm.note.trim() ? { note: liabForm.note.trim() } : {}),
    };
    if (editingLiabId) {
      saveLiabilities(
        liabilities.map((l) => (l.id === editingLiabId ? { ...l, ...payload } : l)),
      );
      showToast("负债已更新");
    } else {
      saveLiabilities([...liabilities, { ...payload, id: `finl-${Date.now()}` }]);
      showToast("负债已添加");
    }
    resetLiabForm();
  };

  /* ---- 资产表单 ---- */
  const [editingAssetId, setEditingAssetId] = React.useState<string | null>(null);
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
      cost: finRound2(cost),
      ...(value !== undefined ? { value: finRound2(value) } : {}),
    };
    if (editingAssetId) {
      saveAssets(assets.map((a) => (a.id === editingAssetId ? { ...a, ...payload } : a)));
      showToast("资产已更新");
    } else {
      saveAssets([...assets, { ...payload, id: `fina-${Date.now()}` }]);
      showToast("资产已添加");
    }
    resetAssetForm();
  };

  /* ---- 预算编辑（概览卡内） ---- */
  const [budgetDraft, setBudgetDraft] = React.useState("");
  const [budgetEditing, setBudgetEditing] = React.useState(false);
  const applyBudget = () => {
    const n = Number(budgetDraft);
    if (!Number.isFinite(n) || n <= 0) {
      showToast("预算要大于 0");
      return;
    }
    saveBudget(finRound2(n));
    setBudgetEditing(false);
    showToast("月度预算已保存");
  };

  /* ---- 图片记账（本地 OCR） ---- */
  const [ocrOpen, setOcrOpen] = React.useState(false);
  const [ocrBusy, setOcrBusy] = React.useState(false);
  const [ocrMsg, setOcrMsg] = React.useState("");
  const [ocrDraft, setOcrDraft] = React.useState<OcrDraft | null>(null);
  const ocrFileRef = React.useRef<HTMLInputElement | null>(null);
  const ocrWorkerRef = React.useRef<OcrWorkerLike | null>(null);
  const ocrDraftRef = React.useRef<OcrDraft | null>(null);
  ocrDraftRef.current = ocrDraft;
  React.useEffect(() => {
    const worker = ocrWorkerRef.current;
    return () => {
      if (ocrDraftRef.current) URL.revokeObjectURL(ocrDraftRef.current.thumb);
      if (worker) {
        ocrWorkerRef.current = null;
        void worker.terminate().catch(() => undefined);
      }
    };
  }, []);
  const clearOcrDraft = () => {
    if (ocrDraft) URL.revokeObjectURL(ocrDraft.thumb);
    setOcrDraft(null);
  };
  const runOcr = async (file: File) => {
    if (ocrBusy) return;
    clearOcrDraft();
    setOcrBusy(true);
    setOcrMsg("正在加载本地识别引擎…");
    const thumb = URL.createObjectURL(file);
    try {
      if (!ocrWorkerRef.current) {
        const Tesseract = await import("tesseract.js");
        const worker = await Tesseract.createWorker(
          "chi_sim",
          Tesseract.OEM.LSTM_ONLY,
          {
            workerPath: "/ocr/worker.min.js",
            corePath: "/ocr",
            langPath: "/ocr",
            gzip: true,
            cacheMethod: "none",
            logger: (m) => {
              if (m.status === "recognizing text") {
                setOcrMsg(`识别中 ${Math.round(m.progress * 100)}%`);
              }
            },
          },
        );
        ocrWorkerRef.current = worker as unknown as OcrWorkerLike;
      }
      setOcrMsg("识别中 0%");
      const res = await ocrWorkerRef.current.recognize(file);
      const ex = extractBillFields(res.data.text ?? "");
      setOcrDraft({
        date: ex.date ?? finTodayStr(),
        kind: "expense",
        amount: ex.amount !== null ? String(ex.amount) : "",
        category: ex.category,
        note: ex.counterparty ?? "",
        thumb,
        amountMissing: ex.amount === null,
      });
      setOcrMsg(
        ex.amount === null
          ? "识别完成，但金额没认出来，请在下面手动补上再确认"
          : "识别完成，请核对下面这条，确认后才入账",
      );
    } catch {
      URL.revokeObjectURL(thumb);
      setOcrMsg("识别失败：请换一张更清晰的图，或用下面的表单手动记一笔");
    } finally {
      setOcrBusy(false);
    }
  };
  const confirmOcrDraft = () => {
    if (!ocrDraft) return;
    const amount = Number(ocrDraft.amount);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ocrDraft.date)) {
      showToast("先补一个日期");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("金额没认出来，请手动补一个大于 0 的金额");
      return;
    }
    if (!ocrDraft.category.trim()) {
      showToast("先填分类");
      return;
    }
    addEntry({
      date: ocrDraft.date,
      kind: ocrDraft.kind,
      amount: finRound2(amount),
      category: ocrDraft.category.trim(),
      ...(ocrDraft.note.trim() ? { note: ocrDraft.note.trim() } : {}),
      source: "ocr",
    });
    clearOcrDraft();
    setOcrMsg("");
    showToast("已记一笔（图片识别）");
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
  const finInputCls = "hud-module-input";
  const finInputStyle = { marginBottom: 0 } as const;

  return (
    <div data-testid="hud-fin-view">
      {toast ? (
        <p
          className="hud-module-note"
          data-testid="hud-fin-toast"
          style={{ marginBottom: 8, color: "var(--hud-yellow)" }}
        >
          {toast}
        </p>
      ) : null}

      {/* ---------- 概览 ---------- */}
      <div data-testid="hud-fin-overview">
        <SecHead
          title="概览"
          en="OVERVIEW"
          right={
            <span className="hud-module-note">
              数据存本机浏览器（与旧版同键）· 共 {entries.length} 条流水
            </span>
          }
        />
        <p className="hud-module-note" style={{ marginBottom: 8 }}>
          {finGreeting()}，这是你在 {finMonthLabel(nowMonth)} 的财务概览。{scopeNote}
          · 口径在月度报告里切换
        </p>
        <div className="hud-module-stats">
          <FinStat
            k={`本月净现金流 · ${finMonthLabel(nowMonth)}`}
            v={fmtMoney(ov.net)}
            sub={`收入 ${fmtMoney(ov.income)} · 流出 ${fmtMoney(ov.outflow)}`}
            testid="hud-fin-ov-netflow"
            data={{ income: ov.income, outflow: ov.outflow, net: ov.net }}
          />
          <FinStat
            k="本月支出"
            v={fmtMoney(ov.outflow)}
            sub={`共 ${ov.expenseCount} 条支出明细（当前口径）`}
            testid="hud-fin-ov-expense"
            data={{ amount: ov.outflow, count: ov.expenseCount }}
          />
          <FinStat
            k="累计支出 · 全部期间"
            v={fmtMoney(totalAllOut)}
            sub="全部口径 · 与旧汇总卡同数（由流水实时算）"
            testid="hud-fin-ov-total"
            data={{ amount: totalAllOut }}
          />
        </div>
        <div className="hud-module-stats">
          <div
            className="hud-module-stat"
            data-testid="hud-fin-ov-budget"
            data-budget={budget === null ? "none" : budget}
            data-remaining={budgetRemaining === null ? "none" : budgetRemaining}
            data-pct={budgetPct}
          >
            <div className="hud-module-stat-v">
              {budget === null
                ? "未设置"
                : fmtMoney(budgetRemaining ?? 0)}
            </div>
            <div className="hud-module-stat-k">预算剩余 · 本月</div>
            {budget === null ? (
              <div className="hud-module-note" style={{ marginTop: 3 }}>
                设一个月度预算，这里会显示剩余与进度。
              </div>
            ) : (
              <>
                <div className="hud-module-note" style={{ marginTop: 3 }}>
                  预算 {fmtMoney(budget)} · 已用 {budgetPct}%（按当前口径支出计）
                </div>
                <div
                  style={{
                    marginTop: 6,
                    height: 6,
                    background: "rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${budgetPct}%`,
                      background: "var(--hud-yellow)",
                    }}
                  />
                </div>
              </>
            )}
            {budgetEditing || budget === null ? (
              <div
                className="hud-module-form"
                style={{ marginTop: 8, marginBottom: 0 }}
              >
                <input
                  data-testid="hud-fin-budget-input"
                  type="number"
                  min="0"
                  className={finInputCls}
                  style={{ ...finInputStyle, width: 140 }}
                  value={budgetDraft}
                  onChange={(e) => setBudgetDraft(e.target.value)}
                  placeholder="月度预算（元）"
                />
                <button
                  type="button"
                  data-testid="hud-fin-budget-save"
                  className="hud-module-toggle"
                  onClick={applyBudget}
                >
                  保存
                </button>
                {budget !== null ? (
                  <>
                    <button
                      type="button"
                      className="hud-module-toggle"
                      onClick={() => setBudgetEditing(false)}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      data-testid="hud-fin-budget-clear"
                      className="hud-module-del"
                      onClick={() => {
                        saveBudget(null);
                        setBudgetEditing(false);
                        setBudgetDraft("");
                        showToast("月度预算已清除");
                      }}
                    >
                      清除
                    </button>
                  </>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                data-testid="hud-fin-budget-edit"
                className="hud-module-toggle"
                style={{ marginTop: 8 }}
                onClick={() => {
                  setBudgetDraft(String(budget));
                  setBudgetEditing(true);
                }}
              >
                修改预算
              </button>
            )}
          </div>
          <FinStat
            k="借款负债"
            v={liabilities.length === 0 ? "暂无负债" : fmtMoney(liabTotal)}
            sub={
              liabilities.length === 0
                ? "还没有负债记录，去下方「负债管理」添加第一笔。"
                : `${liabilities.length} 笔 · 月最低还款合计 ${fmtMoney(liabMin)}`
            }
            testid="hud-fin-ov-liab"
            data={{ total: liabTotal, count: liabilities.length }}
          />
          <FinStat
            k="追踪资产"
            v={assets.length === 0 ? "暂无资产" : fmtMoney(assetCost)}
            sub={
              assets.length === 0
                ? "还没有资产记录，去下方「资产台账」添加第一项。"
                : `${assets.length} 项持仓成本${assetValue !== null ? ` · 现值合计 ${fmtMoney(assetValue)}` : ""}`
            }
            testid="hud-fin-ov-asset"
            data={{
              count: assets.length,
              cost: assetCost,
              value: assetValue === null ? "none" : assetValue,
            }}
          />
        </div>
      </div>

      {/* ---------- 记账明细 ---------- */}
      <div data-testid="hud-fin-entries-sec">
        <SecHead
          title="记账明细"
          en="ENTRIES"
          right={
            <button
              type="button"
              className="hud-module-toggle"
              data-testid="hud-fin-ocr-toggle"
              onClick={() => setOcrOpen((v) => !v)}
            >
              {ocrOpen ? "收起图片记账" : "图片记账 · 识别账单截图"}
            </button>
          }
        />
        {ocrOpen ? (
          <div
            data-testid="hud-fin-ocr-panel"
            style={{
              border: "1px solid rgba(0,255,255,0.25)",
              background: "rgba(6,8,16,0.65)",
              padding: 12,
              marginBottom: 12,
            }}
          >
            <div
              className="hud-module-form"
              style={{ marginBottom: ocrMsg || ocrDraft ? 8 : 0 }}
            >
              <input
                ref={ocrFileRef}
                type="file"
                accept="image/*"
                data-testid="hud-fin-ocr-file"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void runOcr(f);
                }}
              />
              <button
                type="button"
                className="hud-module-toggle"
                data-testid="hud-fin-ocr-pick"
                disabled={ocrBusy}
                onClick={() => ocrFileRef.current?.click()}
              >
                {ocrBusy ? "识别中…" : "选择账单截图 / 小票"}
              </button>
              <span className="hud-module-note" style={{ alignSelf: "center" }}>
                识别全在本机浏览器完成，图片不上传任何服务器
              </span>
            </div>
            {ocrMsg ? (
              <p className="hud-module-note" data-testid="hud-fin-ocr-status">
                {ocrMsg}
              </p>
            ) : null}
            {ocrDraft ? (
              <div data-testid="hud-fin-ocr-draft" style={{ marginTop: 10 }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ocrDraft.thumb}
                    alt="账单截图缩略图"
                    style={{
                      width: 76,
                      height: 76,
                      objectFit: "cover",
                      border: "1px solid rgba(0,255,255,0.3)",
                      flex: "none",
                    }}
                  />
                  <div
                    className="hud-module-form"
                    style={{ flex: "1 1 320px", marginBottom: 0 }}
                  >
                    <FinField label="日期" w={140}>
                      <input
                        type="date"
                        data-testid="hud-fin-ocr-date"
                        className={finInputCls}
                        style={finInputStyle}
                        value={ocrDraft.date}
                        onChange={(e) =>
                          setOcrDraft({ ...ocrDraft, date: e.target.value })
                        }
                      />
                    </FinField>
                    <FinField label="类型" w={96}>
                      <select
                        data-testid="hud-fin-ocr-kind"
                        className={finInputCls}
                        style={finInputStyle}
                        value={ocrDraft.kind}
                        onChange={(e) =>
                          setOcrDraft({
                            ...ocrDraft,
                            kind: e.target.value as "income" | "expense",
                          })
                        }
                      >
                        <option value="expense">支出</option>
                        <option value="income">收入</option>
                      </select>
                    </FinField>
                    <FinField label="金额（元）" w={120}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        data-testid="hud-fin-ocr-amount"
                        className={finInputCls}
                        style={finInputStyle}
                        value={ocrDraft.amount}
                        placeholder={ocrDraft.amountMissing ? "没认出来，请手动补" : "0.00"}
                        onChange={(e) =>
                          setOcrDraft({ ...ocrDraft, amount: e.target.value })
                        }
                      />
                    </FinField>
                    <FinField label="分类" w={120}>
                      <input
                        data-testid="hud-fin-ocr-category"
                        className={finInputCls}
                        style={finInputStyle}
                        value={ocrDraft.category}
                        list="hud-fin-category-list"
                        onChange={(e) =>
                          setOcrDraft({ ...ocrDraft, category: e.target.value })
                        }
                      />
                    </FinField>
                    <FinField label="备注（对方）">
                      <input
                        data-testid="hud-fin-ocr-note"
                        className={finInputCls}
                        style={finInputStyle}
                        value={ocrDraft.note}
                        placeholder="收款方 / 商户"
                        onChange={(e) =>
                          setOcrDraft({ ...ocrDraft, note: e.target.value })
                        }
                      />
                    </FinField>
                  </div>
                </div>
                {ocrDraft.amountMissing ? (
                  <p
                    className="hud-module-note"
                    data-testid="hud-fin-ocr-warn"
                    style={{ marginTop: 8, color: "var(--hud-yellow)" }}
                  >
                    金额没认出来，请手动补上再确认入账
                  </p>
                ) : null}
                <div className="hud-module-form" style={{ marginTop: 10, marginBottom: 0 }}>
                  <button
                    type="button"
                    className="hud-module-toggle"
                    data-testid="hud-fin-ocr-confirm"
                    onClick={confirmOcrDraft}
                  >
                    确认入账
                  </button>
                  <button
                    type="button"
                    className="hud-module-del"
                    data-testid="hud-fin-ocr-discard"
                    onClick={() => {
                      clearOcrDraft();
                      setOcrMsg("");
                    }}
                  >
                    丢弃
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <form
          className="hud-module-form"
          onSubmit={(e) => {
            e.preventDefault();
            submitEntry();
          }}
        >
          <FinField label="日期" w={150}>
            <input
              data-testid="hud-fin-entry-date"
              type="date"
              className={finInputCls}
              style={finInputStyle}
              value={entryForm.date}
              onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })}
            />
          </FinField>
          <FinField label="类型" w={96}>
            <select
              data-testid="hud-fin-entry-kind"
              className={finInputCls}
              style={finInputStyle}
              value={entryForm.kind}
              onChange={(e) =>
                setEntryForm({
                  ...entryForm,
                  kind: e.target.value as "income" | "expense",
                })
              }
            >
              <option value="expense">支出</option>
              <option value="income">收入</option>
            </select>
          </FinField>
          <FinField label="金额（元）" w={120}>
            <input
              data-testid="hud-fin-entry-amount"
              type="number"
              min="0"
              step="0.01"
              className={finInputCls}
              style={finInputStyle}
              value={entryForm.amount}
              placeholder="0.00"
              onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })}
            />
          </FinField>
          <FinField label="分类" w={130}>
            <input
              data-testid="hud-fin-entry-category"
              className={finInputCls}
              style={finInputStyle}
              value={entryForm.category}
              placeholder="日用 / 还款 / 工资…"
              list="hud-fin-category-list"
              onChange={(e) => setEntryForm({ ...entryForm, category: e.target.value })}
            />
          </FinField>
          <datalist id="hud-fin-category-list">
            {FIN_CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <FinField label="备注（可选）">
            <input
              data-testid="hud-fin-entry-note"
              className={finInputCls}
              style={finInputStyle}
              value={entryForm.note}
              placeholder="这笔钱花在哪"
              onChange={(e) => setEntryForm({ ...entryForm, note: e.target.value })}
            />
          </FinField>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
            <button
              type="submit"
              data-testid="hud-fin-entry-submit"
              className="hud-module-toggle"
            >
              {editingEntryId ? "保存修改" : "记一笔"}
            </button>
            {editingEntryId ? (
              <button
                type="button"
                className="hud-module-toggle"
                onClick={resetEntryForm}
              >
                取消
              </button>
            ) : null}
          </div>
        </form>

        <div data-testid="hud-fin-entries" data-count={entries.length}>
          {sortedEntries.length === 0 ? (
            <div className="hud-module-zone-empty">
              还没有记账明细 · 用上面的表单记第一笔，或用图片记账识别账单截图
            </div>
          ) : (
            sortedEntries.map((e) => (
              <Row key={e.id} testid={`hud-fin-entry-${e.id}`}>
                <span className="hud-module-note">{e.date}</span>
                <div className="hud-module-row-main">
                  <div className="hud-module-row-t">
                    {e.category}
                    {e.source === "ledger" ? (
                      <span className="hud-chip hud-c-pur" style={{ marginLeft: 6 }}>
                        台账导入
                      </span>
                    ) : null}
                    {e.source === "ocr" ? (
                      <span className="hud-chip hud-c-grn" style={{ marginLeft: 6 }}>
                        图片识别
                      </span>
                    ) : null}
                  </div>
                  <div className="hud-module-row-src">
                    {e.kind === "income" ? "收入" : "支出"}
                    {e.note ? ` · ${e.note}` : ""}
                  </div>
                </div>
                <span
                  className="hud-module-amt"
                  style={
                    e.kind === "income"
                      ? { color: "#4ade80", textShadow: "0 0 9px rgba(74,222,128,0.4)" }
                      : undefined
                  }
                >
                  {e.kind === "income" ? "+" : "−"}
                  {fmtMoney(e.amount)}
                </span>
                <button
                  type="button"
                  className="hud-module-toggle"
                  data-testid={`hud-fin-entry-edit-${e.id}`}
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
                  编辑
                </button>
                <InlineConfirmButton
                  label="删除"
                  confirmLabel="确认删除"
                  testId={`hud-fin-entry-del-${e.id}`}
                  ariaLabel={`删除明细 ${e.date} ${e.category}`}
                  className="hud-module-del"
                  onConfirm={() => {
                    saveEntries(entries.filter((x) => x.id !== e.id));
                    if (editingEntryId === e.id) resetEntryForm();
                    showToast("明细已删除");
                    emit(
                      "FINANCE_DELETE_ENTRY",
                      "finance",
                      `${e.category} ¥${e.amount}`,
                    );
                  }}
                />
              </Row>
            ))
          )}
        </div>
      </div>

      {/* ---------- 月度报告 ---------- */}
      <div data-testid="hud-fin-report">
        <SecHead
          title="月度报告"
          en="MONTHLY REPORT"
          right={
            <button
              type="button"
              className="hud-module-toggle"
              data-testid="hud-fin-print"
              onClick={() => window.print()}
            >
              导出（简版打印）
            </button>
          }
        />
        <div className="hud-module-form">
          <FinField label="账期" w={170}>
            <select
              data-testid="hud-fin-report-month"
              className={finInputCls}
              style={finInputStyle}
              value={activeReportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
            >
              {reportMonths.map((mk) => (
                <option key={mk} value={mk}>
                  {finMonthLabel(mk)}
                </option>
              ))}
            </select>
          </FinField>
          <FinField label="统计口径">
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                data-testid="hud-fin-scope-all"
                className={scope === "all" ? "hud-pickbtn hud-pickbtn-on" : "hud-pickbtn"}
                onClick={() => setScope("all")}
              >
                全部资金流出
              </button>
              <button
                type="button"
                data-testid="hud-fin-scope-consume"
                className={scope === "consume" ? "hud-pickbtn hud-pickbtn-on" : "hud-pickbtn"}
                onClick={() => setScope("consume")}
              >
                仅消费
              </button>
            </div>
          </FinField>
        </div>
        <p className="hud-module-note" style={{ marginBottom: 8 }}>
          「仅消费」排除分类含「还款」「转账」的流出；净现金流随口径计算，
          概览与本报告共用同一口径。
        </p>
        <div className="hud-module-stats">
          <FinStat
            k={`净现金流 · ${finMonthLabel(activeReportMonth)}`}
            v={fmtMoney(rp.net)}
            sub={`收入 ${fmtMoney(rp.income)} · 流出 ${fmtMoney(rp.outflow)}`}
            testid="hud-fin-rp-netflow"
            data={{ income: rp.income, outflow: rp.outflow, net: rp.net }}
          />
          <FinStat
            k="本月支出"
            v={fmtMoney(rp.outflow)}
            sub={`共 ${rp.expenseCount} 条支出明细（当前口径）`}
            testid="hud-fin-rp-expense"
            data={{ amount: rp.outflow, count: rp.expenseCount }}
          />
          <FinStat
            k="预算剩余"
            v={budget === null ? "未设置" : fmtMoney(rpBudgetRemaining ?? 0)}
            sub={
              budget === null
                ? "在上方概览的预算卡里设置月度预算。"
                : `预算 ${fmtMoney(budget)} · 已用 ${rpBudgetPct}%`
            }
            testid="hud-fin-rp-budget"
            data={{
              budget: budget === null ? "none" : budget,
              remaining: rpBudgetRemaining === null ? "none" : rpBudgetRemaining,
              pct: rpBudgetPct,
            }}
          />
        </div>
        <div className="hud-module-stats">
          <FinStat
            k="偿还负债"
            v={fmtMoney(rp.repay)}
            sub="来自分类为「还款」的支出 · 本金/利息/手续费未拆分"
            testid="hud-fin-rp-repay"
            data={{ amount: rp.repay }}
          />
          <FinStat
            k="追踪资产"
            v={`${assets.length} 项`}
            sub={`持仓成本合计 ${fmtMoney(assetCost)} · 手动维护，不接行情`}
            testid="hud-fin-rp-assets"
            data={{ count: assets.length, cost: assetCost }}
          />
          <FinStat
            k="本月关键变化"
            v={<span data-testid="hud-fin-rp-change-text">{changeText}</span>}
            sub="规则生成：本月支出与上月同口径对比"
            testid="hud-fin-rp-change"
          />
        </div>
        <SecHead title="分类小计" en="BY CATEGORY" />
        {reportByCategory.length === 0 ? (
          <div className="hud-module-zone-empty">
            {finMonthLabel(activeReportMonth)} 还没有流水
          </div>
        ) : (
          reportByCategory.map(([cat, v]) => (
            <div className="hud-module-kv" key={cat}>
              <span>{cat}</span>
              <b>
                {v.out > 0 ? `支出 ${fmtMoney(v.out)}` : ""}
                {v.out > 0 && v.inc > 0 ? " · " : ""}
                {v.inc > 0 ? `收入 ${fmtMoney(v.inc)}` : ""} · {v.n} 笔
              </b>
            </div>
          ))
        )}
      </div>

      {/* ---------- 负债管理 ---------- */}
      <div data-testid="hud-fin-liabs-sec">
        <SecHead title="负债管理" en="LIABILITIES" />
        <div
          data-testid="hud-fin-liab-summary"
          data-total={liabTotal}
          data-min={liabMin}
          data-count={liabilities.length}
        >
          <Kv k="总负债">{fmtMoney(liabTotal)}</Kv>
          <Kv k="月最低还款合计">{fmtMoney(liabMin)}</Kv>
          <Kv k="笔数">{liabilities.length} 笔</Kv>
        </div>
        <p className="hud-module-note" style={{ margin: "8px 0" }}>
          优先偿还建议（规则 · 按利率优先）：
          {liabAdvice
            ? `先还「${liabAdvice.name}」：年化利率 ${liabAdvice.annualRate}% 为当前最高，剩余 ${fmtMoney(liabAdvice.remaining)}，优先偿还能减少利息支出。`
            : liabilities.length > 0
              ? "已记录的负债暂未填写年化利率，补上利率后这里会按从高到低给出优先顺序。"
              : "暂无负债记录。添加负债并填写年化利率后，这里会给出优先偿还建议。"}
        </p>
        <form
          className="hud-module-form"
          onSubmit={(e) => {
            e.preventDefault();
            submitLiab();
          }}
        >
          <FinField label="名称">
            <input
              data-testid="hud-fin-liab-name"
              className={finInputCls}
              style={finInputStyle}
              value={liabForm.name}
              placeholder="如 微信分付"
              onChange={(e) => setLiabForm({ ...liabForm, name: e.target.value })}
            />
          </FinField>
          <FinField label="总额（元）" w={120}>
            <input
              data-testid="hud-fin-liab-total"
              type="number"
              min="0"
              step="0.01"
              className={finInputCls}
              style={finInputStyle}
              value={liabForm.total}
              placeholder="0.00"
              onChange={(e) => setLiabForm({ ...liabForm, total: e.target.value })}
            />
          </FinField>
          <FinField label="剩余（空=同总额）" w={140}>
            <input
              data-testid="hud-fin-liab-remaining"
              type="number"
              min="0"
              step="0.01"
              className={finInputCls}
              style={finInputStyle}
              value={liabForm.remaining}
              placeholder="0.00"
              onChange={(e) => setLiabForm({ ...liabForm, remaining: e.target.value })}
            />
          </FinField>
          <FinField label="年化利率 %（可选）" w={130}>
            <input
              data-testid="hud-fin-liab-rate"
              type="number"
              min="0"
              step="0.01"
              className={finInputCls}
              style={finInputStyle}
              value={liabForm.rate}
              placeholder="如 18"
              onChange={(e) => setLiabForm({ ...liabForm, rate: e.target.value })}
            />
          </FinField>
          <FinField label="月最低还款（可选）" w={140}>
            <input
              data-testid="hud-fin-liab-min"
              type="number"
              min="0"
              step="0.01"
              className={finInputCls}
              style={finInputStyle}
              value={liabForm.min}
              placeholder="0.00"
              onChange={(e) => setLiabForm({ ...liabForm, min: e.target.value })}
            />
          </FinField>
          <FinField label="备注（可选）">
            <input
              data-testid="hud-fin-liab-note"
              className={finInputCls}
              style={finInputStyle}
              value={liabForm.note}
              placeholder="补充说明"
              onChange={(e) => setLiabForm({ ...liabForm, note: e.target.value })}
            />
          </FinField>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
            <button
              type="submit"
              data-testid="hud-fin-liab-submit"
              className="hud-module-toggle"
            >
              {editingLiabId ? "保存修改" : "添加负债"}
            </button>
            {editingLiabId ? (
              <button
                type="button"
                className="hud-module-toggle"
                onClick={resetLiabForm}
              >
                取消
              </button>
            ) : null}
          </div>
        </form>
        <div data-testid="hud-fin-liabs" data-count={liabilities.length}>
          {liabilities.length === 0 ? (
            <div className="hud-module-zone-empty">
              还没有负债记录 · 用上面的表单添加第一笔
            </div>
          ) : (
            liabilities.map((l) => (
              <Row key={l.id} testid={`hud-fin-liab-${l.id}`}>
                <div className="hud-module-row-main">
                  <div className="hud-module-row-t">
                    {l.name}
                    {l.note ? (
                      <span className="hud-module-note" style={{ marginLeft: 6 }}>
                        {l.note}
                      </span>
                    ) : null}
                  </div>
                  <div className="hud-module-row-src">
                    总额 {fmtMoney(l.total)}
                    {typeof l.annualRate === "number" ? ` · 年化 ${l.annualRate}%` : ""}
                    {typeof l.minPayment === "number" ? ` · 月最低 ${fmtMoney(l.minPayment)}` : ""}
                  </div>
                </div>
                <span className="hud-module-amt">剩 {fmtMoney(l.remaining)}</span>
                <button
                  type="button"
                  className="hud-module-toggle"
                  data-testid={`hud-fin-liab-edit-${l.id}`}
                  onClick={() => {
                    setEditingLiabId(l.id);
                    setLiabForm({
                      name: l.name,
                      total: String(l.total),
                      remaining: String(l.remaining),
                      rate: l.annualRate !== undefined ? String(l.annualRate) : "",
                      min: l.minPayment !== undefined ? String(l.minPayment) : "",
                      note: l.note ?? "",
                    });
                  }}
                >
                  编辑
                </button>
                <InlineConfirmButton
                  label="删除"
                  confirmLabel="确认删除"
                  testId={`hud-fin-liab-del-${l.id}`}
                  ariaLabel={`删除负债 ${l.name}`}
                  className="hud-module-del"
                  onConfirm={() => {
                    saveLiabilities(liabilities.filter((x) => x.id !== l.id));
                    if (editingLiabId === l.id) resetLiabForm();
                    showToast("负债已删除");
                  }}
                />
              </Row>
            ))
          )}
        </div>
      </div>

      {/* ---------- 资产台账 ---------- */}
      <div data-testid="hud-fin-assets-sec">
        <SecHead title="资产台账" en="ASSETS" />
        <div
          data-testid="hud-fin-asset-summary"
          data-count={assets.length}
          data-cost={assetCost}
          data-value={assetValue === null ? "none" : assetValue}
        >
          <Kv k="资产项数">{assets.length} 项</Kv>
          <Kv k="持仓成本合计">{fmtMoney(assetCost)}</Kv>
          <Kv k="现值合计">
            {assetValue === null ? "未填现值" : fmtMoney(assetValue)}
          </Kv>
        </div>
        <p className="hud-module-note" style={{ margin: "8px 0" }}>
          手动维护，不接行情。
        </p>
        <form
          className="hud-module-form"
          onSubmit={(e) => {
            e.preventDefault();
            submitAsset();
          }}
        >
          <FinField label="名称">
            <input
              data-testid="hud-fin-asset-name"
              className={finInputCls}
              style={finInputStyle}
              value={assetForm.name}
              placeholder="如 招商银行持仓"
              onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
            />
          </FinField>
          <FinField label="类型" w={110}>
            <select
              data-testid="hud-fin-asset-type"
              className={finInputCls}
              style={finInputStyle}
              value={assetForm.type}
              onChange={(e) =>
                setAssetForm({
                  ...assetForm,
                  type: e.target.value as FinanceAssetType,
                })
              }
            >
              {FINANCE_ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FinField>
          <FinField label="持仓成本（元）" w={140}>
            <input
              data-testid="hud-fin-asset-cost"
              type="number"
              min="0"
              step="0.01"
              className={finInputCls}
              style={finInputStyle}
              value={assetForm.cost}
              placeholder="0.00"
              onChange={(e) => setAssetForm({ ...assetForm, cost: e.target.value })}
            />
          </FinField>
          <FinField label="现值（元，可选）" w={140}>
            <input
              data-testid="hud-fin-asset-value"
              type="number"
              min="0"
              step="0.01"
              className={finInputCls}
              style={finInputStyle}
              value={assetForm.value}
              placeholder="不填则不计"
              onChange={(e) => setAssetForm({ ...assetForm, value: e.target.value })}
            />
          </FinField>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
            <button
              type="submit"
              data-testid="hud-fin-asset-submit"
              className="hud-module-toggle"
            >
              {editingAssetId ? "保存修改" : "添加资产"}
            </button>
            {editingAssetId ? (
              <button
                type="button"
                className="hud-module-toggle"
                onClick={resetAssetForm}
              >
                取消
              </button>
            ) : null}
          </div>
        </form>
        <div data-testid="hud-fin-assets" data-count={assets.length}>
          {assets.length === 0 ? (
            <div className="hud-module-zone-empty">
              还没有资产记录 · 用上面的表单添加第一项
            </div>
          ) : (
            assets.map((a) => (
              <Row key={a.id} testid={`hud-fin-asset-${a.id}`}>
                <div className="hud-module-row-main">
                  <div className="hud-module-row-t">
                    {a.name}
                    <span className="hud-chip hud-c-yel" style={{ marginLeft: 6 }}>
                      {a.type}
                    </span>
                  </div>
                  <div className="hud-module-row-src">
                    成本 {fmtMoney(a.cost)}
                    {typeof a.value === "number" ? ` · 现值 ${fmtMoney(a.value)}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  className="hud-module-toggle"
                  data-testid={`hud-fin-asset-edit-${a.id}`}
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
                  编辑
                </button>
                <InlineConfirmButton
                  label="删除"
                  confirmLabel="确认删除"
                  testId={`hud-fin-asset-del-${a.id}`}
                  ariaLabel={`删除资产 ${a.name}`}
                  className="hud-module-del"
                  onConfirm={() => {
                    saveAssets(assets.filter((x) => x.id !== a.id));
                    if (editingAssetId === a.id) resetAssetForm();
                    showToast("资产已删除");
                  }}
                />
              </Row>
            ))
          )}
        </div>
      </div>

      {/* ---------- AI 诊断（占位，走聊天回路） ---------- */}
      <div data-testid="hud-fin-ai" style={{ marginTop: 14 }}>
        <SecHead title="AI 资产诊断" en="AI DIAGNOSIS" />
        <p className="hud-module-note">
          自动诊断还在接入阶段。现在可以把当月数据摘要复制下来，发给 Luna
          在聊天里做诊断。
        </p>
        <button
          type="button"
          className="hud-module-toggle"
          data-testid="hud-fin-ai-copy"
          style={{ marginTop: 8 }}
          onClick={copyAiSummary}
        >
          复制本月摘要给 Luna
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────── 2 · health ─────────────────────────── */

function HealthBody() {
  const [sync, setSync] = React.useState<HealthSync | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [mediaMap, setMediaMap] = React.useState<HealthMediaMap>({});
  const [openVideoId, setOpenVideoId] = React.useState<string | null>(null);
  React.useEffect(() => {
    let live = true;
    fetch("/health-sync.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: HealthSync | null) => {
        if (!live) return;
        if (j) setSync(j);
        else setFailed(true);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    /* 教学视频映射（同旧模块口径）：拿不到就当没有，动作行只少按钮。 */
    fetch("/health-media.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: HealthMediaMap | null) => {
        if (live && j && typeof j === "object") setMediaMap(j);
      })
      .catch(() => {
        /* 媒体文件缺失时训练区保持纯文字，不报错 */
      });
    return () => {
      live = false;
    };
  }, []);
  const data: HealthSync = sync ?? HEALTH_SYNC_STATIC;
  /* ── manual clipboard record merge (2026-10-22, hud-health-sync) ──
   * The effective view follows the shared rule in health-effective
   * .ts (manualWins, by date): a manual record newer than (or the
   * same day as) the file's latest sleep record supplies the sleep
   * headline (and today's steps when its date is today); an older
   * manual record changes nothing here. The file's own fields are
   * never mutated — the merge is render-time only, and the manual
   * provenance is badged in the view. */
  const [manual, setManual] = React.useState<ManualHealth | null>(() =>
    loadManualHealth(),
  );
  React.useEffect(
    () => onManualHealthChange(() => setManual(loadManualHealth())),
    [],
  );
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const mWins = manualWins(manual, data.sleep?.last?.date ?? null);
  const manualSleep =
    mWins && manual && manual.sleepHours !== undefined ? manual : null;
  const last = manualSleep
    ? {
        date: manualSleep.date,
        start: manualSleep.sleepStart,
        end: manualSleep.sleepEnd,
        hours: manualSleep.sleepHours as number,
      }
    : data.sleep?.last;
  const last7 = manualSleep
    ? [
        ...(data.sleep?.last7 ?? []).filter((s) => s.date !== manualSleep.date),
        { date: manualSleep.date, hours: manualSleep.sleepHours as number },
      ]
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .slice(-7)
    : (data.sleep?.last7 ?? []);
  const stepsToday =
    mWins && manual && manual.steps !== undefined && manual.date === todayStr
      ? manual.steps
      : data.steps?.today;
  const stale = !last || last.date < todayStr;
  return (
    <div>
      <SecHead
        title="健康同步"
        en="HEALTH SYNC"
        right={
          <span className="hud-module-note">
            同步于 {data.updated_at?.slice(0, 16).replace("T", " ") ?? "—"} ·
            最近睡眠记录 {last?.date ?? "—"}
            {failed ? " · 实时拉取失败，显示站内副本" : ""}
          </span>
        }
      />
      <Kv k="状态">
        <span className={stale ? "hud-c-amb" : "hud-c-grn"}>
          {stale ? `STALE · 最近记录 ${last?.date?.slice(5) ?? "—"}` : "FRESH"}
        </span>
      </Kv>
      {mWins && manual ? (
        <Kv k="手动同步">
          <span className="hud-c-cyan" data-testid="hud-health-manual-badge">
            剪贴板解析口 · {manual.date}
            {manual.sleepHours !== undefined ? ` · 睡眠 ${manual.sleepHours}h` : ""}
            {manual.steps !== undefined ? ` · 步数 ${manual.steps}` : ""}
          </span>
        </Kv>
      ) : null}
      {last ? (
        <>
          <Kv k="最近一晚睡眠">
            {last.date}
            {last.start && last.end
              ? ` · ${last.start} 入睡 → ${last.end} 起床`
              : ""}{" "}
            · {last.hours}h
          </Kv>
          <div className="hud-module-bars" data-testid="hud-sleep-bars">
            {last7.map((s) => (
              <div key={s.date} className="hud-module-bar-row">
                <span className="hud-module-bar-d">{s.date.slice(5)}</span>
                <div className="hud-module-bar">
                  <i style={{ width: `${Math.min(100, (s.hours / 8) * 100)}%` }} />
                </div>
                <span className="hud-module-bar-v">{s.hours}h</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
      <Kv k="步数 · 近 7 日均值">
        {data.steps?.avg7 != null ? `${data.steps.avg7} 步` : "未同步"} · 今日{" "}
        {stepsToday != null ? `${stepsToday} 步` : "未同步"}
      </Kv>
      <Kv k="体重">
        {data.weight_kg != null ? `${data.weight_kg} kg` : "未同步"}
      </Kv>
      <SecHead
        title="训练记录"
        en="TRAINING"
        right={
          <span className="hud-module-note">
            计划源 塑形计划-轻器械高次数.md
          </span>
        }
      />
      <Kv k="计划">在家塑形 · 轻器械 × 高次数（第 1–2 周）</Kv>
      <Kv k="频率">周一 / 周三 / 周五 · 每次约 30 分钟 · 2026-10-19 起</Kv>
      <Kv k="完成记录">
        <span className="hud-c-amb">
          暂无确认记录 · 计划态（完成状态以本人确认为准，不代填）
        </span>
      </Kv>
      <Kv k="器械">{TRAINING_EQUIP.join(" · ")}</Kv>
      <div style={{ marginTop: 8 }}>
        {TRAINING_MOVES.map((m, i) => {
          const media = mediaMap[m.id];
          const open = openVideoId === m.id;
          return (
            <React.Fragment key={m.id}>
              <Row testid={`hud-train-${i}`}>
                <span className="hud-module-note">{`0${i + 1}`}</span>
                <div className="hud-module-row-main">
                  <div className="hud-module-row-t">{m.name}</div>
                  <div className="hud-module-row-sub">{m.cue}</div>
                </div>
                <span className="hud-chip hud-c-cyan">{m.reps}</span>
                <span className="hud-chip hud-c-dim">计划</span>
                {media?.embed ? (
                  <button
                    type="button"
                    className="hud-module-toggle"
                    data-testid={`hud-train-video-btn-${m.id}`}
                    onClick={() => setOpenVideoId(open ? null : m.id)}
                  >
                    {open ? "收起视频" : "教学视频"}
                  </button>
                ) : null}
                {media ? (
                  <a
                    className="hud-module-toggle hud-module-toggle-link"
                    data-testid={`hud-train-video-link-${m.id}`}
                    href={media.link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {media.source}
                  </a>
                ) : null}
              </Row>
              {open && media?.embed ? (
                <div
                  className="hud-module-video"
                  data-testid={`hud-train-video-${m.id}`}
                >
                  <div className="hud-module-video-frame">
                    <iframe
                      data-testid={`hud-train-iframe-${m.id}`}
                      src={media.embed}
                      title={media.title}
                      loading="lazy"
                      allowFullScreen
                    />
                  </div>
                  <p className="hud-module-video-cap">
                    {media.title} · 来源 {media.source} ·{" "}
                    <a href={media.link} target="_blank" rel="noreferrer">
                      原文链接
                    </a>
                  </p>
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
      <p className="hud-module-note">
        结构：热身 5 分钟 → 主训练 6 动作 ×2 组 → 拉伸 5 分钟；另有每日
        5 分钟体态修复（下巴后缩 / 靠墙站 / 髋屈肌拉伸 / 猫牛式）。练完在
        聊天里报「练完了」，Luna 记入完成记录。
      </p>
      {data.diet ? (
        <>
          <SecHead title="饮食" en="DIET" />
          <Kv k="蛋白目标">{data.diet.protein_target ?? "—"}</Kv>
          {data.diet.advice ? (
            <p className="hud-module-text">{data.diet.advice}</p>
          ) : null}
          {data.diet.principles ? (
            <p className="hud-module-text dim">{data.diet.principles}</p>
          ) : null}
        </>
      ) : null}
      {data.data_cutoff_note ? (
        <p className="hud-module-note" style={{ marginTop: 10 }}>
          {data.data_cutoff_note}
        </p>
      ) : null}
    </div>
  );
}

/* ─────────────────────────── 9 · ontology ─────────────────────────── */

/** 本体库名（Obsidian vault）的本机存储键——纯字符串，snapshot.ts
 * 已登记 obsidianVault 片。库名绝不硬编进代码：用户在自己电脑上
 * 的 Obsidian 库叫什么只有他知道，未填时不许拼链接乱开。 */
const OBSIDIAN_VAULT_KEY = "studio_obsidian_vault_v1";

/** 库内真实文件清单（镜像源：goals/ai-2/hidden_files/notes/ 目录，
 * 与 FINANCE_LEDGER_ENTRIES 镜像 ledger.csv 同例）。当前库内只有
 * 框架 README 一件——新笔记落盘后往这里补行，file 即文件名，
 * 也是 obsidian:// 协议里的 file 参数。 */
const ONTOLOGY_FILES: { file: string; title: string; tag: string }[] = [
  { file: "README.md", title: "第二大脑 · 框架说明", tag: "框架" },
];

function OntologyBody() {
  const [vault, setVault] = React.useState("");
  const [needVault, setNeedVault] = React.useState(false);
  const vaultInputRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    try {
      const v = window.localStorage.getItem(OBSIDIAN_VAULT_KEY);
      if (typeof v === "string") setVault(v);
    } catch {
      /* storage unavailable → 本次会话内填写 */
    }
  }, []);
  const saveVault = (v: string) => {
    setVault(v);
    if (v.trim()) setNeedVault(false);
    try {
      if (v) window.localStorage.setItem(OBSIDIAN_VAULT_KEY, v);
      else window.localStorage.removeItem(OBSIDIAN_VAULT_KEY);
    } catch {
      /* storage unavailable → 仅本次会话内生效 */
    }
  };
  const openInObsidian = (file: string) => {
    const v = vault.trim();
    if (!v) {
      /* 未填库名：不许乱开链接——聚焦输入框并闪提示 */
      setNeedVault(true);
      vaultInputRef.current?.focus();
      return;
    }
    window.open(
      `obsidian://open?vault=${encodeURIComponent(v)}&file=${encodeURIComponent(file)}`,
      "_blank",
    );
  };
  return (
    <div>
      <SecHead
        title="本体知识库"
        en="ONTOLOGY"
        right={<span className="hud-module-note">结构与口径 · 先行立架</span>}
      />
      <Kv k="状态">
        <span className="hud-c-amb">建设中 · 空壳已上线 · 条目 0</span>
      </Kv>
      <Kv k="条目来源">第二大脑笔记 · goals/ai-2/hidden_files/notes/</Kv>
      <Kv k="库存现状">框架 README 已建 · 归档笔记 0 篇（用户平时不存东西，从增量起步）</Kv>
      <Kv k="归档规则">一事一件 · 文件名 YYYY-MM-DD-主题.md · 头部带来源/日期/标签</Kv>
      <Kv k="标签体系">灵感 / 干货 / 待办线索 / 人脉 / 消费决策 / 其他</Kv>
      <Kv k="捕获方式">聊天里丢来的链接/截图/灵感由 Luna 归档；对话中的有价值信息同步沉淀</Kv>
      <Kv k="回顾">暂定按需 · 每周 digest 待确认后再设</Kv>
      <SecHead
        title="库内文件"
        en="VAULT FILES · OBSIDIAN 直达"
        right={
          <span className="hud-module-note">
            点 [OBSIDIAN] 唤起本地 Obsidian 打开该文件
          </span>
        }
      />
      <div className="hud-vault-row">
        <label className="hud-vault-label" htmlFor="hud-obsidian-vault">
          OBSIDIAN 库名
        </label>
        <input
          ref={vaultInputRef}
          id="hud-obsidian-vault"
          className="hud-module-input hud-module-input-flex"
          data-testid="hud-obsidian-vault"
          type="text"
          value={vault}
          onChange={(e) => saveVault(e.target.value)}
          placeholder="Obsidian 库名"
          aria-label="Obsidian 库名"
        />
        {needVault ? (
          <span className="hud-vault-hint" data-testid="hud-obsidian-need">
            先填库名
          </span>
        ) : null}
      </div>
      {ONTOLOGY_FILES.map((f) => (
        <Row key={f.file} testid={`hud-onto-file-${f.file}`}>
          <div className="hud-module-row-main">
            <div className="hud-module-row-t">
              {f.title}
              <span className="hud-module-row-en">{f.file}</span>
            </div>
            <div className="hud-module-row-src">
              goals/ai-2/hidden_files/notes/{f.file}
            </div>
          </div>
          <span className="hud-chip hud-c-pur">{f.tag}</span>
          <button
            type="button"
            className="hud-module-toggle"
            data-testid={`hud-obsidian-open-${f.file}`}
            onClick={(e) => {
              e.stopPropagation();
              openInObsidian(f.file);
            }}
          >
            [ OBSIDIAN ]
          </button>
        </Row>
      ))}
      <p className="hud-module-note">
        归档笔记仍为 0 篇——上面是库内现有的框架文件；第一条笔记落盘后
        会按同样的行样式列进这里，[ OBSIDIAN ] 直达随行就有。
      </p>
    </div>
  );
}

/* ─────────────────────────── 8 · inspiration ─────────────────────────── */

function InspirationBody() {
  const [steps, setSteps] = React.useState<FlowStep[]>([]);
  React.useEffect(() => {
    setSteps(readFlowSteps());
  }, []);
  return (
    <div>
      <SecHead
        title="执行分区"
        en="ZONES · 按谁来执行分"
        right={
          <span className="hud-module-note">
            共 {steps.length} 步 · 数据源 studio_workflow_steps_v2（本机）
          </span>
        }
      />
      {FLOW_ZONES.map((z) => {
        const list = steps.filter((s) => s.zone === z.id);
        return (
          <div key={z.id} className="hud-module-group" data-testid={`hud-zone-${z.id}`}>
            <div className="hud-module-group-h">
              <span className="hud-module-group-n">{z.label}</span>
              <span className="hud-chip hud-c-pur">{z.en}</span>
              <span className="hud-module-note">{list.length} 步</span>
            </div>
            {list.length > 0 ? (
              list.map((s) => (
                <Row key={s.id} testid={`hud-step-${s.id}`}>
                  <div className="hud-module-row-main">
                    <div className="hud-module-row-t">{s.title}</div>
                    {s.note ? (
                      <div className="hud-module-row-sub">{s.note}</div>
                    ) : null}
                  </div>
                </Row>
              ))
            ) : (
              <div className="hud-module-zone-empty">暂无步骤 · 本区为空</div>
            )}
          </div>
        );
      })}
      <p className="hud-module-note">
        旧 8 步 AIGC 流水线已于 2026-10-20 按用户要求清空（git
        历史可恢复）；三区结构就位，新步骤从本机数据新增后在此呈现。
      </p>
    </div>
  );
}

/* ─────────────────────────── 7 · studio (creation space) ─────────────────────────── */

/**
 * 创作流水线看板（hud-empower）：studio_workflow_steps_v2 的步骤按
 * status 呈三泳道 孵化→制作→待发（zone 是执行者维度、留在芯片上
 * 显示，两维并存）。换道两条等价路：指针拖拽（6px 阈值、Esc 取消、
 * 落空回位）与芯片左右箭头（触屏/键盘可达）。落盘成功才发
 * STUDIO_STAGE_MOVE——总线只记真发生的流转。本看板是模块视图内
 * 的独立小拖拽，与总览的决策/树行拖拽引擎互不相干。
 */
function StudioBoard() {
  const [steps, setSteps] = React.useState<FlowStep[]>([]);
  const [drag, setDrag] = React.useState<{
    idx: number;
    dx: number;
    dy: number;
    active: boolean;
  } | null>(null);
  const dragRef = React.useRef<{
    idx: number;
    startX: number;
    startY: number;
    stage: FlowStage;
  } | null>(null);

  React.useEffect(() => {
    setSteps(readFlowSteps());
  }, []);

  const moveStep = React.useCallback(
    (idx: number, target: FlowStage) => {
      const cur = steps[idx];
      if (!cur || stepStage(cur) === target) return;
      const next = steps.map((s, i) =>
        i === idx ? { ...s, status: target } : s,
      );
      /* 先落盘、成功才更新状态并发总线（bus 纪律：emit 只挂在动作
       * 真正完成之后）；落盘失败则不动状态、不假装流转。 */
      if (!writeFlowSteps(next)) return;
      setSteps(next);
      /* detail 带芯片名与目标泳道（hud-ux-dock）：终端拼成
       * 「[创作] 芯片名 → 制作」。 */
      emit(
        "STUDIO_STAGE_MOVE",
        "studio",
        `${cur.title} → ${FLOW_STAGES.find((s) => s.id === target)?.label ?? target}`,
      );
    },
    [steps],
  );

  /* Esc 取消进行中的拖拽 */
  React.useEffect(() => {
    if (!drag) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dragRef.current = null;
        setDrag(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drag]);

  const onChipPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    idx: number,
  ) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const s = steps[idx];
    if (!s) return;
    dragRef.current = {
      idx,
      startX: e.clientX,
      startY: e.clientY,
      stage: stepStage(s),
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture 不可用 → 仍可走箭头换道 */
    }
    setDrag({ idx, dx: 0, dy: 0, active: false });
  };
  const onChipPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const active = Math.hypot(dx, dy) > 6;
    setDrag({ idx: d.idx, dx, dy, active });
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>, commit: boolean) => {
    const d = dragRef.current;
    dragRef.current = null;
    const wasActive = drag?.active ?? false;
    setDrag(null);
    if (!d || !commit || !wasActive) return;
    /* 拖起时芯片 pointer-events 已关，elementFromPoint 命中其下泳道 */
    const el = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>("[data-board-lane]");
    const lane = el?.dataset.boardLane as FlowStage | undefined;
    if (
      lane &&
      (lane === "incubate" || lane === "produce" || lane === "ready") &&
      lane !== d.stage
    ) {
      moveStep(d.idx, lane);
    }
    /* 落空/落回原道：不改状态（drag 已清，芯片自动回位） */
  };

  return (
    <div>
      <SecHead
        title="创作流水线"
        en="PIPELINE · 拖拽或点箭头换道"
        right={
          <span className="hud-module-note">
            共 {steps.length} 步 · 与灵感池同源 studio_workflow_steps_v2
          </span>
        }
      />
      <div className="hud-board" data-testid="hud-board">
        {FLOW_STAGES.map((stage) => {
          const laneSteps = steps
            .map((s, i) => ({ s, i }))
            .filter(({ s }) => stepStage(s) === stage.id);
          return (
            <div
              key={stage.id}
              className="hud-board-lane"
              data-board-lane={stage.id}
              data-testid={`hud-board-lane-${stage.id}`}
            >
              <div className="hud-board-lane-h">
                <span className="hud-board-lane-t">{stage.label}</span>
                <span className="hud-module-row-en">{stage.en}</span>
                <span className="hud-module-note">{laneSteps.length}</span>
              </div>
              {laneSteps.length > 0 ? (
                laneSteps.map(({ s, i }) => {
                  const isDragging = drag?.idx === i;
                  const stageIdx = FLOW_STAGES.findIndex(
                    (x) => x.id === stage.id,
                  );
                  return (
                    <div
                      key={s.id ?? `row-${i}`}
                      className={cn(
                        "hud-board-chip",
                        isDragging && drag.active && "hud-board-chip-drag",
                      )}
                      data-testid={`hud-board-chip-${s.id ?? `row-${i}`}`}
                      style={
                        isDragging
                          ? {
                              transform: `translate(${drag.dx}px, ${drag.dy}px)`,
                              pointerEvents: drag.active
                                ? ("none" as const)
                                : undefined,
                            }
                          : undefined
                      }
                      onPointerDown={(e) => onChipPointerDown(e, i)}
                      onPointerMove={onChipPointerMove}
                      onPointerUp={(e) => endDrag(e, true)}
                      onPointerCancel={(e) => endDrag(e, false)}
                    >
                      <button
                        type="button"
                        className="hud-board-arrow"
                        data-testid={`hud-board-prev-${s.id ?? `row-${i}`}`}
                        aria-label="移到上一道"
                        disabled={stageIdx === 0}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() =>
                          moveStep(i, FLOW_STAGES[stageIdx - 1].id)
                        }
                      >
                        ‹
                      </button>
                      <div className="hud-board-chip-main">
                        <div className="hud-board-chip-t">{s.title}</div>
                        {s.note ? (
                          <div className="hud-module-row-sub">{s.note}</div>
                        ) : null}
                      </div>
                      <span className="hud-chip hud-c-pur">
                        {FLOW_ZONES.find((z) => z.id === s.zone)?.label ?? s.zone}
                        区
                      </span>
                      <button
                        type="button"
                        className="hud-board-arrow"
                        data-testid={`hud-board-next-${s.id ?? `row-${i}`}`}
                        aria-label="移到下一道"
                        disabled={stageIdx === FLOW_STAGES.length - 1}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() =>
                          moveStep(i, FLOW_STAGES[stageIdx + 1].id)
                        }
                      >
                        ›
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="hud-module-zone-empty">本道为空</div>
              )}
            </div>
          );
        })}
      </div>
      {steps.length === 0 ? (
        <p className="hud-module-note">
          流水线 0 步（无 status 的旧步骤一律先归孵化道）·
          在灵感池新增步骤后回到这里流转。
        </p>
      ) : null}
    </div>
  );
}

function StudioBody({ onOpen }: { onOpen: (id: string) => void }) {
  const cards: {
    id: string;
    label: string;
    en: string;
    desc: string;
    meta: string;
    target: string | null;
  }[] = [
    {
      id: "hub",
      label: "创作空间",
      en: "STUDIO",
      desc: "创作组中枢 · 本页即入口聚合",
      meta: "HUB",
      target: null,
    },
    {
      id: "works",
      label: "作品库",
      en: "WORKS",
      desc: "YouTube EP001 待公开 · 视频号 ep01 配音定稿待发布",
      meta: "2 件作品",
      target: "works",
    },
    {
      id: "skills",
      label: "技能库",
      en: "SKILLS",
      desc: "grokbot / Luna 已装技能",
      meta: `${ALL_SKILLS.length} 个`,
      target: "skills",
    },
  ];
  return (
    <div>
      <SecHead title="创作组入口" en="CREATE GROUP" />
      <div className="hud-module-hub">
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            className="hud-module-hubcard"
            data-testid={`hud-hub-${c.id}`}
            disabled={!c.target}
            onClick={() => c.target && onOpen(c.target)}
          >
            <div className="hud-module-hubcard-t">
              {c.label}
              <span className="hud-module-row-en">{c.en}</span>
            </div>
            <div className="hud-module-row-sub">{c.desc}</div>
            <div className="hud-module-hubcard-m">
              {c.meta}
              {c.target ? " → 进入" : ""}
            </div>
          </button>
        ))}
      </div>
      <SecHead
        title="创作组总览"
        en="GROUP OVERVIEW"
        right={<span className="hud-module-note">计数与最近动态 · 皆为真事实</span>}
      />
      <Kv k="作品库">2 件作品 · 另有待办票 {PENDING_TICKETS.length} 张</Kv>
      <Kv k="技能库">{ALL_SKILLS.length} 个已装技能（grokbot 8 · Luna 5）</Kv>
      <Kv k="最近动态 · 10-18">YouTube EP001 已上传 · 待改公开</Kv>
      <Kv k="最近动态 · 10-19">视频号 ep01 配音定稿（Fish Audio 影视解说男声）· 待发布</Kv>
      <StudioBoard />
    </div>
  );
}

/* ─────────────────── decision stack · note views ─────────────────── */

/** 意向记录的本机存储键（与日历事项同机制：只存这台设备）。 */
const DECISION_PICKS_KEY = "studio_decision_picks_v1";

/**
 * 决策栈里无对应模块的两项（X 恢复 / 小红书去向）点开后的状态说明页：
 * 陈述事实与待决选项，并可在页内记录意向（localStorage 本机存储）。
 * 记录意向不触发任何真实执行——不发请求、不改账号/任务状态；
 * 真执行仍以用户在聊天里跟 Luna 确认为准。
 */
export function HudDecisionNote({
  kind,
  onBack,
}: {
  kind: "x" | "xhs";
  onBack: () => void;
}) {
  const isX = kind === "x";
  const options: { id: string; label: string }[] = isX
    ? [
        { id: "resume", label: "恢复运营" },
        { id: "pause", label: "继续暂停" },
      ]
    : [
        { id: "A", label: "A 申诉" },
        { id: "B", label: "B 换号重来" },
        { id: "C", label: "C 先搁置" },
      ];
  const [pick, setPick] = React.useState<string | null>(null);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DECISION_PICKS_KEY);
      if (raw) {
        const obj = JSON.parse(raw) as Record<string, unknown>;
        const v = obj?.[kind];
        if (typeof v === "string") setPick(v);
      }
    } catch {
      /* storage unavailable → 无已选记录 */
    }
  }, [kind]);
  const choose = (id: string) => {
    setPick(id);
    let recorded = false;
    try {
      const raw = window.localStorage.getItem(DECISION_PICKS_KEY);
      const obj = raw
        ? (JSON.parse(raw) as Record<string, unknown>)
        : {};
      obj[kind] = id;
      window.localStorage.setItem(DECISION_PICKS_KEY, JSON.stringify(obj));
      recorded = true;
    } catch {
      /* storage unavailable → 仅本次会话内显示 */
    }
    /* 业务总线（hud-bus-pulse）：意向真正落盘后才发。X / 小红书两项
     * 都是无归属模块的 note 类决策 → moduleId 用 "hub"。detail 带
     * 决策标题与所选项（hud-ux-dock），终端拼成中文播报。 */
    if (recorded) {
      emit(
        "DECISION_PICK",
        "hub",
        `${isX ? "X 账号恢复" : "小红书去向"} · ${options.find((o) => o.id === id)?.label ?? id}`,
      );
    }
  };
  const pickLabel = options.find((o) => o.id === pick)?.label;
  return (
    <div
      className="hud-panel hud-module"
      data-testid="hud-decision-note"
      data-note={kind}
    >
      <div className="hud-phead">
        <button
          type="button"
          className="hud-module-back"
          data-testid="hud-module-back"
          onClick={onBack}
        >
          ← 返回总览
        </button>
        <span className="hud-t">
          {isX ? "X 账号恢复 · 状态说明" : "小红书去向 · 待拍板"}
        </span>
        <span className="hud-chip hud-c-pur">
          {isX ? "PAUSED" : "DECIDE"}
        </span>
        <span className="hud-hex">DECISION NOTE · 0xN0TE</span>
      </div>
      <div className="hud-module-body">
        {isX ? (
          <div data-testid="hud-note-x">
            <Kv k="状态">已暂停 · 等用户指令恢复</Kv>
            <Kv k="暂停时间">2026-10-20 16:12 起（用户指令「先停了」）</Kv>
            <Kv k="范围">8 个定时任务停用（任务定义保留，随时可恢复）</Kv>
            <Kv k="账号">@Lilinlsv5 · 用户手机端登录正常</Kv>
            <Kv k="恢复条件">用户发话即恢复 · 此页仅状态说明，无一键执行</Kv>
          </div>
        ) : (
          <div data-testid="hud-note-xhs">
            <Kv k="状态">账号永久封禁 · 待用户拍板去向</Kv>
            <Kv k="封禁时间">2026-10-20 13:29 · 平台判定「账号存在安全风险」</Kv>
            <Kv k="账号">野生搞钱薯</Kv>
            <Kv k="影响">发布 / 互动功能永久关闭 · 历史内容不对外展示</Kv>
            <Kv k="待决选项">A 实名申诉 / B 换号重来 / C 搁置</Kv>
            <Kv k="注意">
              <span className="hud-c-pink">
                不要点注销——注销后 1 年内禁止重新注册
              </span>
            </Kv>
          </div>
        )}
        <div className="hud-pickbox" data-testid="hud-decision-pick">
          <p className="hud-module-note">
            意向记录 · 只存这台设备，不触发任何执行：
          </p>
          <div className="hud-pickrow">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                className={cn("hud-pickbtn", pick === o.id && "hud-pickbtn-on")}
                data-testid={`hud-pick-${kind}-${o.id}`}
                aria-pressed={pick === o.id}
                onClick={() => choose(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
          {pickLabel ? (
            <p className="hud-picked" data-testid="hud-decision-picked">
              已选：{pickLabel} —— 在聊天里跟 Luna 确认后执行
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── shell ─────────────────────────── */

export function HudModuleContent({
  id,
  label,
  en,
  color,
  count,
  countText,
  onBack,
  onOpen,
}: {
  id: string;
  label: string;
  en: string;
  color: string;
  count: number | null;
  countText?: string;
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div
      className="hud-panel hud-module"
      data-testid="hud-module-view"
      data-module={id}
    >
      <div className="hud-phead">
        <button
          type="button"
          className="hud-module-back"
          data-testid="hud-module-back"
          onClick={onBack}
        >
          ← 返回总览
        </button>
        <span className="hud-t">
          {label} · {en}
        </span>
        <span className="hud-chip" style={{ color }}>
          {countText ?? (count != null ? `${count} ENTRIES` : "MODULE")}
        </span>
        <span className="hud-hex">MODULE VIEW · 0xM0D</span>
      </div>
      <div className="hud-module-body">
        {id === "skills" ? (
          <SkillsBody />
        ) : id === "database" ? (
          <DatabaseBody />
        ) : id === "works" ? (
          <WorksBody />
        ) : id === "calendar" ? (
          <CalendarBody />
        ) : id === "finance" ? (
          <FinanceBody />
        ) : id === "health" ? (
          <HealthBody />
        ) : id === "ontology" ? (
          <OntologyBody />
        ) : id === "inspiration" ? (
          <InspirationBody />
        ) : id === "studio" ? (
          <StudioBody onOpen={onOpen} />
        ) : (
          <EmptyState title="暂无条目" sub={`${label} · 条目 ${count ?? 0}`} />
        )}
      </div>
    </div>
  );
}
