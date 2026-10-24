"use client";

/**
 * 第二主题 · 技能库：只读镜像中枢（数据源 /skills-sync.json，本地不做 CRUD）。
 * 中区三分段（AGENT 分组 / 标签分组 / 高密表格）+ 右栏详情与调用控制台。
 * 本地唯一写：studio_skills_collapsed_v1（AGENT 分组折叠态，与挂载侧
 * SkillsBody 共用同一键，跨主题共享是设计本意，不重置、不迁移）。
 * 搜索命中字段、复制模板与反馈、折叠读写口径与挂载侧 SkillsBody 逐字
 * 同源；标签 / 高密两段为本页在同一份数据上的新增查找路径。
 * 不发总线；不写 skills-sync.json；技能数据不落 localStorage；不轮询。
 * 1180 以下右栏改抽屉（固定面板 + 可关闭，不破坏页面滚动）。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import RingModuleShell from "./ring-module-shell";
import skillsSyncJson from "../../../../public/skills-sync.json";

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

const BUNDLED = skillsSyncJson as unknown as {
  agents: SkillAgentGroup[];
  updated_at?: string;
};
const COLLAPSED_KEY = "studio_skills_collapsed_v1";

/** 更新时间口径与挂载侧一致：slice(0,16) + T 换空格。 */
const fmtUpdated = (u?: string) =>
  typeof u === "string" && u.length >= 16
    ? u.slice(0, 16).replace("T", " ")
    : (u ?? "");

const okSkill = (v: unknown): v is SkillEntry => {
  const o = v as Record<string, unknown> | null;
  return (
    !!o &&
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.zh === "string" &&
    typeof o.tag === "string" &&
    typeof o.source === "string"
  );
};
const okAgents = (v: unknown): boolean => {
  const o = v as { agents?: unknown } | null;
  if (!o || !Array.isArray(o.agents)) return false;
  return o.agents.every(
    (a) =>
      !!a &&
      typeof (a as { id?: unknown }).id === "string" &&
      typeof (a as { name?: unknown }).name === "string" &&
      Array.isArray((a as { skills?: unknown }).skills) &&
      ((a as { skills?: unknown[] }).skills ?? []).every(okSkill),
  );
};
const readCollapsed = (): Record<string, boolean> => {
  try {
    const raw = window.localStorage.getItem(COLLAPSED_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const next: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(obj ?? {})) {
      if (typeof v === "boolean") next[k] = v;
    }
    return next;
  } catch {
    return {};
  }
};

type Seg = "agent" | "tag" | "dense";

