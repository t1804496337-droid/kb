/**
 * 全站 Local-First 快照层（2026-10-22，hud-persistence）。
 *
 * 职责边界：只做盘点 / 打包 / 校验 / 恢复——各组件现有的 localStorage
 * 读写路径一律不动。登记册（SLICES）覆盖 src/ 全量 grep 到的全部用户
 * 数据键（含旧工作台层遗留在 page.tsx 的键）；登录会话键
 * `studio_session` 不是用户数据，刻意不登记，快照永不触碰登录态。
 *
 * 存储编码按各键的现网格式逐片适配：
 * - json：绝大多数键，JSON 序列化对象/数组；
 * - budget：财务预算在存储里是纯数字字符串（如 "2500"），快照里归一为数字；
 * - flag：种子/迁移标记键，存储值恒为 "1"，快照里归一为 boolean；
 * - raw：窗口标题，存储即原文字符串。
 *
 * 导入三道保险（用户 2026-10-22 拍板）：信封不符整体拒收零写入 →
 * 写入前先把当前状态整包存进回滚键 studio_pre_import_backup →
 * 逐片形状校验，校验不过的片跳过，未知片忽略。撤销导入按同一
 * 逐片流程把回滚包写回（回滚包里的 null 片 = 恢复为「不存在」）。
 */

export const SNAPSHOT_APP = "kb-studio";
export const SNAPSHOT_KIND = "second-brain-snapshot";
export const SNAPSHOT_VERSION = 1;
export const PRE_IMPORT_BACKUP_KEY = "studio_pre_import_backup";

/* ── 形状校验小工具：宁松勿误杀合法数据，明显异形必须拒 ── */

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isDateStr = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

const isFiniteNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** 数组片：必须是数组且每个元素都过形状（与各模块自己的读取过滤同口径）。 */
const arrayOf =
  (itemOk: (el: unknown) => boolean) =>
  (v: unknown): boolean =>
    Array.isArray(v) && v.every(itemOk);

/** Record<string, boolean> 片（折叠/开合态）。 */
const isBoolRecord = (v: unknown): boolean =>
  isPlainObject(v) && Object.values(v).every((x) => typeof x === "boolean");

/* ── 逐片校验 ── */

const okFinanceEntry = (e: unknown): boolean =>
  isPlainObject(e) &&
  typeof e.id === "string" &&
  isDateStr(e.date) &&
  (e.kind === "income" || e.kind === "expense") &&
  isFiniteNum(e.amount) &&
  typeof e.category === "string";

const okFinanceLiability = (l: unknown): boolean =>
  isPlainObject(l) &&
  typeof l.id === "string" &&
  typeof l.name === "string" &&
  isFiniteNum(l.total) &&
  isFiniteNum(l.remaining);

const okFinanceAsset = (a: unknown): boolean =>
  isPlainObject(a) &&
  typeof a.id === "string" &&
  typeof a.name === "string" &&
  isFiniteNum(a.cost);

const okCalItem = (i: unknown): boolean =>
  isPlainObject(i) &&
  typeof i.date === "string" &&
  typeof i.title === "string";

const okFlowStep = (s: unknown): boolean =>
  isPlainObject(s) &&
  typeof s.title === "string" &&
  (s.zone === "me" || s.zone === "ai" || s.zone === "agent");

const okModuleRow = (r: unknown): boolean =>
  isPlainObject(r) && typeof r.id === "string" && typeof r.title === "string";

const okBudget = (v: unknown): boolean => budgetNumber(v) !== null;

/** 预算归一：接受数字、数字字符串、或带数字字段的历史对象形状。 */
export function budgetNumber(v: unknown): number | null {
  if (isFiniteNum(v)) return v > 0 ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (isPlainObject(v)) {
    for (const k of ["monthly", "amount", "value", "budget"]) {
      if (isFiniteNum(v[k]) && (v[k] as number) > 0) return v[k] as number;
    }
  }
  return null;
}

const okFlag = (v: unknown): boolean =>
  typeof v === "boolean" || v === "1" || v === 1 || v === "0" || v === 0;

