/**
 * 第二主题子模块登记表（纯元数据，无组件依赖，供导航壳、路由页共用）。
 *
 * 名单为用户 2026-10-23 23:21 定夺：9 子模块严格沿用第一主题主干
 * 构成（必须含数据库，不设独立「决策」子模块）；snapshot / exec-log /
 * health-sync 是 12 环位中的非模块环位落点（同壳只读详情页），
 * decision 环位点击直接跳第一主题落地页，不在此登记。
 */

export type ModuleMeta = {
  id: string;
  cn: string;
  en: string;
  /** 数据源标注（键名/文件，与 surfaces.ts srcLabel 同口径）。 */
  src: string;
  /** 是否 9 子模块之一（false = 非模块环位详情页）。 */
  isModule: boolean;
};

export const MODULES: ModuleMeta[] = [
  { id: "inspiration", cn: "灵感池", en: "INSPIRATION", src: "studio_workflow_steps_v2 · 流水线步数", isModule: true },
  { id: "skills", cn: "技能库", en: "SKILLS", src: "/skills-sync.json · 技能条数", isModule: true },
  { id: "works", cn: "作品库", en: "WORKS", src: "studio_works_items_v1 · 作品条数", isModule: true },
  { id: "database", cn: "数据库", en: "DATABASE", src: "studio_hub_rows_v1 · 枢纽镜像行", isModule: true },
  { id: "ontology", cn: "本体知识库", en: "ONTOLOGY", src: "studio_ontology_notes_v1 · 条目数", isModule: true },
  { id: "calendar", cn: "日历表", en: "CALENDAR", src: "studio_calendar_items_v1 · 事项数 / 今日", isModule: true },
  { id: "health", cn: "身体健康", en: "HEALTH", src: "studio_health_checkins_v1 + /health-sync.json", isModule: true },
  { id: "finance", cn: "财务管理", en: "FINANCE", src: "studio_finance_entries_v1 · 账目条数", isModule: true },
  { id: "studio", cn: "创作空间", en: "STUDIO", src: "studio_workflow_steps_v2 · StudioBoard 同源", isModule: true },
];

export const DETAIL_PAGES: ModuleMeta[] = [
  { id: "snapshot", cn: "快照登记册", en: "SNAPSHOT", src: "SLICES · 快照登记册（代码实测）", isModule: false },
  { id: "exec-log", cn: "执行日志", en: "EXEC LOG", src: "studio_exec_log_v1 · 上限 20", isModule: false },
  { id: "health-sync", cn: "健康同步", en: "HEALTH-SYNC", src: "/health-sync.json · updated_at → OK / STALE", isModule: false },
];

export const ALL_PAGES: ModuleMeta[] = [...MODULES, ...DETAIL_PAGES];

export const metaOf = (id: string): ModuleMeta | undefined =>
  ALL_PAGES.find((m) => m.id === id);