export default function RingSkills() {
  const [agents, setAgents] = useState<SkillAgentGroup[]>(BUNDLED.agents);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>(
    BUNDLED.updated_at,
  );
  const [offline, setOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [query, setQuery] = useState("");
  const [seg, setSeg] = useState<Seg>("agent");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [tagCollapsed, setTagCollapsed] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(
    BUNDLED.agents[0]?.skills[0]?.id ?? null,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copyState, setCopyState] = useState<{
    id: string;
    kind: "prompt" | "card" | "fail";
  } | null>(null);
  const copyTimer = useRef<number | undefined>(undefined);

  const total = useMemo(
    () => agents.reduce((n, a) => n + a.skills.length, 0),
    [agents],
  );
  const allSkills = useMemo(
    () => agents.flatMap((a) => a.skills.map((s) => ({ ...s, agent: a.id }))),
    [agents],
  );

  /* 搜索口径与挂载侧 match 逐字同源：zh / name / tag / source / desc。 */
  const q = query.trim().toLowerCase();
  const match = (s: SkillEntry) =>
    !q ||
    [s.zh, s.name, s.tag, s.source, s.desc ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(q);
  const visibleTotal = useMemo(
    () => agents.reduce((n, a) => n + a.skills.filter(match).length, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agents, q],
  );

  const tagGroups = useMemo(() => {
    const map = new Map<string, (SkillEntry & { agent: string })[]>();
    for (const s of allSkills) {
      if (!match(s)) continue;
      const list = map.get(s.tag) ?? [];
      list.push(s);
      map.set(s.tag, list);
    }
    return [...map.entries()]
      .map(([tag, list]) => ({
        tag,
        list: [...list].sort((a, b) => a.zh.localeCompare(b.zh, "zh-CN")),
      }))
      .sort((a, b) => a.tag.localeCompare(b.tag, "zh-CN"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents, q]);

  const selected = useMemo(
    () =>
      allSkills.find((s) => s.id === selectedId) ??
      allSkills[0] ??
      null,
    [allSkills, selectedId],
  );

  const fetchSync = async () => {
    setSyncing(true);
    try {
      const r = await fetch("/skills-sync.json", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as unknown;
      if (!okAgents(j)) throw new Error("bad shape");
      const jj = j as unknown as {
        agents: SkillAgentGroup[];
        updated_at?: string;
      };
      setAgents(jj.agents);
      if (typeof jj.updated_at === "string") setUpdatedAt(jj.updated_at);
      setOffline(false);
    } catch {
      /* 失败用构建期 import 副本兜底并标「离线副本」，不白屏。 */
      setOffline(true);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    setCollapsed(readCollapsed());
    document.body.dataset.skPage = "skills";
    void fetchSync();
    const onStorage = (e: StorageEvent) => {
      /* 跨标签页仅同步折叠状态，不重拉 json。 */
      if (e.key === COLLAPSED_KEY) setCollapsed(readCollapsed());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      delete document.body.dataset.skPage;
      delete document.body.dataset.skDrawer;
      if (copyTimer.current !== undefined)
        window.clearTimeout(copyTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (drawerOpen) document.body.dataset.skDrawer = "open";
    else delete document.body.dataset.skDrawer;
  }, [drawerOpen]);

  const toggleGroup = (id: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        /* storage 不可用 → 仅本次会话内生效 */
      }
      return next;
    });
  };
  const toggleTagGroup = (tag: string) =>
    setTagCollapsed((prev) => ({ ...prev, [tag]: !prev[tag] }));

  const select = (id: string) => {
    setSelectedId(id);
    /* 1180 以下点行即开抽屉；宽屏下抽屉规则不生效，右栏常显。 */
    if (window.innerWidth <= 1180) setDrawerOpen(true);
  };

  /* 复制口径与挂载侧 copySkill 逐字同源：三级降级，成功 1.2s 复原，失败留存。 */
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
    if (done)
      copyTimer.current = window.setTimeout(() => setCopyState(null), 1200);
  };
  const copyLabel = (s: SkillEntry) =>
    copyState?.id === s.id
      ? copyState.kind === "prompt"
        ? "已复制提示词"
        : copyState.kind === "card"
          ? "已复制调用卡"
          : "复制失败·请检查权限"
      : "COPY PROMPT";

  const agentDist = agents
    .map((a) => `${a.name} ${a.skills.length}`)
    .join(" / ");

  const rowCard = (s: SkillEntry & { agent: string }) => {
    const on = selected?.id === s.id;
    return (
      <div
        key={s.id}
        role="button"
        tabIndex={0}
        aria-label={`${s.zh} ${s.name}`}
        data-testid={`rm-sk-row-${s.id}`}
        className={`rm-sk-grid rm-sk-row${on ? " on" : ""}`}
        onClick={() => select(s.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            select(s.id);
          }
        }}
      >
        <span className="rm-sk-rowZh">{s.zh}</span>
        <span className="rm-sk-rowEn">{s.name}</span>
        <span className="rm-sk-rowTag">{s.tag}</span>
        <span className="rm-sk-rowSrc">{s.source}</span>
        <span className="rm-sk-rowOp">▸</span>
      </div>
    );
  };

  const groupRow = (s: SkillEntry & { agent: string }) => {
    const on = selected?.id === s.id;
    return (
      <div
        key={s.id}
        role="button"
        tabIndex={0}
        aria-label={`${s.zh} ${s.name}`}
        data-testid={`rm-sk-row-${s.id}`}
        className={`rm-sk-grow${on ? " on" : ""}`}
        onClick={() => select(s.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            select(s.id);
          }
        }}
      >
        <div className="rm-sk-growMain">
          <span className="rm-sk-growZh">{s.zh}</span>
          <span className="rm-sk-growEn">{s.name}</span>
          <span className="rm-chip rm-chipCyan">{s.tag}</span>
          <span className="rm-sk-growOp">▸</span>
        </div>
        {s.desc ? <div className="rm-sk-growSub">{s.desc}</div> : null}
        <div className="rm-sk-growSrc">{s.source}</div>
      </div>
    );
  };

  const emptyState = (
    <div className="rm-sk-empty" data-testid="rm-sk-empty">
      <div className="rm-sk-emptyT">无匹配技能</div>
      <div className="rm-sk-emptyS">
        没有技能命中「{query.trim()}」· 清空搜索看全部 {total} 个
      </div>
    </div>
  );

  const center =
    q && visibleTotal === 0 ? (
      emptyState
    ) : seg === "agent" ? (
      <div>
        {agents.map((agent) => {
          const list = agent.skills
            .filter(match)
            .map((s) => ({ ...s, agent: agent.id }));
          if (list.length === 0) return null;
          /* 搜索时含命中的分组强制展开；清空搜索后恢复用户折叠态。 */
          const isCollapsed = !q && !!collapsed[agent.id];
          return (
            <div
              key={agent.id}
              className="rm-sk-group"
              data-testid={`rm-sk-group-${agent.id}`}
            >
              <div
                className="rm-sk-groupH"
                role="button"
                tabIndex={0}
                aria-expanded={!isCollapsed}
                data-testid={`rm-sk-group-toggle-${agent.id}`}
                onClick={() => toggleGroup(agent.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleGroup(agent.id);
                  }
                }}
              >
                <span className="rm-sk-groupN">{agent.name}</span>
                <span className="rm-chip rm-chipPur">AGENT</span>
                <span className="rm-sk-groupMeta">
                  {list.length} SKILLS
                  {q ? ` / 共 ${agent.skills.length}` : ""}
                </span>
                <span className="rm-sk-groupArrow" aria-hidden="true">
                  {isCollapsed ? "▸" : "▾"}
                </span>
              </div>
              {isCollapsed ? null : list.map(groupRow)}
            </div>
          );
        })}
      </div>
    ) : seg === "tag" ? (
      <div>
        {tagGroups.map((g) => {
          /* 标签分组折叠仅本页内存态，不写入共享折叠键。 */
          const isCollapsed = !q && !!tagCollapsed[g.tag];
          return (
            <div
              key={g.tag}
              className="rm-sk-group"
              data-testid={`rm-sk-tag-group-${g.tag}`}
            >
              <div
                className="rm-sk-groupH"
                role="button"
                tabIndex={0}
                aria-expanded={!isCollapsed}
                data-testid={`rm-sk-tag-toggle-${g.tag}`}
                onClick={() => toggleTagGroup(g.tag)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleTagGroup(g.tag);
                  }
                }}
              >
                <span className="rm-sk-groupN">{g.tag}</span>
                <span className="rm-chip rm-chipYel">TAG</span>
                <span className="rm-sk-groupMeta">{g.list.length} 条</span>
                <span className="rm-sk-groupArrow" aria-hidden="true">
                  {isCollapsed ? "▸" : "▾"}
                </span>
              </div>
              {isCollapsed ? null : g.list.map(groupRow)}
            </div>
          );
        })}
      </div>
    ) : (
      <div data-testid="rm-sk-dense">
        <div className="rm-sk-grid rm-sk-gridHead" aria-hidden="true">
          <span>中文名</span>
          <span>EN</span>
          <span>TAG</span>
          <span>来源</span>
          <span>操作</span>
        </div>
        {allSkills.filter(match).map(rowCard)}
      </div>
    );

  const detail = selected ? (
    <div>
      <button
        type="button"
        className="rm-sk-drawerClose"
        data-testid="rm-sk-drawer-close"
        onClick={() => setDrawerOpen(false)}
      >
        ✕ 关闭
      </button>
      <div className="rm-detailHead">选中技能 · DETAIL</div>
      <div className="rm-detailTitle" data-testid="rm-sk-detail-title">
        {selected.zh}
      </div>
      <dl className="rm-fields" data-testid="rm-sk-detail">
        <dt>英文名</dt>
        <dd className="rm-sk-mono">{selected.name}</dd>
        <dt>标签</dt>
        <dd>
          <span className="rm-chip rm-chipCyan">{selected.tag}</span>
        </dd>
        <dt>来源</dt>
        <dd>{selected.source}</dd>
        {selected.desc ? (
          <>
            <dt>简介</dt>
            <dd>{selected.desc}</dd>
          </>
        ) : null}
      </dl>
      <div className="rm-sec">
        <div className="rm-secHead">
          <span className="rm-secCn">调用控制台</span>
          <span className="rm-secEn">COPY PROMPT</span>
        </div>
        <button
          type="button"
          className="rm-sk-copyBtn"
          data-testid="rm-sk-copy"
          onClick={() => void copySkill(selected)}
        >
          {copyLabel(selected)}
        </button>
        <div className="rm-sk-copyNote">
          {selected.detail
            ? "有 detail：复制提示词全文"
            : "无 detail：复制四行调用卡"}
        </div>
      </div>
      <div className="rm-sec">
        <div className="rm-secHead">
          <span className="rm-secCn">详情全文</span>
          <span className="rm-secEn">DETAIL</span>
        </div>
        {selected.detail ? (
          <pre className="rm-sk-detailPre" data-testid="rm-sk-detail-pre">
            {selected.detail}
          </pre>
        ) : (
          <div className="rm-detailEmpty">暂未同步详细介绍</div>
        )}
      </div>
      <div className="rm-sec">
        <div className="rm-secHead">
          <span className="rm-secCn">同步状态</span>
          <span className="rm-secEn">SYNC</span>
        </div>
        <div className="rm-sk-syncLine">
          来源 /skills-sync.json · 更新 {fmtUpdated(updatedAt)} · 共 {total}{" "}
          条 · {agentDist}
          {offline ? " · 离线副本" : ""}
        </div>
      </div>
    </div>
  ) : (
    <div className="rm-detailEmpty">未选中技能</div>
  );

  return (
    <RingModuleShell
      active="skills"
      cn="技能库"
      en="SKILLS"
      src="/skills-sync.json · 技能条数"
      count={total}
      note={
        offline
          ? "离线副本 · 构建期快照兜底"
          : `数据源 /skills-sync.json · 更新 ${fmtUpdated(updatedAt)}`
      }
      detail={detail}
    >
      {drawerOpen ? (
        <div
          className="rm-sk-scrim"
          data-testid="rm-sk-scrim"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}
      <div className="rm-sk-sync" data-testid="rm-sk-sync">
        <span>
          已装技能 {total} · 更新 {fmtUpdated(updatedAt)}
          {offline ? (
            <span className="rm-chip rm-chipAmb">离线副本</span>
          ) : null}
        </span>
        <span className="rm-sk-syncRight">
          <span className="rm-sk-agentDist">{agentDist}</span>
          <button
            type="button"
            className="rm-sk-refresh"
            data-testid="rm-sk-refresh"
            disabled={syncing}
            onClick={() => void fetchSync()}
          >
            {syncing ? "同步中…" : "↻ 刷新"}
          </button>
        </span>
      </div>
      <input
        className="rm-input"
        data-testid="rm-sk-search"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索技能 · 名称 / 标签 / 来源"
        aria-label="搜索技能"
      />
      <div className="rm-sk-seg" role="tablist" aria-label="技能分段">
        {(
          [
            ["agent", "A · AGENT"],
            ["tag", "B · 标签"],
            ["dense", "C · 高密"],
          ] as [Seg, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={seg === id}
            data-testid={`rm-sk-seg-${id}`}
            className={`rm-sk-segBtn${seg === id ? " on" : ""}`}
            onClick={() => setSeg(id)}
          >
            {label}
          </button>
        ))}
        <span className="rm-sk-segNote">
          {seg === "agent"
            ? "按 agent 分组 · 折叠态跨主题共享"
            : seg === "tag"
              ? "按标签分组 · 组内按中文名排序"
              : "高密表格 · 一屏扫全量"}
        </span>
      </div>
      <div className="rm-sk-center">{center}</div>
    </RingModuleShell>
  );
}
