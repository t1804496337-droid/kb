"use client";

import * as React from "react";
import {
  Bookmark,
  Copy,
  Check,
  ChevronDown,
  Plus,
  Search,
  X,
  TrendingUp,
  CalendarDays,
  Database,
  Layers,
  LayoutGrid,
  Sparkles,
  Workflow,
  Wrench,
  CircleDot,
} from "lucide-react";
import { NeuralOrb } from "@/components/studio/neural-orb";
import { NeuralLanding, type LandingNode } from "@/components/studio/neural-landing";
import { NeuralWorkspace, NeuralWorkspaceMobile, type WsHub } from "@/components/studio/neural-workspace";
import { XUANZI_PROMPTS } from "@/lib/xuanzi-prompts";
import { cn } from "@/lib/utils";

type ThemeId = "silver" | "warm" | "neu";
type HubKey = "top" | "left" | "ll" | "right" | "lr";
const SECTION_TO_HUB: Partial<Record<string, HubKey>> = {
  ideas: "top", drafts: "ll", works: "left", database: "right", calendar: "lr",
};
type SectionId =
  | "workspace"
  | "works"
  | "drafts"
  | "ideas"
  | "calendar"
  | "database";

/** Right-rail / plexus list row — real pipeline & skill items (no demo faces). */
type BoardItem = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  hub: SectionId;
  status: string;
  kind: "workflow" | "skill" | "pending" | "slot";
};

const PILL_NAV: { id: SectionId; label: string; en: string }[] = [
  { id: "workspace", label: "工作台", en: "WORKSPACE" },
  { id: "works", label: "作品库", en: "WORKS" },
  { id: "drafts", label: "创作池", en: "SKILLS" },
  { id: "ideas", label: "灵感池", en: "WORKFLOW" },
  { id: "calendar", label: "日历表", en: "CALENDAR" },
  { id: "database", label: "数据库", en: "DATABASE" },
];

/** Real installed skills (agent-data/workflows + aigc-course/skills). */
const SKILLS: {
  id: string;
  name: string;
  zh: string;
  tag: string;
  source: string;
}[] = [
  {
    id: "s-re",
    name: "Skill Reverse Engineer",
    zh: "Skill 逆向",
    tag: "工程",
    source: "workflows/skill-reverse-engineer",
  },
  {
    id: "s-ipr",
    name: "Image Prompt Reverse",
    zh: "图像提示词逆向",
    tag: "提示词",
    source: "workflows/image-prompt-reverse",
  },
  {
    id: "s-pa",
    name: "Prompt Architect",
    zh: "提示词架构",
    tag: "提示词",
    source: "workflows/prompt-architect",
  },
  {
    id: "s-parch",
    name: "Prompt Archeologist",
    zh: "提示词考古",
    tag: "沉淀",
    source: "workflows/prompt-archeologist",
  },
  {
    id: "s-evo",
    name: "AI Autonomous Evolution",
    zh: "AI 自主进化",
    tag: "进化",
    source: "workflows/ai-autonomous-evolution",
  },
  {
    id: "s-wrap",
    name: "Task Wrap-up Capture",
    zh: "任务收尾沉淀",
    tag: "沉淀",
    source: "workflows/task-wrap-up-capture-2",
  },
  {
    id: "s-rea",
    name: "REA One-Sentence Reverse",
    zh: "REA 一句话逆向",
    tag: "逆向",
    source: "workflows/rea-one-sentence-reverse",
  },
  {
    id: "s-fenjing",
    name: "fenjing-storyboard",
    zh: "分镜工",
    tag: "分镜",
    source: "workflows/fenjing-storyboard",
  },
  {
    id: "s-01",
    name: "01-学课",
    zh: "学课 · 飞书通",
    tag: "流水线",
    source: "aigc-course/skills/01-学课",
  },
  {
    id: "s-02",
    name: "02-搭账号",
    zh: "搭账号 · Muse",
    tag: "流水线",
    source: "aigc-course/skills/02-搭账号",
  },
  {
    id: "s-03",
    name: "03-养号",
    zh: "养号 · WorkBuddy",
    tag: "流水线",
    source: "aigc-course/skills/03-养号",
  },
  {
    id: "s-04",
    name: "04-写大纲",
    zh: "写大纲 · 待改派",
    tag: "流水线",
    source: "aigc-course/skills/04-写大纲",
  },
  {
    id: "s-05",
    name: "05-出分镜",
    zh: "出分镜 · 分镜工/豆包",
    tag: "流水线",
    source: "aigc-course/skills/05-出分镜",
  },
  {
    id: "s-06",
    name: "06-剪视频",
    zh: "剪视频 · WorkBuddy+本人导出",
    tag: "流水线",
    source: "aigc-course/skills/06-剪视频",
  },
  {
    id: "s-07",
    name: "07-发布",
    zh: "发布 · Muse+本人点发",
    tag: "流水线",
    source: "aigc-course/skills/07-发布",
  },
  {
    id: "s-08",
    name: "08-数据回炉",
    zh: "数据回炉 · 待改派",
    tag: "流水线",
    source: "aigc-course/skills/08-看数据回炉",
  },
];

/** 8-step AIGC 网文拉新 — current roles (not DeepSeek for active). */
const WORKFLOW_STEPS: {
  id: string;
  n: number;
  title: string;
  role: string;
  status: "ready" | "pending" | "blocked";
  next: string;
  notes: string;
}[] = [
  { id: "w1", n: 1, title: "学课", role: "飞书通", status: "ready", next: "打开飞书通课表，勾完今日小节", notes: "aigc-course/skills/01-学课 · 飞书通文档是唯一课表入口" },
  { id: "w2", n: 2, title: "搭账号", role: "Muse", status: "ready", next: "用 Muse 建号 / 对齐人设卡", notes: "账号资料、头像、简介一次配齐，避免中途改人设" },
  { id: "w3", n: 3, title: "养号", role: "运营助手 / WorkBuddy", status: "ready", next: "按运营助手日程互动 20 分钟", notes: "WorkBuddy 拉起养号清单 · 不发硬广" },
  { id: "w4", n: 4, title: "写大纲", role: "待改派", status: "pending", next: "改派大纲写手（DeepSeek 待命）", notes: "omp DeepSeek 余额不足 · 充值后接 01/04/08" },
  { id: "w5", n: 5, title: "出分镜", role: "分镜工 / 豆包", status: "ready", next: "把大纲丢给分镜工 / 豆包出镜", notes: "aigc-course/skills/05-分镜 · 输出可剪镜号表" },
  { id: "w6", n: 6, title: "剪视频", role: "WorkBuddy + 本人导出", status: "ready", next: "WorkBuddy 粗剪 → 本人导出成片", notes: "成片进作品库 ep 槽，不直接发" },
  { id: "w7", n: 7, title: "发布", role: "Muse + 本人点发", status: "ready", next: "Muse 配音就绪后本人点发", notes: "卡点：Fish Audio 配音 · 见待办 ep01" },
  { id: "w8", n: 8, title: "数据回炉", role: "待改派", status: "pending", next: "回收播放数据，回写大纲/分镜", notes: "待改派分析角色 · 充值后可自动跑" },
];

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

/** Works gallery: real pending slots only — no stranger demo covers. */
const WORK_SLOTS: {
  id: string;
  index: string;
  title: string;
  subtitle: string;
  status: string;
  date: string;
}[] = [
  {
    id: "slot-ep01",
    index: "ep01",
    title: "视频号 ep01 · 待发布",
    subtitle: "Muse Fish Audio 配音中 · 成片槽位",
    status: "待发布",
    date: "2026-10",
  },
];

