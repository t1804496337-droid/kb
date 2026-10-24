/**
 * 第二主题子模块注册表：路由 id → 页面组件。
 * 9 子模块 + 3 个非模块环位详情页（snapshot / exec-log / health-sync）。
 * decision 不在此列——环位点击直接跳第一主题落地页（见 ring-home 映射）。
 */

import type { ComponentType } from "react";
import RingInspiration from "./ring-inspiration";
import RingSkills from "./ring-skills";
import RingWorks from "./ring-works";
import RingDatabase from "./ring-database";
import RingOntology from "./ring-ontology";
import RingCalendar from "./ring-calendar";
import RingHealth from "./ring-health";
import RingFinance from "./ring-finance";
import RingStudio from "./ring-studio";
import RingSnapshot from "./ring-snapshot";
import RingExecLog from "./ring-exec-log";
import RingHealthSync from "./ring-health-sync";

export const MODULE_VIEWS: Record<string, ComponentType> = {
  inspiration: RingInspiration,
  skills: RingSkills,
  works: RingWorks,
  database: RingDatabase,
  ontology: RingOntology,
  calendar: RingCalendar,
  health: RingHealth,
  finance: RingFinance,
  studio: RingStudio,
  snapshot: RingSnapshot,
  "exec-log": RingExecLog,
  "health-sync": RingHealthSync,
};