/* 灵感拓扑（mind-map.tsx）：nodes/edges/view 全形状校验 */
const okMindmap = (v: unknown): boolean =>
  isPlainObject(v) &&
  Array.isArray(v.nodes) &&
  v.nodes.every(
    (n) =>
      isPlainObject(n) &&
      typeof n.id === "string" &&
      isFiniteNum(n.x) &&
      isFiniteNum(n.y) &&
      typeof n.text === "string",
  ) &&
  Array.isArray(v.edges) &&
  v.edges.every(
    (e) =>
      isPlainObject(e) &&
      typeof e.id === "string" &&
      typeof e.from === "string" &&
      typeof e.to === "string",
  ) &&
  isPlainObject(v.view) &&
  isFiniteNum(v.view.s) &&
  isFiniteNum(v.view.tx) &&
  isFiniteNum(v.view.ty);

/* ── 登记册 ── */

type SliceKind = "json" | "budget" | "flag" | "raw";

export type SliceDef = {
  /** 快照信封 slices 里的片名。 */
  name: string;
  /** 现网 localStorage 键名（与各模块读写完全一致）。 */
  key: string;
  /** 所属模块（盘点/回报用）。 */
  module: string;
  kind: SliceKind;
  validate: (v: unknown) => boolean;
};

const jsonSlice = (
  name: string,
  key: string,
  module: string,
  validate: SliceDef["validate"],
): SliceDef => ({ name, key, module, kind: "json", validate });

const flagSlice = (name: string, key: string, module: string): SliceDef => ({
  name,
  key,
  module,
  kind: "flag",
  validate: okFlag,
});