const BOARD_ITEMS: BoardItem[] = [
  ...WORKFLOW_STEPS.map((s) => ({
    id: s.id,
    title: `${s.n} ${s.title} · ${s.role}`,
    subtitle: s.status === "pending" ? "待改派" : s.status === "blocked" ? "阻塞" : "可派发",
    meta: `步骤 ${s.n}/8`,
    hub: "ideas" as SectionId,
    status: s.status === "ready" ? "就绪" : "待改派",
    kind: "workflow" as const,
  })),
  ...PENDING_TICKETS.map((t) => ({
    id: t.id,
    title: t.title,
    subtitle: t.detail,
    meta: t.owner,
    hub: "works" as SectionId,
    status: "待办",
    kind: "pending" as const,
  })),
  ...SKILLS.slice(0, 8).map((s) => ({
    id: s.id,
    title: s.zh,
    subtitle: s.name,
    meta: s.tag,
    hub: "drafts" as SectionId,
    status: "已装",
    kind: "skill" as const,
  })),
];

const METRICS = [
  { value: SKILLS.length, label: "已装 Skill", en: "Skills" },
  { value: WORKFLOW_STEPS.length, label: "流水线步", en: "Steps" },
  { value: PENDING_TICKETS.length, label: "待办票", en: "Tickets" },
  { value: WORK_SLOTS.length, label: "成片槽", en: "Slots" },
];

const THEMES: { id: ThemeId; label: string; en: string; short: string }[] = [
  { id: "silver", label: "银黑", en: "SILVER BLACK", short: "Dark" },
  { id: "warm", label: "暖灰", en: "WARM GRAY", short: "Warm" },
  { id: "neu", label: "新拟物", en: "NEUMORPH", short: "Soft" },
];

const CAL_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const CAL_MARKS = new Set([19, 20, 22, 25, 28]); // ops rhythm placeholders

type ModalKind = null | "edit" | "manage" | "create" | "step";

const WS_HUBS: WsHub[] = [
  {
    key: "top", section: "ideas", n: WORKFLOW_STEPS.length, label: "灵感池", en: "Workflow", sub: "8 步拉新流水线",
    rows: WORKFLOW_STEPS.map((w) => ({
      id: w.id, title: `${w.n} ${w.title} · ${w.role}`, a: `步骤 ${w.n}/8`,
      b: w.status === "ready" ? "就绪" : "待改派", c: w.status === "ready" ? undefined : "待派",
    })),
  },
  {
    key: "ll", section: "drafts", n: SKILLS.length, label: "创作池", en: "Skills", sub: "已装 Skill",
    rows: SKILLS.map((k) => ({ id: k.id, title: `${k.zh} · ${k.name}`, a: k.tag, b: "已装" })),
  },
  {
    key: "left", section: "works", n: WORK_SLOTS.length, label: "作品库", en: "Works", sub: "ep01 待发布",
    rows: [
      ...WORK_SLOTS.map((w) => ({ id: w.id, title: w.title, a: w.subtitle, b: w.date, c: w.status })),
      ...PENDING_TICKETS.map((t) => ({ id: t.id, title: t.title, a: t.detail, b: t.owner, c: "待办" })),
    ],
  },
  {
    key: "right", section: "database", n: SKILLS.length + WORKFLOW_STEPS.length, label: "数据库", en: "Database", sub: "Skill + 流程",
    rows: [
      ...WORKFLOW_STEPS.map((w) => ({ id: `db-${w.id}`, title: `${w.n} ${w.title}`, a: "流水线", b: w.role })),
      ...SKILLS.map((k) => ({ id: `db-${k.id}`, title: `${k.zh} · ${k.name}`, a: "Skill", b: k.source })),
    ],
  },
  {
    key: "lr", section: "calendar", n: CAL_MARKS.size, label: "日历表", en: "Calendar", sub: `${PENDING_TICKETS.length} 条待办`,
    rows: [
      ...PENDING_TICKETS.map((t) => ({ id: `cal-${t.id}`, title: t.title, a: t.owner, b: "本周", c: "待办" })),
      ...Array.from(CAL_MARKS).map((d) => ({ id: `cal-d${d}`, title: `10 月 ${d} 日 · 运营节点`, a: "日历", b: "2026-10" })),
    ],
  },
];

