"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { fmtMoney, isRepayment } from "@/components/studio/finance-module";
import skillsSyncJson from "../../../public/skills-sync.json";

/**
 * HUD module content views (2026-10-21, branch module-content).
 *
 * Clicking a module on the E home (tree row / console card) swaps the
 * CORE MAP overview for that module's real content; 「← 返回总览」 goes
 * back. Every list below renders an existing data source — nothing is
 * invented, and a module whose source is empty renders an honest empty
 * state:
 *
 * - skills    ← public/skills-sync.json (same file the old skills
 *               library syncs from; also refetched live on mount)
 * - database  ← the same 13 skill entries, indexed as DB rows — this
 *               mirrors the old workspace database hub in page.tsx
 *               (WS_HUBS "right": ALL_SKILLS rows, kind "Skill")
 * - works     ← the old works hub rows (WORK_SLOTS + PENDING_TICKETS
 *               in page.tsx = 3) plus the works-sync.json channel
 *               state from works-sync.tsx (未接入 until delivered)
 * - calendar  ← PENDING_TICKETS （待办票 ×2) + items persisted under
 *               localStorage `studio_calendar_items_v1` (starts empty)
 * - finance   ← FINANCE_SEED_ENTRIES in page.tsx (the two real ledger
 *               rows from ledger.csv — the source of the count 2),
 *               money formatted with finance-module's fmtMoney
 * - health    ← public/health-sync.json, the same payload
 *               health-module.tsx renders (sleep / steps / diet)
 * - ontology  ← shell only (OntologyModuleView is a 建设中 placeholder);
 *               rendered here in HUD dress with the same copy
 * - inspiration ← workflow steps persisted under
 *               `studio_workflow_steps_v2` (starts empty → 空状态）
 * - studio    ← HUB: entry cards into 作品库 / 技能库 content views
 */

type SkillEntry = {
  id: string;
  name: string;
  zh: string;
  tag: string;
  source: string;
  desc?: string;
};
type SkillAgentGroup = { id: string; name: string; skills: SkillEntry[] };

const SKILLS_SYNC = skillsSyncJson as unknown as {
  agents: SkillAgentGroup[];
  updated_at?: string;
};
const ALL_SKILLS: SkillEntry[] = SKILLS_SYNC.agents.flatMap((a) => a.skills);

/* ── page.tsx mirrors (read-only copies of the source constants) ── */

/** WORK_SLOTS + PENDING_TICKETS as composed by WS_HUBS "left" in page.tsx. */
const WORK_ROWS: {
  id: string;
  title: string;
  a: string;
  b: string;
  c: string;
}[] = [
  {
    id: "slot-ep01",
    title: "视频号 ep01 · 待发布",
    a: "Muse Fish Audio 配音中 · 成片槽位",
    b: "2026-10",
    c: "待发布",
  },
  {
    id: "t-ep01",
    title: "视频号 ep01 待发布",
    a: "等 Muse Fish Audio 配音就绪后再点发",
    b: "Muse + 本人",
    c: "待办",
  },
  {
    id: "t-ds",
    title: "omp DeepSeek 充值待命",
    a: "密钥已配 · Insufficient Balance · 充值后接 01/04/08",
    b: "待改派",
    c: "待办",
  },
];

/** PENDING_TICKETS in page.tsx — the calendar module's 待办票 ×2. */
const PENDING_TICKETS: {
  id: string;
  title: string;
  detail: string;
  owner: string;
}[] = [
  {
    id: "t-ep01",
    title: "视频号 ep01 待发布",
    detail: "等 Muse Fish Audio 配音就绪后再点发",
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
    note: "水+烟",
  },
  {
    id: "fin-seed-ledger-2",
    date: "2026-10-17",
    kind: "expense" as const,
    amount: 401.54,
    category: "还款",
    note: "微信分付还款",
  },
];

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

type CalItem = { id: string; date: string; title: string; note?: string };
type FlowStep = { id: string; title: string; zone: "me" | "ai" | "agent"; note?: string };
const FLOW_ZONE_LABEL: Record<FlowStep["zone"], string> = {
  me: "我 · ME",
  ai: "AI",
  agent: "AGENT",
};

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

/* ─────────────────────────── per-module bodies ─────────────────────────── */