export const SLICES: SliceDef[] = [
  /* 财务（hud-module-content FinanceBody，与旧层 page.tsx 同键） */
  jsonSlice("financeEntries", "studio_finance_entries_v1", "财务", arrayOf(okFinanceEntry)),
  jsonSlice("financeLiabilities", "studio_finance_liabilities_v1", "财务", arrayOf(okFinanceLiability)),
  jsonSlice("financeAssets", "studio_finance_assets_v1", "财务", arrayOf(okFinanceAsset)),
  {
    name: "financeBudget",
    key: "studio_finance_budget_v1",
    module: "财务",
    kind: "budget",
    validate: okBudget,
  },
  flagSlice("financeSeeded", "studio_finance_seeded_v1", "财务·种子标记"),
  /* 决策意向 / 技能折叠（HUD 现网） */
  jsonSlice("decisionPicks", "studio_decision_picks_v1", "决策栈意向", (v) =>
    isPlainObject(v) && Object.values(v).every((x) => typeof x === "string"),
  ),
  /* 决策归档名单（2026-10-22, hud-restyle）：字符串数组（决策 id） */
  jsonSlice("decisionArchived", "studio_decision_archived_v1", "决策栈归档", arrayOf(
    (v) => typeof v === "string",
  )),
  /* 终端业务日志（2026-10-22, hud-bus-pulse；结构化升级 hud-ux-dock）：
   * 旧形态 {ts, text} 与新形态 {ts, type, module, detail?} 两种都收。 */
  jsonSlice("execLog", "studio_exec_log_v1", "终端业务日志", arrayOf(
    (v) =>
      isPlainObject(v) &&
      isFiniteNum(v.ts) &&
      (typeof v.text === "string" || typeof v.type === "string"),
  )),
  /* 顶部跑马灯标语（2026-10-22, hud-ux-dock）：用户可编辑的纯
   * 字符串片（raw，与 windowTitle 同编码）；缺省标语不落盘。 */
  {
    name: "marquee",
    key: "studio_marquee_v1",
    module: "顶部标语",
    kind: "raw",
    validate: (v) => typeof v === "string" && v.length >= 1 && v.length <= 200,
  },
  jsonSlice("skillsCollapsed", "studio_skills_collapsed_v1", "技能库折叠", isBoolRecord),
  /* 日历事项 / 灵感池步骤（HUD 与旧层共用同键） */
  jsonSlice("calendarItems", "studio_calendar_items_v1", "日历事项", arrayOf(okCalItem)),
  jsonSlice("workflowSteps", "studio_workflow_steps_v2", "灵感池步骤", arrayOf(okFlowStep)),
  /* 健康打卡（旧工作台层，page.tsx） */
  jsonSlice("healthCheckins", "studio_health_checkins_v1", "健康打卡", arrayOf(isDateStr)),
  /* 健康手动同步（2026-10-22, hud-health-sync）：剪贴板解析口落盘的
   * 单条 ManualHealth——date 必备，sleepHours/steps 至少一项。 */
  jsonSlice("healthManual", "studio_health_manual_v1", "健康手动同步", (v) =>
    isPlainObject(v) &&
    isDateStr(v.date) &&
    (v.sleepHours === undefined || isFiniteNum(v.sleepHours)) &&
    (v.sleepStart === undefined || typeof v.sleepStart === "string") &&
    (v.sleepEnd === undefined || typeof v.sleepEnd === "string") &&
    (v.steps === undefined || (isFiniteNum(v.steps) && (v.steps as number) >= 0)) &&
    (v.sleepHours !== undefined || v.steps !== undefined),
  ),
  /* 自定义模块与枢纽行（旧工作台层，page.tsx） */
  jsonSlice("customModules", "studio_custom_modules_v1", "自定义模块", arrayOf(
    (m) => isPlainObject(m) && typeof m.id === "string" && typeof m.label === "string",
  )),
  jsonSlice("customRows", "studio_custom_rows_v1", "自定义模块行", arrayOf(okModuleRow)),
  jsonSlice("hubRows", "studio_hub_rows_v1", "工作台枢纽行", (v) =>
    isPlainObject(v) &&
    Object.values(v).every((rows) => Array.isArray(rows) && rows.every(okModuleRow)),
  ),
  flagSlice("seededModules", "studio_seeded_modules_v1", "自定义模块·种子标记"),
  flagSlice("seededModulesV2", "studio_seeded_modules_v2", "自定义模块·种子标记"),
  flagSlice("purgedLegacySteps", "studio_purged_legacy_steps_v1", "旧步骤清理·迁移标记"),
  /* 文案类（旧工作台层，用户可编辑） */
  jsonSlice("headCopy", "studio_head_copy_v1", "工作台头部文案", (v) =>
    isPlainObject(v) &&
    (typeof v.brand === "string" ||
      typeof v.headline === "string" ||
      typeof v.en === "string"),
  ),
  {
    name: "windowTitle",
    key: "studio_window_title",
    module: "窗口标题",
    kind: "raw",
    validate: (v) => typeof v === "string" && v.length >= 1 && v.length <= 200,
  },
  /* Obsidian 库名（2026-10-22, hud-empower）：本体视图直达用的本机
   * 库名，纯字符串片（raw，与 windowTitle 同编码）。 */
  {
    name: "obsidianVault",
    key: "studio_obsidian_vault_v1",
    module: "本体知识库·Obsidian 库名",
    kind: "raw",
    validate: (v) => typeof v === "string" && v.length >= 1 && v.length <= 200,
  },
  /* UI 临时态（旧工作台层：抽屉/分区开合记忆） */
  jsonSlice("skillsOpen", "studio_skills_open_v1", "技能库开合·UI态", isBoolRecord),
  jsonSlice("dbOpen", "studio_db_open_v1", "数据库开合·UI态", isBoolRecord),
  /* 灵感拓扑（HUD 现网，mind-map.tsx） */
  jsonSlice("mindmap", "studio_mindmap_v1", "灵感拓扑", okMindmap),
  /* 作品库平台同步缓存（拉取数据的本机缓存，非手写数据） */
  jsonSlice("worksSyncCache", "studio_works_sync_v1", "作品库同步缓存", (v) =>
    isPlainObject(v) &&
    isPlainObject(v.platforms) &&
    Object.values(v.platforms).every((list) => Array.isArray(list)),
  ),
];

/* ── 逐片读写（按存储编码适配） ── */

function readSlice(def: SliceDef): unknown {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(def.key);
  } catch {
    return null;
  }
  if (raw === null) return null;
  switch (def.kind) {
    case "flag":
      return true;
    case "raw":
      return raw;
    case "budget": {
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    default:
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
  }
}

function writeSlice(def: SliceDef, value: unknown): void {
  switch (def.kind) {
    case "flag":
      if (value === true || value === "1" || value === 1)
        window.localStorage.setItem(def.key, "1");
      else window.localStorage.removeItem(def.key);
      return;
    case "raw":
      window.localStorage.setItem(def.key, String(value));
      return;
    case "budget": {
      const n = budgetNumber(value);
      if (n !== null) window.localStorage.setItem(def.key, String(n));
      return;
    }
    default:
      window.localStorage.setItem(def.key, JSON.stringify(value));
  }
}

/* ── 信封 ── */