export default function StudioPage() {
  const [theme, setTheme] = React.useState<ThemeId>("silver");
  const [section, setSection] = React.useState<SectionId>("workspace");
  const [selectedBoardId, setSelectedBoardId] = React.useState<string | null>(
    BOARD_ITEMS[0]?.id ?? null,
  );
  const [metricFocus, setMetricFocus] = React.useState<number | null>(null);
  const [tileFocus, setTileFocus] = React.useState<string | null>(null);
  const [modal, setModal] = React.useState<ModalKind>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [promptsOpen, setPromptsOpen] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [newTitle, setNewTitle] = React.useState("");
  const [tickets, setTickets] = React.useState(PENDING_TICKETS);
  const [hubs, setHubs] = React.useState<WsHub[]>(() => WS_HUBS.map((h) => ({ ...h, rows: [...h.rows] })));
  const [activeHubKey, setActiveHubKey] = React.useState<HubKey>("ll");
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [editMode, setEditMode] = React.useState(false);
  const [landing, setLanding] = React.useState<"on" | "leaving" | "off">("on");
  const [minimized, setMinimized] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [fsFallback, setFsFallback] = React.useState(false);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  // Landing shows on every fresh visit (it is the entry page); only the intro
  // animation is shortened when it was already seen in this browser session.
  const [introQuick, setIntroQuick] = React.useState(false);
  /** Gate before neural landing. Cookie (SITE_AUTH) or localStorage both count. */
  const [authed, setAuthed] = React.useState<null | boolean>(null);
  const TITLE_KEY = "studio_window_title";
  const TITLE_DEFAULT = "涛的个人工作台";
  const [winTitle, setWinTitle] = React.useState(TITLE_DEFAULT);
  const [editingTitle, setEditingTitle] = React.useState(false);
  const titleInputRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem("studio_hub_rows_v1");
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, WsHub["rows"]>;
        setHubs((prev) =>
          prev.map((h) => (saved[h.key] ? { ...h, rows: saved[h.key], n: saved[h.key].length } : h)),
        );
      }
    } catch {
      /* ignore */
    }
  }, []);
  const persistHubs = React.useCallback((next: WsHub[]) => {
    try {
      const payload: Record<string, WsHub["rows"]> = {};
      next.forEach((h) => {
        payload[h.key] = h.rows;
      });
      window.localStorage.setItem("studio_hub_rows_v1", JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, []);
  React.useEffect(() => {
    try {
      const t = window.localStorage.getItem(TITLE_KEY);
      if (t && t.trim()) setWinTitle(t.trim());
    } catch {
      /* ignore */
    }
  }, []);
  React.useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);
  React.useEffect(() => {
    if (!profileOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("[data-testid=hdr-avatar], [data-testid=profile-menu]")) return;
      setProfileOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [profileOpen]);
  const commitTitle = (raw: string) => {
    const next = (raw || "").trim() || TITLE_DEFAULT;
    setWinTitle(next);
    setEditingTitle(false);
    try {
      window.localStorage.setItem(TITLE_KEY, next);
    } catch {
      /* ignore */
    }
  };
  const [loginUser, setLoginUser] = React.useState("");
  const [loginPass, setLoginPass] = React.useState("");
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const [loginPending, setLoginPending] = React.useState(false);
  // Login-gate orb loop (same plate + loop as the neural landing).
  const loginOrbVideoRef = React.useCallback((el: HTMLVideoElement | null) => {
    if (el) {
      el.muted = true;
      void el.play().catch(() => {});
    }
  }, []);
  React.useLayoutEffect(() => {
    try {
      if (window.sessionStorage.getItem("studio-intro-seen") === "1") setIntroQuick(true);
      else window.sessionStorage.setItem("studio-intro-seen", "1");
    } catch {
      /* storage blocked: always play intro */
    }
  }, []);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      let ok = false;
      try {
        ok = window.localStorage.getItem("studio_session") === "1";
      } catch {
        /* ignore */
      }
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) {
          const data = (await res.json()) as { ok?: boolean };
          if (data.ok) ok = true;
        }
      } catch {
        /* network: keep localStorage result */
      }
      if (!cancelled) setAuthed(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setLoginError(data?.error ?? "登录失败");
        return;
      }
      try {
        window.localStorage.setItem("studio_session", "1");
      } catch {
        /* ignore */
      }
      setAuthed(true);
      setLanding("on");
      setIntroQuick(false);
      setToast("登录成功 · 进入神经主体"); window.setTimeout(() => setToast(null), 2200);
    } catch {
      setLoginError("网络错误，请重试");
    } finally {
      setLoginPending(false);
    }
  };
  const doLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* ignore */
    }
    try {
      window.localStorage.removeItem("studio_session");
    } catch {
      /* ignore */
    }
    setFsFallback(false);
    setIsFullscreen(false);
    setMinimized(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    setLanding("on");
    setAuthed(false);
    setLoginPass("");
    setToast("已退出登录"); window.setTimeout(() => setToast(null), 2200);
  };

  const enterFromLanding = (target?: string) => {
    const valid = PILL_NAV.some((p) => p.id === target);
    setSection(valid ? (target as SectionId) : "workspace");
    setMinimized(false);
    setLanding("leaving");
    window.setTimeout(() => setLanding("off"), 620);
  };
  const returnToLanding = () => {
    setMinimized(false);
    setFsFallback(false);
    setIsFullscreen(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    setIntroQuick(true);
    setLanding("on");
  };
  const toggleMinimize = () => setMinimized((v) => !v);
  const toggleFullscreen = async () => {
    const el = stageRef.current;
    if (!el) return;
    if (fsFallback) {
      setFsFallback(false);
      setIsFullscreen(false);
      return;
    }
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        return;
      }
    } catch {
      /* fall through */
    }
    setFsFallback(true);
    setIsFullscreen(true);
  };
  React.useEffect(() => {
    const onFs = () => {
      const on = Boolean(document.fullscreenElement);
      setIsFullscreen(on);
      if (on) setFsFallback(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const currentTheme = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  React.useEffect(() => {
    const hk = SECTION_TO_HUB[section];
    if (hk) setActiveHubKey(hk);
  }, [section]);
  React.useEffect(() => {
    if (!selectedBoardId || section === "workspace") return;
    const el =
      document.querySelector(`[data-skill="${selectedBoardId}"]`) ||
      document.querySelector(`[data-step="${selectedBoardId}"]`) ||
      document.querySelector(`[data-work="${selectedBoardId}"]`) ||
      document.querySelector(`[data-ticket="${selectedBoardId}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [section, selectedBoardId]);

  const selected =
    (selectedBoardId && BOARD_ITEMS.find((b) => b.id === selectedBoardId)) ||
    BOARD_ITEMS[0] ||
    null;

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };
  const openStepDetail = (id: string) => {
    const step = WORKFLOW_STEPS.find((w) => w.id === id);
    if (!step) return;
    setSelectedBoardId(step.id);
    setSection("ideas");
    setModal("step");
    setToast(`步骤 ${step.n} · ${step.title}`);
    window.setTimeout(() => setToast(null), 1800);
  };

  const copyPrompt = async (id: string, body: string) => {
    try {
      await navigator.clipboard.writeText(body);
      setCopiedId(id);
      showToast("提示词已复制");
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      showToast("复制失败");
    }
  };

  const filteredSkills = React.useMemo(() => {
    if (!query.trim()) return SKILLS;
    const q = query.trim().toLowerCase();
    return SKILLS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.zh.toLowerCase().includes(q) ||
        s.tag.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div
      ref={stageRef}
      className={cn(
        "xuan-stage min-h-[100dvh] h-[100dvh] w-full overflow-hidden",
        `theme-${theme}`,
        minimized && "xuan-stage-minimized",
        fsFallback && "xuan-stage-fs-fallback",
      )}
      data-theme={theme}
      data-section={section}
      data-minimized={minimized ? "1" : "0"}
      data-fs={isFullscreen || fsFallback ? "1" : "0"}
      data-fs-mode={fsFallback ? "css" : isFullscreen ? "api" : "off"}
      data-authed={authed === null ? "pending" : authed ? "1" : "0"}
    >
      {authed === false && (
        <div className="studio-login-page studio-login-overlay" data-testid="studio-login">
          <div className="studio-login-bgwrap" aria-hidden>
            <div className="studio-login-orb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="lp-orb-plate"
                src="/studio/landing/orb-plate.webp"
                alt=""
                draggable={false}
              />
              <video
                ref={loginOrbVideoRef}
                className="lp-orb-loop"
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
              >
                <source src="/studio/neural-orb.webm" type="video/webm" />
                <source src="/studio/neural-orb.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
          <div className="studio-login-glow" aria-hidden />
          <form className="studio-login-card" onSubmit={doLogin}>
            <p className="studio-login-brand">
              TANG <span>NEURAL</span>
            </p>
            <h1>登录工作台</h1>
            <p className="studio-login-sub">银黑门禁 · 成功后进入神经主体</p>
            <label className="studio-login-field">
              <span>用户名</span>
              <input
                data-testid="login-user"
                name="username"
                autoComplete="username"
                required
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                placeholder="tang"
              />
            </label>
            <label className="studio-login-field">
              <span>密码</span>
              <input
                data-testid="login-pass"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="••••••••"
              />
            </label>
            {loginError ? (
              <p className="studio-login-error" role="alert">
                {loginError}
              </p>
            ) : null}
            <button
              type="submit"
              className="studio-login-submit"
              data-testid="login-submit"
              disabled={loginPending}
            >
              {loginPending ? "登录中…" : "进入"}
              <span>ENTER</span>
            </button>
          </form>
        </div>
      )}
      {authed && landing !== "off" && (
        <NeuralLanding
          nodes={LANDING_NODES}
          themeLabel={currentTheme.label}
          themeEn={currentTheme.en}
          onCycleTheme={() => {
            const i = THEMES.findIndex((t) => t.id === theme);
            setTheme(THEMES[(i + 1) % THEMES.length].id);
          }}
          onEnter={enterFromLanding}
          leaving={landing === "leaving"}
          quick={introQuick}
          stats={METRICS}
        />
      )}
      <div className="xuan-watermark" aria-hidden>
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i}>KB</span>
        ))}
      </div>

      <div
        className={cn(
          "xuan-window studio-root relative z-[1] flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden rounded-none border-0 md:rounded-[12px] md:border",
          `theme-${theme}`,
        )}
        data-section={section}
      >
        <NeuralOrb className="studio-orb-bg" theme={theme} />

        <div
          className="xuan-chrome relative z-[2] flex shrink-0 items-center gap-3 px-4 py-2.5"
          onClick={() => {
            if (minimized) setMinimized(false);
          }}
          role="presentation"
        >
          <div
            className="xuan-traffic flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
            role="group"
            aria-label="窗口控制"
          >
            <button
              type="button"
              className="xuan-dot xuan-dot-close"
              aria-label="关闭并返回首页"
              title="返回首页"
              data-testid="traffic-close"
              onClick={returnToLanding}
            >
              <span className="xuan-dot-glyph" aria-hidden>
                ×
              </span>
            </button>
            <button
              type="button"
              className="xuan-dot xuan-dot-min"
              aria-label={minimized ? "还原窗口" : "最小化窗口"}
              title={minimized ? "还原" : "最小化"}
              data-testid="traffic-min"
              aria-pressed={minimized}
              onClick={toggleMinimize}
            >
              <span className="xuan-dot-glyph" aria-hidden>
                −
              </span>
            </button>
            <button
              type="button"
              className="xuan-dot xuan-dot-max"
              aria-label={isFullscreen ? "退出全屏" : "进入全屏"}
              title={isFullscreen ? "退出全屏" : "全屏"}
              data-testid="traffic-max"
              aria-pressed={isFullscreen}
              onClick={() => {
                void toggleFullscreen();
              }}
            >
              <span className="xuan-dot-glyph" aria-hidden>
                +
              </span>
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center gap-1.5">
            {editingTitle ? (
              <input
                ref={titleInputRef}
                data-testid="window-title-input"
                className="studio-title-input"
                defaultValue={winTitle}
                maxLength={48}
                aria-label="编辑窗口标题"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitTitle((e.target as HTMLInputElement).value);
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setEditingTitle(false);
                  }
                }}
                onBlur={(e) => commitTitle(e.target.value)}
              />
            ) : (
              <button
                type="button"
                data-testid="window-title"
                className="studio-title-btn"
                title="点击编辑标题"
                onClick={(e) => {
                  e.stopPropagation();
                  if (minimized) {
                    setMinimized(false);
                    return;
                  }
                  setEditingTitle(true);
                }}
              >
                {winTitle}
                {minimized ? " · 点击还原" : ""}
                <span className="studio-title-edit" aria-hidden>
                  ✎
                </span>
              </button>
            )}
          </div>
          <span className="w-12" />
        </div>

        <div className="relative z-[2] flex min-h-0 flex-1 flex-col px-4 pt-2 md:px-5">
          <div className="studio-head mb-2 flex shrink-0 flex-row flex-wrap items-center gap-x-2 gap-y-2 lg:mb-3 lg:flex-nowrap lg:justify-between lg:gap-3">
            <div className="order-1 min-w-0 flex-1 basis-0 lg:flex-none lg:basis-auto lg:shrink-0">
              <p className="studio-brand whitespace-nowrap text-[13px] font-semibold tracking-[0.14em]">
                TANG / NEURAL
              </p>
              <p className="mt-0.5 truncate text-[10px] text-[color:var(--studio-muted)]">
                Skill · 工作流 · 8 步拉新流水线
              </p>
            </div>

            <nav
              className="studio-pill-nav order-3 flex w-full flex-wrap items-center justify-center gap-0.5 self-stretch rounded-full p-1 lg:order-2 lg:mx-2 lg:w-auto"
              aria-label="创作面板导航"
            >
              {PILL_NAV.map((item) => {
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    className={cn(
                      "rounded-full px-2.5 py-1.5 text-left transition-all sm:px-3",
                      active
                        ? "studio-pill-active"
                        : "text-[color:var(--studio-muted)] hover:text-[color:var(--studio-text)]",
                    )}
                  >
                    <span className="block text-[11px] font-medium sm:text-xs">
                      {item.label}
                    </span>
                    <span className="hidden text-[8px] tracking-wider opacity-70 sm:block">
                      {item.en}
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="order-2 ml-auto flex shrink-0 items-center justify-end gap-1.5 lg:order-3 lg:ml-0">
              <div className="studio-theme-seg hidden items-center gap-0.5 rounded-full p-0.5 lg:flex" role="group" aria-label="主题">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    data-testid={`hdr-theme-${t.id}`}
                    aria-pressed={theme === t.id}
                    className={cn("studio-theme-seg-btn", theme === t.id && "is-on")}
                    onClick={() => setTheme(t.id)}
                  >
                    {t.label} <small>{t.short}</small>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="xuan-btn"
                data-testid="hdr-edit"
                aria-pressed={editMode || editingTitle}
                onClick={() => {
                  if (section === "workspace" || landing !== "off") {
                    setEditingTitle(true);
                    showToast("编辑窗口标题");
                    return;
                  }
                  setEditMode((v) => !v);
                  setModal("edit");
                }}
              >
                编辑
              </button>
              <button
                type="button"
                className="xuan-btn"
                data-testid="hdr-manage"
                onClick={() => setModal("manage")}
              >
                管理
              </button>
              <button
                type="button"
                className="xuan-btn xuan-btn-primary"
                data-testid="hdr-create"
                onClick={() => {
                  setNewTitle("");
                  const hk = SECTION_TO_HUB[section];
                  if (hk) setActiveHubKey(hk);
                  setModal("create");
                }}
              >
                <Plus className="mr-1 inline h-3 w-3" />
                新建任务
              </button>
              <div className="relative ml-1">
                <button
                  type="button"
                  data-testid="hdr-avatar"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{
                    background:
                      "color-mix(in srgb, var(--studio-accent) 25%, transparent)",
                    color: "var(--studio-accent)",
                  }}
                  aria-label="账户菜单"
                  aria-expanded={profileOpen}
                  onClick={() => setProfileOpen((v) => !v)}
                >
                  T
                </button>
                {profileOpen && (
                  <div
                    className="studio-profile-menu"
                    data-testid="profile-menu"
                    role="menu"
                  >
                    <p className="studio-profile-who">
                      <b>tang</b>
                      <span>已登录 · neural studio</span>
                    </p>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileOpen(false);
                        setEditingTitle(true);
                        showToast("编辑窗口标题");
                      }}
                    >
                      改窗口标题
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileOpen(false);
                        setModal("manage");
                      }}
                    >
                      打开管理
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      data-testid="studio-logout"
                      onClick={() => {
                        setProfileOpen(false);
                        void doLogout();
                      }}
                    >
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="studio-scroll min-h-0 flex-1 overflow-y-auto pb-2">
            {section === "workspace" && (
              <div className="ws-desktop-layer">
                <NeuralWorkspace
                  hubs={hubs}
                  themeLabel={currentTheme.label}
                  themeEn={currentTheme.en}
                  onSelectHub={(k) => setActiveHubKey(k)}
                  onCycleTheme={() => {
                    const i = THEMES.findIndex((t) => t.id === theme);
                    setTheme(THEMES[(i + 1) % THEMES.length].id);
                  }}
                  onOpenSection={(id) => {
                    if (!PILL_NAV.some((p) => p.id === id)) return;
                    setSection(id as SectionId);
                    showToast(`打开 · ${PILL_NAV.find((p) => p.id === id)?.label ?? id}`);
                  }}
                  onReturnLanding={returnToLanding}
                  onPickRow={(row, hub) => {
                    if (hub.section === "ideas" && WORKFLOW_STEPS.some((w) => w.id === row.id)) {
                      openStepDetail(row.id);
                      return;
                    }
                    const sec = hub.section as SectionId;
                    if (!PILL_NAV.some((p) => p.id === sec)) return;
                    setSelectedBoardId(row.id);
                    setTileFocus(row.title);
                    setSection(sec);
                    const label = PILL_NAV.find((p) => p.id === sec)?.label ?? sec;
                    showToast(`打开 · ${label} · ${row.title}`);
                  }}
                />
              </div>
            )}
            {section === "workspace" && (
              <div className="ws-mobile-layer">
                <NeuralWorkspaceMobile
                  hubs={hubs}
                  onSelectHub={(k) => setActiveHubKey(k)}
                  onOpenSection={(id) => {
                    if (!PILL_NAV.some((p) => p.id === id)) return;
                    setSection(id as SectionId);
                    showToast(`打开 · ${PILL_NAV.find((p) => p.id === id)?.label ?? id}`);
                  }}
                  onReturnLanding={returnToLanding}
                  onPickRow={(row, hub) => {
                    if (hub.section === "ideas" && WORKFLOW_STEPS.some((w) => w.id === row.id)) {
                      openStepDetail(row.id);
                      return;
                    }
                    const sec = hub.section as SectionId;
                    if (!PILL_NAV.some((p) => p.id === sec)) return;
                    setSelectedBoardId(row.id);
                    setTileFocus(row.title);
                    setSection(sec);
                    const label = PILL_NAV.find((p) => p.id === sec)?.label ?? sec;
                    showToast(`打开 · ${label} · ${row.title}`);
                  }}
                />
              </div>
            )}
            <div className="ws-legacy grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-w-0 space-y-4" key={section}>
                {section === "workspace" && (
                  <SectionPane
                    icon={<LayoutGrid className="h-4 w-4" />}
                    title="工作台"
                    en="Workspace"
                    desc="左关系图 · 右流水线/Skill 列表 · 点节点切分区"
                  >
                    <header className="mb-1">
                      <h2 className="studio-slogan text-xl font-semibold tracking-tight md:text-2xl">
                        让每一条链接，双向生长。
                      </h2>
                      <p className="mt-0.5 text-[12px] text-[color:var(--studio-muted)]">
                        AIGC 网文拉新 · 8 步流水线 + 已装 Skill
                      </p>
                    </header>
                    <NeuralModuleMap
                      items={BOARD_ITEMS}
                      selectedId={selectedBoardId}
                      onOpen={(id) => {
                        setSection(id);
                        showToast(
                          `打开 · ${PILL_NAV.find((p) => p.id === id)?.label ?? id}`,
                        );
                      }}
                      onSelectItem={(item) => {
                        setSelectedBoardId(item.id);
                        showToast(`选中 · ${item.title}`);
                      }}
                    />
                  </SectionPane>
                )}

                {section === "works" && (
                  <>
                    <header>
                      <h1 className="studio-slogan text-2xl font-semibold tracking-tight md:text-[1.75rem]">
                        成片槽位 · 待发布。
                      </h1>
                      <p className="mt-1 text-[12px] text-[color:var(--studio-muted)] md:text-[13px]">
                        真实流水线槽位 · 无演示封面 / 无他人脸
                      </p>
                    </header>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {METRICS.map((m, i) => (
                        <button
                          key={m.label}
                          type="button"
                          onClick={() => {
                            setMetricFocus(i);
                            showToast(`${m.label} · ${m.value}`);
                          }}
                          className={cn(
                            "studio-glass xuan-metric px-3 py-3 text-left transition-transform hover:-translate-y-0.5",
                            metricFocus === i && "xuan-metric-focus",
                          )}
                        >
                          <p className="studio-metric-num text-2xl font-semibold tabular-nums md:text-3xl">
                            {m.value.toLocaleString()}
                          </p>
                          <p className="mt-1 text-[10px] text-[color:var(--studio-muted)]">
                            {m.label}
                            <span className="ml-1 opacity-70">{m.en}</span>
                          </p>
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {WORK_SLOTS.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          data-work={slot.id}
                          onClick={() => {
                            setSelectedBoardId(slot.id);
                            showToast(`槽位 · ${slot.title}`);
                          }}
                          className={cn(
                            "studio-glass studio-work-card overflow-hidden text-left",
                            selectedBoardId === slot.id && "studio-row-on",
                          )}
                        >
                          <div className="relative flex aspect-[3/4] flex-col items-center justify-center gap-2 bg-gradient-to-b from-white/5 to-transparent p-4">
                            <CircleDot className="h-8 w-8 text-[color:var(--studio-accent)] opacity-80" />
                            <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] text-[#ecece9]">
                              {slot.index}
                            </span>
                            <span className="rounded-full px-2 py-0.5 text-[10px] studio-pill-active">
                              {slot.status}
                            </span>
                          </div>
                          <div className="space-y-1.5 p-2.5">
                            <p className="text-[10px] text-[color:var(--studio-muted)]">
                              {slot.date}
                            </p>
                            <p className="line-clamp-2 text-[12px] font-medium leading-snug">
                              {slot.title}
                            </p>
                            <p className="text-[10px] text-[color:var(--studio-muted)]">
                              {slot.subtitle}
                            </p>
                          </div>
                        </button>
                      ))}
                      <button
                        type="button"
                        className="studio-glass flex min-h-[220px] flex-col items-center justify-center gap-2 border border-dashed border-[color:var(--studio-border)] px-4 py-8 text-center"
                        onClick={() => setModal("create")}
                      >
                        <Plus className="h-5 w-5 text-[color:var(--studio-muted)]" />
                        <p className="text-[12px] font-medium">添加成片槽</p>
                        <p className="text-[10px] text-[color:var(--studio-muted)]">
                          无演示内容 · 仅真实待发
                        </p>
                      </button>
                    </div>
                  </>
                )}

                {section === "drafts" && (
                  <SectionPane
                    icon={<Wrench className="h-4 w-4" />}
                    title="创作池 · Skill 库"
                    en="Skills"
                    desc="已装 Skill · 来自 workflows + aigc-course"
                  >
                    <div className="studio-glass mb-3 flex min-w-[160px] items-center gap-2 rounded-full px-3 py-1.5">
                      <Search className="h-3.5 w-3.5 text-[color:var(--studio-muted)]" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="搜索 Skill…"
                        className="w-full bg-transparent text-[12px] outline-none placeholder:text-[color:var(--studio-muted)]"
                      />
                    </div>
                    <ul className="space-y-2">
                      {filteredSkills.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            data-skill={s.id}
                            className={cn(
                              "studio-glass flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:opacity-95",
                              selectedBoardId === s.id && "studio-row-on",
                            )}
                            onClick={() => {
                              setSelectedBoardId(s.id);
                              showToast(`Skill · ${s.zh}`);
                            }}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{s.zh}</p>
                              <p className="truncate text-[10px] text-[color:var(--studio-muted)]">
                                {s.name} · {s.source}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] studio-pill-active">
                              {s.tag}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </SectionPane>
                )}

                {section === "ideas" && (
                  <SectionPane
                    icon={<Workflow className="h-4 w-4" />}
                    title="灵感池 · 8 步工作流"
                    en="Workflow"
                    desc="AIGC 网文拉新 · 当前角色表"
                  >
                    <ol className="space-y-2">
                      {WORKFLOW_STEPS.map((step) => (
                        <li key={step.id}>
                          <button
                            type="button"
                            data-step={step.id}
                            className={cn(
                              "studio-glass flex w-full items-center gap-3 px-4 py-3 text-left",
                              selectedBoardId === step.id && "studio-row-on",
                            )}
                            onClick={() => openStepDetail(step.id)}
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold studio-pill-active">
                              {step.n}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{step.title}</p>
                              <p className="text-[10px] text-[color:var(--studio-muted)]">
                                派给 · {step.role}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px]",
                                step.status === "ready"
                                  ? "studio-pill-active"
                                  : "text-[color:var(--studio-muted)]",
                              )}
                            >
                              {step.status === "ready" ? "就绪" : "待改派"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </SectionPane>
                )}

                {section === "calendar" && (
                  <SectionPane
                    icon={<CalendarDays className="h-4 w-4" />}
                    title="日历表"
                    en="Calendar"
                    desc="发布节奏 · 有标记的日子可点"
                  >
                    <div className="studio-glass p-4">
                      <p className="mb-3 text-xs text-[color:var(--studio-muted)]">
                        2026 · October · Africa/Blantyre
                      </p>
                      <div className="grid grid-cols-7 gap-1.5">
                        {CAL_DAYS.map((d) => {
                          const marked = CAL_MARKS.has(d);
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() =>
                                showToast(
                                  marked
                                    ? d === 19
                                      ? "今天 · ep01 Fish Audio 跟进"
                                      : `有计划 · ${d} 日`
                                    : `${d} 日 · 空档`,
                                )
                              }
                              className={cn(
                                "flex h-9 items-center justify-center rounded-lg text-[12px] transition-colors",
                                marked
                                  ? "studio-pill-active font-semibold"
                                  : "text-[color:var(--studio-muted)] hover:bg-white/5",
                              )}
                            >
                              {d}
                            </button>
                          );
                        })}
                      </div>
                      <ul className="mt-4 space-y-2 border-t border-[color:var(--studio-border)] pt-3">
                        {tickets.map((t) => (
                          <li key={t.id}>
                            <button
                              type="button"
                              data-ticket={t.id}
                              className={cn(
                                "w-full rounded-lg px-2 py-2 text-left text-[12px] leading-snug text-[color:var(--studio-muted)] transition-colors hover:bg-white/5",
                                selectedBoardId === t.id && "studio-row-on text-[color:var(--studio-text)]",
                              )}
                              onClick={() => {
                                setSelectedBoardId(t.id);
                                showToast(`待办 · ${t.title} · ${t.owner}`);
                              }}
                            >
                              <span className="font-medium text-[color:var(--studio-text)]">
                                {t.title}
                              </span>
                              {" · "}
                              {t.detail}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </SectionPane>
                )}

                {section === "database" && (
                  <SectionPane
                    icon={<Database className="h-4 w-4" />}
                    title="数据库"
                    en="Database"
                    desc="Skill + 流水线字段表"
                  >
                    <div className="studio-glass overflow-hidden">
                      <table className="w-full text-left text-[12px]">
                        <thead className="text-[color:var(--studio-muted)]">
                          <tr className="border-b border-[color:var(--studio-border)]">
                            <th className="px-3 py-2 font-medium">名称</th>
                            <th className="px-3 py-2 font-medium">类型</th>
                            <th className="px-3 py-2 font-medium">状态</th>
                            <th className="px-3 py-2 font-medium">来源</th>
                          </tr>
                        </thead>
                        <tbody>
                          {SKILLS.map((s) => (
                            <tr
                              key={s.id}
                              className="cursor-pointer border-b border-[color:var(--studio-border)] last:border-0 hover:bg-white/5"
                              onClick={() => {
                                setSelectedBoardId(s.id);
                                setSection("drafts");
                                showToast(`定位 Skill · ${s.zh}`);
                              }}
                            >
                              <td className="px-3 py-2.5">{s.zh}</td>
                              <td className="px-3 py-2.5">{s.tag}</td>
                              <td className="px-3 py-2.5">已装</td>
                              <td className="max-w-[140px] truncate px-3 py-2.5 text-[color:var(--studio-muted)]">
                                {s.source}
                              </td>
                            </tr>
                          ))}
                          {WORKFLOW_STEPS.map((w) => (
                            <tr
                              key={w.id}
                              className="cursor-pointer border-b border-[color:var(--studio-border)] last:border-0 hover:bg-white/5"
                              onClick={() => openStepDetail(w.id)}
                            >
                              <td className="px-3 py-2.5">
                                {w.n} {w.title}
                              </td>
                              <td className="px-3 py-2.5">流水线</td>
                              <td className="px-3 py-2.5">
                                {w.status === "ready" ? "就绪" : "待改派"}
                              </td>
                              <td className="px-3 py-2.5 text-[color:var(--studio-muted)]">
                                {w.role}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </SectionPane>
                )}
              </div>

              <aside className="studio-glass flex min-h-[320px] flex-col gap-3 p-3 lg:min-h-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold">分析概览</p>
                    <p className="text-[10px] text-[color:var(--studio-muted)]">
                      Board · Skill / 流水线
                    </p>
                  </div>
                  <Sparkles className="h-3.5 w-3.5 text-[color:var(--studio-accent)]" />
                </div>

                {!selected ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-[color:var(--studio-border)] bg-black/10 px-3 py-10 text-center">
                    <p className="text-[12px] font-medium">暂无选中项</p>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      data-testid="board-selected"
                      className="xuan-fly-in flex w-full gap-2.5 rounded-[10px] border border-[color:var(--studio-border)] bg-black/10 p-2 text-left"
                      onClick={() => {
                        if (selected.kind === "workflow") openStepDetail(selected.id);
                        else if (selected.kind === "skill") {
                          setSection("drafts");
                          setSelectedBoardId(selected.id);
                          showToast(`打开 · ${selected.title}`);
                        } else showToast(selected.title);
                      }}
                    >
                      <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-md bg-black/30">
                        {selected.kind === "skill" ? (
                          <Wrench className="h-5 w-5 text-[color:var(--studio-accent)]" />
                        ) : selected.kind === "workflow" ? (
                          <Workflow className="h-5 w-5 text-[color:var(--studio-accent)]" />
                        ) : (
                          <CircleDot className="h-5 w-5 text-[color:var(--studio-accent)]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[12px] font-medium leading-snug">
                          {selected.title}
                        </p>
                        <p className="mt-1 text-[10px] text-[color:var(--studio-muted)]">
                          {selected.subtitle}
                        </p>
                      </div>
                    </button>

                    <div className="rounded-[10px] border border-[color:var(--studio-border)] bg-black/10 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[10px] text-[color:var(--studio-muted)]">
                          状态 Status
                        </p>
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-400">
                          <TrendingUp className="h-3 w-3" />
                          {selected.status}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{selected.meta}</p>
                      <p className="mt-2 text-[10px] leading-relaxed text-[color:var(--studio-muted)]">
                        {selected.kind === "workflow" &&
                          "8 步 AIGC 网文拉新 · Rio 派发 / 验收"}
                        {selected.kind === "skill" &&
                          "已装 Skill · 可从创作池打开"}
                        {selected.kind === "pending" &&
                          "待办票 · 阻塞发布或改派"}
                        {selected.kind === "slot" && "成片槽 · 无演示封面"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          ["Skill", "Skills", SKILLS.length, Wrench],
                          ["步骤", "Steps", WORKFLOW_STEPS.length, Workflow],
                          ["待办", "Tickets", PENDING_TICKETS.length, Bookmark],
                          ["成片", "Slots", WORK_SLOTS.length, Layers],
                        ] as const
                      ).map(([zh, en, val, Icon]) => (
                        <button
                          key={zh}
                          type="button"
                          onClick={() => {
                            setTileFocus(zh);
                            showToast(`${zh} · ${val}`);
                          }}
                          className={cn(
                            "rounded-[10px] border border-[color:var(--studio-border)] bg-black/10 px-2.5 py-2.5 text-left transition-colors",
                            tileFocus === zh && "xuan-metric-focus",
                          )}
                        >
                          <Icon className="mb-1 h-3 w-3 text-[color:var(--studio-muted)]" />
                          <p className="text-lg font-semibold tabular-nums">
                            {val}
                          </p>
                          <p className="text-[9px] text-[color:var(--studio-muted)]">
                            {zh} · {en}
                          </p>
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      data-testid="board-cta"
                      className="xuan-btn xuan-btn-primary mt-auto w-full justify-center"
                      onClick={() => {
                        if (selected.kind === "workflow") {
                          openStepDetail(selected.id);
                          return;
                        }
                        if (selected.kind === "skill") {
                          setSection("drafts");
                          setSelectedBoardId(selected.id);
                          showToast(`打开创作池 · ${selected.title}`);
                          return;
                        }
                        if (selected.kind === "pending") {
                          setSection("calendar");
                          setSelectedBoardId(selected.id);
                          showToast(`打开待办 · ${selected.title}`);
                          return;
                        }
                        const hub = selected.hub;
                        setSection(hub);
                        showToast(
                          `跳转 · ${PILL_NAV.find((p) => p.id === hub)?.label}`,
                        );
                      }}
                    >
                      {selected.kind === "workflow"
                        ? selected.status === "可派发" || selected.subtitle === "可派发"
                          ? "可派发 · 打开步骤"
                          : "打开步骤详情"
                        : selected.kind === "skill"
                          ? "打开该 Skill"
                          : selected.kind === "pending"
                            ? "处理待办"
                            : "打开对应分区"}
                    </button>
                  </>
                )}
              </aside>
            </div>
          </div>

          <div className="studio-footer shrink-0 border-t border-[color:var(--studio-border)] bg-[color:color-mix(in_srgb,var(--studio-bg)_92%,transparent)] py-1.5 backdrop-blur-md sm:py-3">
            <div className="flex flex-row items-center justify-between gap-2 sm:items-end">
              <div className="min-w-0">
                <p className="mb-1.5 hidden text-[9px] font-semibold uppercase tracking-[0.16em] text-[color:var(--studio-accent)] sm:block">
                  主题动效 · Theme
                </p>
                <div className="studio-pill-nav inline-flex flex-wrap gap-0.5 rounded-full p-1">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setTheme(t.id);
                        showToast(`已切换 · ${t.label}`);
                      }}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-left transition-all sm:px-3 sm:py-1.5",
                        theme === t.id
                          ? "studio-pill-active"
                          : "text-[color:var(--studio-muted)]",
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-block h-[0.55em] w-[0.55em] shrink-0 rounded-full bg-[#ECECE9]",
                            theme === t.id ? "opacity-100" : "opacity-35",
                          )}
                          aria-hidden
                        />
                        <span className="block text-[11px] font-semibold leading-none">
                          {t.label}
                        </span>
                      </span>
                      <span className="mt-0.5 hidden pl-[calc(0.55em+0.375rem)] text-[8px] tracking-wider opacity-70 sm:block">
                        {t.en}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {(() => {
                const step = WORKFLOW_STEPS.find((w) => w.id === selectedBoardId);
                if (!step) return null;
                return (
                  <button
                    type="button"
                    data-testid="step-pill"
                    className="studio-step-pill"
                    onClick={() => openStepDetail(step.id)}
                    title="打开步骤详情"
                  >
                    步骤 {step.n} · {step.title}
                  </button>
                );
              })()}

              <button
                type="button"
                className="xuan-btn inline-flex shrink-0 items-center gap-1 sm:self-auto"
                onClick={() => setPromptsOpen((v) => !v)}
              >
                七组提示词
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    promptsOpen && "rotate-180",
                  )}
                />
              </button>
            </div>

            {promptsOpen && (
              <div className="mt-3 max-h-40 overflow-y-auto">
                <div className="grid gap-2 sm:grid-cols-2">
                  {XUANZI_PROMPTS.map((p) => (
                    <div key={p.id} className="studio-glass p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[12px] font-semibold">
                          {p.id} · {p.title}
                        </p>
                        <button
                          type="button"
                          className="studio-copy-btn inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px]"
                          onClick={() => copyPrompt(p.id, p.body)}
                        >
                          {copiedId === p.id ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          复制
                        </button>
                      </div>
                      <pre className="studio-prompt-body max-h-20 overflow-auto whitespace-pre-wrap font-sans text-[10px] leading-relaxed text-[color:var(--studio-muted)]">
                        {p.body}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={() => setModal(null)}
          role="presentation"
        >
          <div
            className={cn(
              "studio-root studio-glass w-full max-w-md p-5 shadow-2xl",
              `theme-${theme}`,
            )}
            data-theme={theme}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                {modal === "edit" && "编辑条目"}
                {modal === "manage" && "管理面板"}
                {modal === "create" && "新建任务"}
                {modal === "step" && "步骤详情"}
              </h2>
              <button
                type="button"
                className="rounded-full p-1 hover:bg-white/10"
                onClick={() => setModal(null)}
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modal === "step" && (() => {
              const step = WORKFLOW_STEPS.find((w) => w.id === selectedBoardId) ?? WORKFLOW_STEPS[0];
              return (
                <div className="space-y-3" data-testid="step-detail">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold studio-pill-active">
                      {step.n}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[16px] font-semibold">{step.title}</p>
                      <p className="text-[12px] text-[color:var(--studio-muted)]">
                        步骤 {step.n}/8 · 派给 {step.role}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "ml-auto shrink-0 rounded-full px-2.5 py-1 text-[11px]",
                        step.status === "ready" ? "studio-pill-active" : "text-[color:var(--studio-muted)]",
                      )}
                    >
                      {step.status === "ready" ? "就绪 · 可派发" : "待改派"}
                    </span>
                  </div>
                  <div className="studio-glass space-y-2 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-accent)]">
                      下一步动作 · Next
                    </p>
                    <p className="text-[13px] leading-relaxed">{step.next}</p>
                    <p className="text-[11px] leading-relaxed text-[color:var(--studio-muted)]">
                      {step.notes}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="xuan-btn xuan-btn-primary"
                      data-testid="step-action-primary"
                      onClick={() => {
                        showToast(
                          step.status === "ready"
                            ? `已记 · ${step.title} → ${step.role}`
                            : `已催改派 · ${step.title}`,
                        );
                        setModal(null);
                      }}
                    >
                      {step.status === "ready" ? `派给 ${step.role.split(" ")[0].split("/")[0]}` : "催促改派"}
                    </button>
                    {step.id === "w1" && (
                      <button
                        type="button"
                        className="xuan-btn"
                        data-testid="step-action-notes"
                        onClick={() => {
                          setSection("drafts");
                          setSelectedBoardId("s-01");
                          setModal(null);
                          showToast("打开课表 Skill · 学课 · 飞书通");
                        }}
                      >
                        打开课表笔记
                      </button>
                    )}
                    <button
                      type="button"
                      className="xuan-btn"
                      onClick={() => setModal(null)}
                    >
                      关闭
                    </button>
                  </div>
                </div>
              );
            })()}

            {modal === "edit" && (
              <div className="space-y-3 text-[13px]" data-testid="modal-edit">
                <p className="text-[color:var(--studio-muted)]">
                  分区：{PILL_NAV.find((p) => p.id === section)?.label ?? section}
                  {selected ? ` · 选中 ${selected.title}` : ""}
                </p>
                <label className="block">
                  <span className="text-[10px] text-[color:var(--studio-muted)]">窗口标题</span>
                  <input
                    data-testid="edit-title-field"
                    defaultValue={winTitle}
                    className="mt-1 w-full rounded-[10px] border border-[color:var(--studio-border)] bg-black/20 px-3 py-2 outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        commitTitle((e.target as HTMLInputElement).value);
                        setModal(null);
                        showToast("标题已更新");
                      }
                    }}
                    id="edit-win-title"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="xuan-btn xuan-btn-primary flex-1 justify-center"
                    onClick={() => {
                      const el = document.getElementById("edit-win-title") as HTMLInputElement | null;
                      commitTitle(el?.value ?? winTitle);
                      setEditMode(true);
                      setModal(null);
                      showToast("已进入编辑 · 可改标题 / 点条目");
                    }}
                  >
                    保存并编辑
                  </button>
                  <button
                    type="button"
                    className="xuan-btn"
                    onClick={() => {
                      setEditingTitle(true);
                      setModal(null);
                    }}
                  >
                    只改标题
                  </button>
                </div>
              </div>
            )}

            {modal === "manage" && (
              <div className="space-y-3 text-[13px]" data-testid="modal-manage">
                <p className="text-[11px] text-[color:var(--studio-muted)]">
                  分区与内容 · 点击跳转
                </p>
                <div className="grid gap-1.5">
                  {PILL_NAV.map((nav) => {
                    const hub = hubs.find((h) => SECTION_TO_HUB[nav.id] === h.key);
                    const count =
                      hub ? hub.rows.length
                      : nav.id === "drafts" ? SKILLS.length
                      : nav.id === "ideas" ? WORKFLOW_STEPS.length
                      : nav.id === "works" ? WORK_SLOTS.length
                      : nav.id === "calendar" ? tickets.length
                      : nav.id === "database" ? SKILLS.length + WORKFLOW_STEPS.length
                      : hubs.length;
                    return (
                      <button
                        key={nav.id}
                        type="button"
                        data-manage={nav.id}
                        className={cn(
                          "xuan-btn w-full justify-between",
                          section === nav.id && "xuan-btn-primary",
                        )}
                        onClick={() => {
                          setSection(nav.id);
                          setModal(null);
                          showToast(`打开 · ${nav.label}`);
                        }}
                      >
                        <span>{nav.label} <small className="opacity-60">{nav.en}</small></span>
                        <span className="tabular-nums opacity-70">{count}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2 border-t border-[color:var(--studio-border)] pt-3">
                  {["同步 Skill 库", "刷新流水线状态", "导出待办 CSV"].map((a) => (
                    <button
                      key={a}
                      type="button"
                      className="xuan-btn"
                      onClick={() => {
                        showToast(`${a} · 已排队（本地）`);
                      }}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {modal === "create" && (() => {
              const target = hubs.find((h) => h.key === activeHubKey) ?? hubs[0];
              return (
              <div className="space-y-3 text-[13px]" data-testid="modal-create">
                <p className="text-[11px] text-[color:var(--studio-muted)]">
                  将添加到当前模块 · <b className="text-[color:var(--studio-text)]">{target.label}</b>
                  <span className="opacity-60"> · {target.en}</span>
                </p>
                <label className="block">
                  <span className="text-[10px] text-[color:var(--studio-muted)]">
                    条目标题
                  </span>
                  <input
                    data-testid="create-title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={`写一条${target.label}条目…`}
                    className="mt-1 w-full rounded-[10px] border border-[color:var(--studio-border)] bg-black/20 px-3 py-2 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] text-[color:var(--studio-muted)]">目标模块</span>
                  <select
                    data-testid="create-hub"
                    value={activeHubKey}
                    onChange={(e) => setActiveHubKey(e.target.value as HubKey)}
                    className="mt-1 w-full rounded-[10px] border border-[color:var(--studio-border)] bg-black/20 px-3 py-2 outline-none"
                  >
                    {hubs.map((h) => (
                      <option key={h.key} value={h.key}>
                        {h.label} · {h.en}（{h.rows.length}）
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="xuan-btn xuan-btn-primary w-full justify-center"
                  data-testid="create-submit"
                  onClick={() => {
                    const title = newTitle.trim() || `未命名 · ${target.label}`;
                    const id = `row-local-${Date.now()}`;
                    const row = {
                      id,
                      title,
                      a: "手动新建",
                      b: "tang",
                      c: "新",
                    };
                    setHubs((prev) => {
                      const next = prev.map((h) =>
                        h.key === target.key
                          ? { ...h, rows: [row, ...h.rows], n: h.rows.length + 1 }
                          : h,
                      );
                      persistHubs(next);
                      return next;
                    });
                    if (target.section === "calendar") {
                      setTickets((prev) => [
                        { id, title, detail: "手动新建", owner: "tang" },
                        ...prev,
                      ]);
                    }
                    setSelectedBoardId(id);
                    setModal(null);
                    setNewTitle("");
                    if (target.section !== "workspace") setSection(target.section as SectionId);
                    else setSection("workspace");
                    showToast(`已加入 ${target.label} · ${title}`);
                  }}
                >
                  加入 {target.label}
                </button>
              </div>
              );
            })()}
          </div>
        </div>
      )}

      {toast && (
        <div className="xuan-toast pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full px-4 py-2 text-[12px] font-medium shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/** Desktop workspace hubs (plate frame ~6.5s) with real rows. */

/** Landing plate nodes → sections (real counts). */
const LANDING_NODES: LandingNode[] = [
  { key: "top", section: "ideas", n: WORKFLOW_STEPS.length, label: "灵感池", en: "Workflow", sub: "8 步拉新流水线" },
  { key: "left", section: "works", n: WORK_SLOTS.length, label: "作品库", en: "Works", sub: "ep01 待发布" },
  { key: "ll", section: "drafts", n: SKILLS.length, label: "创作池", en: "Skills", sub: "已装 Skill" },
  { key: "right", section: "database", n: SKILLS.length + WORKFLOW_STEPS.length, label: "数据库", en: "Database", sub: "Skill + 流程" },
  { key: "lr", section: "calendar", n: CAL_MARKS.size, label: "日历表", en: "Calendar", sub: `${PENDING_TICKETS.length} 条待办` },
];

const NEURAL_MODULES: {
  id: SectionId;
  n: number;
  label: string;
  en: string;
}[] = [
  { id: "workspace", n: WORKFLOW_STEPS.length, label: "工作台", en: "WORKSPACE" },
  { id: "database", n: SKILLS.length + WORKFLOW_STEPS.length, label: "数据库", en: "DATABASE" },
  { id: "works", n: WORK_SLOTS.length, label: "作品库", en: "WORKS" },
  { id: "calendar", n: CAL_MARKS.size, label: "日历表", en: "CALENDAR" },
  { id: "drafts", n: SKILLS.length, label: "创作池", en: "SKILLS" },
  { id: "ideas", n: WORKFLOW_STEPS.length, label: "灵感池", en: "WORKFLOW" },
];

/**
 * Workspace spider-web: left neural hubs + right board list,
 * thin straight light-gray lines fanning from hubs to each row (plexus).
 * List = real pipeline / skills / pending — never Xuan demo titles.
 */
function NeuralModuleMap({
  items,
  selectedId,
  onOpen,
  onSelectItem,
}: {
  items: BoardItem[];
  selectedId: string | null;
  onOpen: (id: SectionId) => void;
  onSelectItem: (item: BoardItem) => void;
}) {
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const hubRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const rowRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const [lines, setLines] = React.useState<
    { x1: number; y1: number; x2: number; y2: number; key: string }[]
  >([]);

  const layoutLines = React.useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const hubIds = ["works", "drafts", "ideas", "database"] as SectionId[];
    const hubs = hubIds
      .map((id) => hubRefs.current[id])
      .filter(Boolean) as HTMLButtonElement[];
    if (!hubs.length || items.length === 0) {
      setLines([]);
      return;
    }
    const next: typeof lines = [];
    items.forEach((item, wi) => {
      const row = rowRefs.current[item.id];
      if (!row) return;
      const rr = row.getBoundingClientRect();
      const preferred =
        hubRefs.current[item.hub] || hubs[wi % hubs.length];
      const hr = preferred.getBoundingClientRect();
      const x1 = hr.right - wr.left - 4;
      const y1 = hr.top + hr.height * 0.45 - wr.top;
      const x2 = rr.left - wr.left + 2;
      const y2 = rr.top + rr.height * 0.5 - wr.top;
      next.push({
        x1,
        y1,
        x2,
        y2,
        key: `${preferred.dataset.hub}-${item.id}`,
      });
    });
    setLines(next);
  }, [items]);

  React.useEffect(() => {
    layoutLines();
    const ro = new ResizeObserver(() => layoutLines());
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", layoutLines);
    const t = window.setTimeout(layoutLines, 80);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", layoutLines);
      window.clearTimeout(t);
    };
  }, [layoutLines]);

  return (
    <div
      ref={wrapRef}
      className="studio-glass studio-neural-map studio-neural-plexus relative overflow-hidden"
    >
      <svg
        className="studio-neural-map-svg pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <line
            key={`lat-${i}`}
            x1="4%"
            y1={`${8 + i * 7}%`}
            x2="48%"
            y2={`${12 + i * 6.5}%`}
            stroke="rgba(236,236,233,0.06)"
            strokeWidth={0.6}
          />
        ))}
        {lines.map((l) => (
          <line
            key={l.key}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="rgba(220,225,235,0.42)"
            strokeWidth={0.85}
            strokeLinecap="round"
          />
        ))}
      </svg>

      <div className="relative z-[1] grid min-h-0 gap-3 p-3 lg:min-h-[420px] lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.95fr)]">
        <div className="studio-neural-hubwrap relative min-h-0 lg:min-h-[320px]">
          <div className="studio-neural-core studio-neural-core-left" aria-hidden>
            <span className="studio-neural-core-badge">关系图</span>
          </div>
          <div className="studio-neural-hubs">
            {NEURAL_MODULES.map((m) => (
              <button
                key={m.id}
                type="button"
                data-hub={m.id}
                ref={(el) => {
                  hubRefs.current[m.id] = el;
                }}
                className="studio-neural-node studio-glass cursor-pointer px-2.5 py-2"
                onClick={() => onOpen(m.id)}
                aria-label={`打开${m.label}`}
              >
                <span className="studio-neural-node-orb" aria-hidden />
                <p className="text-lg font-semibold tabular-nums leading-none">
                  {m.n}
                </p>
                <p className="mt-0.5 text-[11px] font-medium">{m.label}</p>
                <p className="text-[9px] tracking-wider text-[color:var(--studio-muted)]">
                  {m.en}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="studio-neural-list relative flex min-h-[280px] flex-col rounded-[12px] border border-[color:var(--studio-border)] bg-black/20 p-2">
          <p className="mb-2 px-1 text-[10px] font-semibold tracking-[0.14em] text-[color:var(--studio-muted)]">
            流水线 · Skill · 待办
          </p>
          <ul className="flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  ref={(el) => {
                    rowRefs.current[item.id] = el;
                  }}
                  className={cn(
                    "w-full rounded-[8px] px-2.5 py-2 text-left transition-colors hover:bg-white/5",
                    selectedId === item.id && "bg-white/8",
                  )}
                  onClick={() => onSelectItem(item)}
                >
                  <p className="line-clamp-2 text-[12px] font-medium leading-snug">
                    {item.title}
                  </p>
                  <p className="mt-0.5 flex flex-wrap gap-2 text-[9px] text-[color:var(--studio-muted)]">
                    <span>{item.status}</span>
                    <span>{item.meta}</span>
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SectionPane({
  icon,
  title,
  en,
  desc,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  en: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <header className="flex items-start gap-2">
        <span className="mt-1 text-[color:var(--studio-accent)]">{icon}</span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            {title}
            <span className="ml-2 text-[12px] font-normal text-[color:var(--studio-muted)]">
              {en}
            </span>
          </h1>
          <p className="mt-0.5 text-[12px] text-[color:var(--studio-muted)]">
            {desc}
          </p>
        </div>
      </header>
      {children}
    </div>
  );
}