function SkillsBody() {
  const [agents, setAgents] = React.useState<SkillAgentGroup[]>(
    SKILLS_SYNC.agents,
  );
  const [updatedAt, setUpdatedAt] = React.useState<string | undefined>(
    SKILLS_SYNC.updated_at,
  );
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
      {agents.map((agent) => (
        <div key={agent.id} className="hud-module-group">
          <div className="hud-module-group-h">
            <span className="hud-module-group-n">{agent.name}</span>
            <span className="hud-chip hud-c-pur">AGENT</span>
            <span className="hud-module-note">{agent.skills.length} SKILLS</span>
          </div>
          {agent.skills.map((s) => (
            <Row key={s.id} testid={`hud-skill-${s.id}`}>
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
            </Row>
          ))}
        </div>
      ))}
    </div>
  );
}

function DatabaseBody() {
  return (
    <div>
      <SecHead
        title="条目索引"
        en="ENTRY INDEX"
        right={
          <span className="hud-module-note">
            与技能库同源（skills-sync.json）· 共 {ALL_SKILLS.length} 条
          </span>
        }
      />
      {ALL_SKILLS.map((s) => (
        <Row key={`db-${s.id}`} testid={`hud-db-${s.id}`}>
          <div className="hud-module-row-main">
            <div className="hud-module-row-t">
              {s.zh} · {s.name}
            </div>
            <div className="hud-module-row-src">{s.source}</div>
          </div>
          <span className="hud-chip hud-c-cyan">SKILL</span>
        </Row>
      ))}
    </div>
  );
}

type SyncedWork = {
  platform: string;
  id: string;
  title: string;
  published_at: string;
};
function WorksBody() {
  const [synced, setSynced] = React.useState<SyncedWork[] | null>(null);
  React.useEffect(() => {
    let live = true;
    fetch("/works-sync.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (j: { platforms?: Record<string, SyncedWork[]> } | null) => {
          if (!live || !j || typeof j.platforms !== "object" || !j.platforms)
            return;
          setSynced(Object.values(j.platforms).flat());
        },
      )
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
        title="作品与待办"
        en="WORKS + PENDING"
        right={<span className="hud-module-note">共 {WORK_ROWS.length} 条</span>}
      />
      {WORK_ROWS.map((w) => (
        <Row key={w.id} testid={`hud-work-${w.id}`}>
          <div className="hud-module-row-main">
            <div className="hud-module-row-t">{w.title}</div>
            <div className="hud-module-row-sub">{w.a}</div>
          </div>
          <span className="hud-module-note">{w.b}</span>
          <span
            className={cn(
              "hud-chip",
              w.c === "待发布" ? "hud-c-pink" : "hud-c-yel",
            )}
          >
            {w.c}
          </span>
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
          </Row>
        ))
      ) : (
        <EmptyState
          title="未接入"
          sub="B站 / 抖音 / 视频号 / YouTube / X / TikTok · works-sync.json 尚未投递"
        />
      )}
    </div>
  );
}

