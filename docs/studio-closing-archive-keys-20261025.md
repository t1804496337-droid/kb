# 附录：快照键表 · 总线表 · 断点与 PR 文件清单

> 基线：`origin/main = 3e0ae00`。全部取自仓库文件实测（A 类），与主文档 `docs/studio-closing-archive-20261025.md` 同基线。
> 铁律：本表只列已登记的键，不许新增；任何新键先登记再写。

## A. 快照键表（`src/components/studio/snapshot.ts`，共 32 片）

组成：24 个 `jsonSlice` + 4 个 `flagSlice` + 1 个 `budget` + 3 个 `raw`。
注意：`grep -c "jsonSlice|flagSlice"` 得 30（含 2 处 helper 定义），不是 32。

### A1. jsonSlice（24）

| 行 | name | key | 登记说明 |
|---|---|---|---|
| 198 | financeEntries | `studio_finance_entries_v1` | 财务 |
| 199 | financeLiabilities | `studio_finance_liabilities_v1` | 财务 |
| 200 | financeAssets | `studio_finance_assets_v1` | 财务 |
| 203 | financeSubscriptions | `studio_finance_subscriptions_v1` | 财务 |
| 213 | decisionPicks | `studio_decision_picks_v1` | 决策栈意向 |
| 217 | decisionArchived | `studio_decision_archived_v1` | 决策栈归档 |
| 222 | execLog | `studio_exec_log_v1` | 终端业务日志 |
| 237 | skillsCollapsed | `studio_skills_collapsed_v1` | 技能库折叠（与第一主题 SkillsBody 共用） |
| 239 | calendarItems | `studio_calendar_items_v1` | 日历事项 |
| 240 | workflowSteps | `studio_workflow_steps_v2` | 灵感池步骤（灵感池 / 创作空间同源） |
| 242 | healthCheckins | `studio_health_checkins_v1` | 健康打卡 |
| 245 | healthManual | `studio_health_manual_v1` | 健康手动同步 |
| 255 | ancientCheckins | `studio_ancient_checkins_v1` | 健康·古法打卡 |
| 260 | worksChannelsIntent | `studio_works_channels_intent_v1` | 作品库·视频号意向（`{workId:true}`，删作品不连带删） |
| 265 | worksItems | `studio_works_items_v1` | 作品库作品 |
| 267 | customModules | `studio_custom_modules_v1` | 自定义模块 |
| 270 | customRows | `studio_custom_rows_v1` | 自定义模块行 |
| 271 | hubRows | `studio_hub_rows_v1` | 工作台枢纽行 |
| 279 | headCopy | `studio_head_copy_v1` | 工作台头部文案 |
| 303 | ontologyNotes | `studio_ontology_notes_v1` | 本体·站内笔记 |
| 305 | skillsOpen | `studio_skills_open_v1` | 技能库开合·UI 态 |
| 306 | dbOpen | `studio_db_open_v1` | 数据库开合·UI 态 |
| 308 | mindmap | `studio_mindmap_v1` | 灵感拓扑 |
| 310 | worksSyncCache | `studio_works_sync_v1` | 作品库同步缓存（只读呈现） |

### A2. flagSlice（4）

| 行 | name | key | 登记说明 |
|---|---|---|---|
| 211 | financeSeeded | `studio_finance_seeded_v1` | 财务·种子标记 |
| 275 | seededModules | `studio_seeded_modules_v1` | 自定义模块·种子标记 |
| 276 | seededModulesV2 | `studio_seeded_modules_v2` | 自定义模块·种子标记 |
| 277 | purgedLegacySteps | `studio_purged_legacy_steps_v1` | 旧步骤清理·迁移标记 |

### A3. budget（1）+ raw（3）

| 行 | name | key | kind | 说明 |
|---|---|---|---|---|
| 206 | （财务预算） | `studio_finance_budget_v1` | budget | 存储为数字字符串，快照归一为数字 |
| 231 | marquee | `studio_marquee_v1` | raw | 纯字符串片；缺省标语不落盘 |
| 286 | windowTitle | `studio_window_title` | raw | 纯字符串片（注意：无 `_v1` 后缀，与其他键不同） |
| 295 | obsidianVault | `studio_obsidian_vault_v1` | raw | 库名，纯字符串片；与 windowTitle 同编码 |

### A4. 非快照数据文件（不在 32 片内）

