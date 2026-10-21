"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { fmtMoney, isRepayment } from "@/components/studio/finance-module";
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
 * - finance   ← ledger.csv 两条种子：汇总卡（累计/消费/还款）+ 分类
 *               小计 + 流水（金额口径走 finance-module 的 fmtMoney）
 * - health    ← public/health-sync.json（睡眠/步数/饮食）+ 训练记录区
 *               （计划＝塑形计划-轻器械高次数.md，完成状态无确认数据
 *               → 标计划态，不代填）
 * - ontology  ← 结构与口径：条目源＝第二大脑笔记
 *               （goals/ai-2/hidden_files/notes/，现仅框架 README、
 *               笔记 0 条）→ 如实标建设中
 * - inspiration ← 我/AI/Agent 三区（WORKFLOW-ZONES-SPEC），步骤读
 *               studio_workflow_steps_v2（初始为空，三区如实空）
 * - studio    ← HUB 入口卡 + 创作组总览（计数与最近动态，皆真事实）
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
  {
    id: "t-ds",
    title: "omp DeepSeek 充值待命",
    detail: "密钥已配 · Insufficient Balance · 充值后接 01/04/08",
    owner: "待改派",
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

/* ── health training plan（塑形计划-轻器械高次数.md，只读镜像） ── */
const TRAINING_MOVES: { name: string; reps: string; cue: string }[] = [
  { name: "弹力带深蹲", reps: "15–20 次", cue: "膝盖顺着脚尖方向" },
  { name: "水瓶推举", reps: "12–15 次", cue: "水瓶代哑铃 · 核心收紧抓牢瓶身" },
  { name: "弹力带划船", reps: "12–15 次", cue: "拉到胸前时肩胛骨夹紧" },
  { name: "臀桥", reps: "15–20 次", cue: "环形带套膝盖上方 · 顶到最高夹紧 1 秒" },
  { name: "水瓶弯举", reps: "12–15 次", cue: "大臂贴紧身体别动" },
  { name: "跪姿腹肌轮推出", reps: "8–10 次", cue: "推到快贴地就拉回 · 全程别塌腰" },
];
const TRAINING_EQUIP = ["弹力带套装（已有）", "腹肌轮（已有）", "水瓶代哑铃 1.5–2L 灌满", "瑜伽垫（可选）"];

/* ── inspiration zones（WORKFLOW-ZONES-SPEC：我 / AI / Agent） ── */
type FlowZone = "me" | "ai" | "agent";
const FLOW_ZONES: { id: FlowZone; label: string; en: string }[] = [
  { id: "me", label: "我", en: "ME" },
  { id: "ai", label: "AI", en: "AI" },
  { id: "agent", label: "Agent", en: "AGENT" },
];
type FlowStep = { id: string; title: string; zone: FlowZone; note?: string };

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

type HealthSync = {
  updated_at?: string;
  data_cutoff_note?: string;
  sleep?: {
    last?: { date: string; start: string; end: string; hours: number };
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

function SkillsBody() {
  const [agents, setAgents] = React.useState<SkillAgentGroup[]>(
    SKILLS_SYNC.agents,
  );
  const [updatedAt, setUpdatedAt] = React.useState<string | undefined>(
    SKILLS_SYNC.updated_at,
  );
  const [query, setQuery] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);
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
        return (
          <div key={agent.id} className="hud-module-group">
            <div className="hud-module-group-h">
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
            </div>
            {list.map((s) => (
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

function FinanceBody() {
  const entries = FINANCE_LEDGER_ENTRIES;
  const totalOut = entries
    .filter((e) => e.kind === "expense")
    .reduce((acc, e) => acc + e.amount, 0);
  const repay = entries
    .filter((e) => isRepayment(e))
    .reduce((acc, e) => acc + e.amount, 0);
  const consumption = totalOut - repay;
  const byCategory = new Map<string, { sum: number; n: number }>();
  for (const e of entries) {
    const cur = byCategory.get(e.category) ?? { sum: 0, n: 0 };
    cur.sum += e.amount;
    cur.n += 1;
    byCategory.set(e.category, cur);
  }
  const dates = entries.map((e) => e.date).sort();
  return (
    <div>
      <SecHead
        title="汇总"
        en="SUMMARY"
        right={
          <span className="hud-module-note">
            数据源 Luna 台账 ledger.csv（种子条目）· {entries.length} 条 ·{" "}
            {dates[0] ?? "—"}
            {dates.length > 1 ? ` ～ ${dates[dates.length - 1]}` : ""}
          </span>
        }
      />
      <div className="hud-module-stats" data-testid="hud-fin-stats">
        <div className="hud-module-stat">
          <div className="hud-module-stat-v">{fmtMoney(totalOut)}</div>
          <div className="hud-module-stat-k">累计支出 · 全部</div>
        </div>
        <div className="hud-module-stat">
          <div className="hud-module-stat-v">{fmtMoney(consumption)}</div>
          <div className="hud-module-stat-k">消费支出 · 不含还款</div>
        </div>
        <div className="hud-module-stat">
          <div className="hud-module-stat-v">{fmtMoney(repay)}</div>
          <div className="hud-module-stat-k">还款 · 微信分付</div>
        </div>
      </div>
      <SecHead title="分类小计" en="BY CATEGORY" />
      {[...byCategory.entries()].map(([cat, v]) => (
        <div className="hud-module-kv" key={cat}>
          <span>{cat}</span>
          <b>
            {fmtMoney(v.sum)} · {v.n} 笔
          </b>
        </div>
      ))}
      <SecHead title="流水" en="ENTRIES" />
      {entries.map((e) => (
        <Row key={e.id} testid={`hud-fin-${e.id}`}>
          <span className="hud-module-note">{e.date}</span>
          <div className="hud-module-row-main">
            <div className="hud-module-row-t">{e.note}</div>
            <div className="hud-module-row-src">
              台账导入 · ledger.csv · {e.channel}
            </div>
          </div>
          <span className="hud-chip hud-c-yel">{e.category}</span>
          <span className="hud-module-amt">-{fmtMoney(e.amount)}</span>
        </Row>
      ))}
      <p className="hud-module-note" style={{ marginTop: 10 }}>
        负债 / 资产 / 预算为旧模块的本机录入项，当前无条目；新流水先记入
        Luna 台账 ledger.csv，再同步进站。
      </p>
    </div>
  );
}

/* ─────────────────────────── 2 · health ─────────────────────────── */

function HealthBody() {
  const [sync, setSync] = React.useState<HealthSync | null>(null);
  const [failed, setFailed] = React.useState(false);
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
    return () => {
      live = false;
    };
  }, []);
  const data: HealthSync = sync ?? HEALTH_SYNC_STATIC;
  const last = data.sleep?.last;
  const last7 = data.sleep?.last7 ?? [];
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
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
      {last ? (
        <>
          <Kv k="最近一晚睡眠">
            {last.date} · {last.start} 入睡 → {last.end} 起床 · {last.hours}h
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
        {data.steps?.today != null ? `${data.steps.today} 步` : "未同步"}
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
        {TRAINING_MOVES.map((m, i) => (
          <Row key={m.name} testid={`hud-train-${i}`}>
            <span className="hud-module-note">{`0${i + 1}`}</span>
            <div className="hud-module-row-main">
              <div className="hud-module-row-t">{m.name}</div>
              <div className="hud-module-row-sub">{m.cue}</div>
            </div>
            <span className="hud-chip hud-c-cyan">{m.reps}</span>
            <span className="hud-chip hud-c-dim">计划</span>
          </Row>
        ))}
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

function OntologyBody() {
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
      <div style={{ marginTop: 12 }}>
        <EmptyState
          title="条目 0 条"
          sub="暂无归档笔记 · 第一条笔记落盘后，这里按标签体系列出"
        />
      </div>
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
    </div>
  );
}

/* ─────────────────── decision stack · note views ─────────────────── */

/**
 * 决策栈里无对应模块的两项（X 恢复 / 小红书去向）点开后的状态说明页：
 * 只陈述事实与待决选项，不假装能一键执行。
 */
export function HudDecisionNote({
  kind,
  onBack,
}: {
  kind: "x" | "xhs";
  onBack: () => void;
}) {
  const isX = kind === "x";
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