function CalendarBody() {
  const [items, setItems] = React.useState<CalItem[]>([]);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem("studio_calendar_items_v1");
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
  const year = 2026;
  const month = 10;
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const dateStr = (d: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const marked = new Map<string, CalItem[]>();
  for (const it of items) {
    const list = marked.get(it.date) ?? [];
    list.push(it);
    marked.set(it.date, list);
  }
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
              className={cn("hud-module-cal-d", has && "hud-module-cal-on")}
              title={marked.get(dateStr(d))?.map((x) => x.title).join(" / ")}
            >
              {d}
              {has ? <span className="hud-module-cal-dot" /> : null}
            </div>
          );
        })}
      </div>
      {items.length > 0 ? (
        items.map((it) => (
          <Row key={it.id}>
            <div className="hud-module-row-main">
              <div className="hud-module-row-t">{it.title}</div>
              {it.note ? (
                <div className="hud-module-row-sub">{it.note}</div>
              ) : null}
            </div>
            <span className="hud-module-note">{it.date}</span>
          </Row>
        ))
      ) : (
        <EmptyState title="暂无日历事项" sub="本月事项 0 条 · 新增入口原在工作台（已停用）" />
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

function FinanceBody() {
  const totalOut = FINANCE_LEDGER_ENTRIES.filter(
    (e) => e.kind === "expense",
  ).reduce((acc, e) => acc + e.amount, 0);
  const repay = FINANCE_LEDGER_ENTRIES.filter((e) =>
    isRepayment({ ...e, kind: "expense" }),
  ).reduce((acc, e) => acc + e.amount, 0);
  return (
    <div>
      <SecHead
        title="台账条目"
        en="LEDGER ENTRIES"
        right={
          <span className="hud-module-note">
            共 {FINANCE_LEDGER_ENTRIES.length} 条 · 支出合计 {fmtMoney(totalOut)}
            {repay > 0 ? ` · 其中还款 ${fmtMoney(repay)}` : ""}
          </span>
        }
      />
      {FINANCE_LEDGER_ENTRIES.map((e) => (
        <Row key={e.id} testid={`hud-fin-${e.id}`}>
          <span className="hud-module-note">{e.date}</span>
          <div className="hud-module-row-main">
            <div className="hud-module-row-t">{e.note}</div>
            <div className="hud-module-row-src">台账导入 · ledger.csv</div>
          </div>
          <span className="hud-chip hud-c-yel">{e.category}</span>
          <span className="hud-module-amt">-{fmtMoney(e.amount)}</span>
        </Row>
      ))}
      <p className="hud-module-note" style={{ marginTop: 10 }}>
        数据源：Luna 台账 ledger.csv 种子条目（财务计数 2 的来源）·
        负债 / 资产 / 预算在旧模块中为本机录入，当前无条目。
      </p>
    </div>
  );
}

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
  if (!sync) {
    return (
      <EmptyState
        title={failed ? "STALE · 同步文件不可达" : "读取同步数据…"}
        sub="数据源 /health-sync.json"
      />
    );
  }
  const last = sync.sleep?.last;
  const last7 = sync.sleep?.last7 ?? [];
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
            同步于 {sync.updated_at?.slice(0, 16).replace("T", " ") ?? "—"} ·
            最近睡眠记录 {last?.date ?? "—"}
          </span>
        }
      />
      <div className="hud-module-kv">
        <span>状态</span>
        <b className={stale ? "hud-c-amb" : "hud-c-grn"}>
          {stale ? `STALE · 最近记录 ${last?.date?.slice(5) ?? "—"}` : "FRESH"}
        </b>
      </div>
      {last ? (
        <>
          <div className="hud-module-kv">
            <span>最近一晚睡眠</span>
            <b>
              {last.date} · {last.start} 入睡 → {last.end} 起床 · {last.hours}h
            </b>
          </div>
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
      <div className="hud-module-kv">
        <span>步数 · 近 7 日均值</span>
        <b>
          {sync.steps?.avg7 != null ? `${sync.steps.avg7} 步` : "—"} · 今日{" "}
          {sync.steps?.today != null ? `${sync.steps.today} 步` : "未同步"}
        </b>
      </div>
      <div className="hud-module-kv">
        <span>体重</span>
        <b>{sync.weight_kg != null ? `${sync.weight_kg} kg` : "—"}</b>
      </div>
      {sync.diet ? (
        <>
          <SecHead title="饮食" en="DIET" />
          <div className="hud-module-kv">
            <span>蛋白目标</span>
            <b>{sync.diet.protein_target ?? "—"}</b>
          </div>
          {sync.diet.advice ? (
            <p className="hud-module-text">{sync.diet.advice}</p>
          ) : null}
          {sync.diet.principles ? (
            <p className="hud-module-text dim">{sync.diet.principles}</p>
          ) : null}
        </>
      ) : null}
      {sync.data_cutoff_note ? (
        <p className="hud-module-note" style={{ marginTop: 10 }}>
          {sync.data_cutoff_note}
        </p>
      ) : null}
    </div>
  );
}

function InspirationBody() {
  const [steps, setSteps] = React.useState<FlowStep[]>([]);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem("studio_workflow_steps_v2");
      if (raw) {
        const arr = JSON.parse(raw) as FlowStep[];
        if (Array.isArray(arr)) {
          setSteps(
            arr.filter(
              (s) =>
                s &&
                typeof s.title === "string" &&
                (s.zone === "me" || s.zone === "ai" || s.zone === "agent"),
            ),
          );
        }
      }
    } catch {
      /* storage unavailable → 空状态 */
    }
  }, []);
  if (steps.length === 0) {
    return (
      <EmptyState
        title="暂无条目"
        sub="灵感池当前 0 条 · 流水线步骤 0 步（旧 8 步流水线已于 2026-10-20 清空）"
      />
    );
  }
  return (
    <div>
      <SecHead
        title="流水线步骤"
        en="WORKFLOW STEPS"
        right={<span className="hud-module-note">共 {steps.length} 步</span>}
      />
      {steps.map((s) => (
        <Row key={s.id}>
          <div className="hud-module-row-main">
            <div className="hud-module-row-t">{s.title}</div>
            {s.note ? <div className="hud-module-row-sub">{s.note}</div> : null}
          </div>
          <span className="hud-chip hud-c-cyan">{FLOW_ZONE_LABEL[s.zone]}</span>
        </Row>
      ))}
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
      desc: "视频号 ep01 待发布 · 含 2 张待办票",
      meta: `${WORK_ROWS.length} 条`,
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
          <EmptyState
            title="建设中"
            sub="本体知识库 · 0 条 · 内容细节待定（空壳已上线，细节待排期）"
          />
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