| 文件 | 说明 |
|---|---|
| `public/skills-sync.json` | 技能源文件，agent 经 push API 维护；第二主题只读，绝不写入 |
| `public/health-sync.json` | 健康同步文件，晨间机器提交直写 main；格式见 `docs/health-sync.md` |
| `public/works-sync.json` | HEAD 不存在；作品同步卡以“尚未投递 + 未接入”空态呈现 |

## B. 总线事件表（`src/components/studio/bus.ts`，共 10 个类型，2/3/4 批零新增）

| 事件类型 | 第二主题使用情况 |
|---|---|
| `FINANCE_ADD_ENTRY` / `FINANCE_DELETE_ENTRY` | 财务（既有类型，BATCH1 前已存在） |
| `DECISION_ARCHIVE` / `DECISION_RESTORE` / `DECISION_PICK` | 第一主题决策栈；第二主题重构未发 |
| `SNAPSHOT_IMPORT` | 第一主题快照导入；第二主题重构未发 |
| `HEALTH_SYNC` | 健康发出（BATCH2；注意：新 main 里 ring-health 与 neural-landing 均有 emit，BATCH3 不用它） |
| `STUDIO_STAGE_MOVE` | 灵感池（`moduleId=inspiration`）与创作空间（`moduleId=studio`）发出 |
| `MINDMAP_NODE` / `MINDMAP_EDGE` | 第一主题灵感拓扑；第二主题重构未发 |

第二主题重构的 emit 铁律：作品库 / 本体 / 数据库 / 技能库 `emit(` 0 命中（diff 实测）。

## C. 断点清单（`src/components/ring/modules/styles/modules.css`，HEAD 实测）

| 档位 | 数量 | 来源 |
|---|---|---|
| `@media (max-width: 1180px)` | 6 处 | 各批新增（死锁档位，1180 以下单列） |
| `@media (max-width: 900px)` | 2 处 | 旧批次遗留，各批未新增 |
| `max-width: 120px` 属性 | 1 处 | 旧批次遗留，非媒体查询，不在任何一批 diff 内 |

## D. PR 文件清单（A 类 gh API 实测）

| PR | 合并提交 | 增减 | 文件 |
|---|---|---|---|
| #101 财务 v2 | `56ba75f` | +2080/−35 | `finance-calc.ts`（新建）、`ring-finance.tsx`、`ring-module-shell.tsx`、`styles/modules.css` |
| #102 顶栏修复 | `e3bd41c` | +79/−9 | `src/app/globals.css`、`ring/final/neural.mount.ts`、`neural-landing.tsx`、`theme-switcher.css`、`theme-switcher.tsx` |
| #103 第二批三模块 | `7c3559e` | +2158/−12 | `ring-calendar.tsx`、`ring-health.tsx`、`ring-inspiration.tsx`、`styles/modules.css` |
| #104 第三批四模块 | `b9bafe2` | +2401/−16 | `ring-database.tsx`、`ring-ontology.tsx`、`ring-studio.tsx`、`ring-works.tsx`、`styles/modules.css` |
| #105 技能库收官 | `3e0ae00` | +698/−4 | `ring-skills.tsx`、`styles/modules.css` |

## E. QA 脚本清单（A 类路径与结构实测；运行数字为 B 类）

| 脚本 | `check(` 匹配数（含定义 1 个） | TOTAL 计算式 | 报告口径 |
|---|---|---|---|
| `~/workspace/login-qa/batch2-qa.js` | 46 | `results.length`；PASS = 总数 − 失败数 | TOTAL 46（45 PASS + 1 SKIP，0 FAIL） |
| `~/workspace/login-qa/batch3-qa.js` | 43 | 同上 | TOTAL 43（42 PASS + 1 SKIP，0 FAIL） |
| `~/workspace/login-qa/batch4-qa.js` | 33 | `PASS = total − fails − skips`，SKIP 单列 | TOTAL 32（32 PASS，0 FAIL，0 SKIP） |
| `~/workspace/login-qa/fin-v2-qa.js` | 37 | PASS 数 / 总数 | 36/36 |
| `~/workspace/login-qa/fin-smoke.js` | 7 | `results.length`；PASS = 总数 − 失败数 | 6/6 |

SKIP 说明：BATCH2 / BATCH3 的 SKIP 各 1 条，均为第一主题侧 best-effort 探查未命中（选择器差异），非失败；BATCH4 的 SKIP 分支为 clipboard 读不到时的条件兜底，本轮未触发。