export type SnapshotEnvelope = {
  app: typeof SNAPSHOT_APP;
  kind: typeof SNAPSHOT_KIND;
  version: number;
  exportedAt: string;
  slices: Record<string, unknown>;
};

export function buildSnapshot(): SnapshotEnvelope {
  const slices: Record<string, unknown> = {};
  for (const def of SLICES) slices[def.name] = readSlice(def);
  return {
    app: SNAPSHOT_APP,
    kind: SNAPSHOT_KIND,
    version: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    slices,
  };
}

function isEnvelope(v: unknown): v is SnapshotEnvelope {
  return (
    isPlainObject(v) &&
    v.app === SNAPSHOT_APP &&
    v.kind === SNAPSHOT_KIND &&
    typeof v.version === "number" &&
    v.version <= SNAPSHOT_VERSION &&
    isPlainObject(v.slices)
  );
}

/* ── 导出 ── */

/** 打包当前全部登记片并下载为 second-brain-YYYY-MM-DD.json。 */
export function exportState(): void {
  const snap = buildSnapshot();
  const blob = new Blob([JSON.stringify(snap, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, "0");
  const a = document.createElement("a");
  a.href = url;
  a.download = `second-brain-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ── 逐片应用（导入与撤销共用） ── */

export type ApplyResult = { written: number; skipped: number };

/**
 * 把 slices 逐片写回本机。
 * - nullMeansRemove=false（导入外部快照）：片为 null = 源设备没有此片，跳过；
 * - nullMeansRemove=true（撤销导入）：片为 null = 导入前不存在，删键还原。
 * 未登记的片名忽略；校验不过计数 skipped。
 */
function applySlices(
  slices: Record<string, unknown>,
  nullMeansRemove: boolean,
): ApplyResult {
  let written = 0;
  let skipped = 0;
  for (const def of SLICES) {
    if (!(def.name in slices)) continue;
    const value = slices[def.name];
    if (value === null || value === undefined) {
      /* null = 源快照里没有这片数据：导入时不计写也不计跳（不是失败）；
       * 撤销时它代表「导入前不存在」，删键还原才算一次写入。 */
      if (nullMeansRemove) {
        try {
          window.localStorage.removeItem(def.key);
          written += 1;
        } catch {
          skipped += 1;
        }
      }
      continue;
    }
    if (!def.validate(value)) {
      skipped += 1;
      continue;
    }
    try {
      writeSlice(def, value);
      written += 1;
    } catch {
      skipped += 1;
    }
  }
  return { written, skipped };
}

/* ── 导入 / 撤销 ── */

export type ImportResult =
  | { ok: true; written: number; skipped: number }
  | { ok: false; error: string };

/**
 * 导入快照文件：信封不符 → 整体拒收、零写入；合格 → 先整包备份当前
 * 状态到回滚键，再逐片校验写入。调用方负责成功后 location.reload()。
 */
export async function importState(file: File): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text()) as unknown;
  } catch {
    return { ok: false, error: "文件不是有效的 JSON，未做任何更改" };
  }
  if (!isEnvelope(parsed)) {
    return { ok: false, error: "文件不兼容，未做任何更改" };
  }
  try {
    window.localStorage.setItem(
      PRE_IMPORT_BACKUP_KEY,
      JSON.stringify(buildSnapshot()),
    );
  } catch {
    return { ok: false, error: "本机存储不可用，未做任何更改" };
  }
  const { written, skipped } = applySlices(parsed.slices, false);
  return { ok: true, written, skipped };
}

export function hasPreImportBackup(): boolean {
  try {
    return window.localStorage.getItem(PRE_IMPORT_BACKUP_KEY) !== null;
  } catch {
    return false;
  }
}

/** 撤销上一次导入：把回滚包按同一逐片流程写回并清掉回滚键。 */
export function restorePreImport(): ImportResult {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(PRE_IMPORT_BACKUP_KEY);
  } catch {
    raw = null;
  }
  if (!raw) return { ok: false, error: "没有可撤销的导入记录" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, error: "回滚记录已损坏，无法撤销" };
  }
  if (!isEnvelope(parsed)) {
    return { ok: false, error: "回滚记录已损坏，无法撤销" };
  }
  const { written, skipped } = applySlices(parsed.slices, true);
  try {
    window.localStorage.removeItem(PRE_IMPORT_BACKUP_KEY);
  } catch {
    /* ignore */
  }
  return { ok: true, written, skipped };
}
