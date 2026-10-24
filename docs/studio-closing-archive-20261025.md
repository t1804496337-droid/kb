# Studio 第二主题重建 · 收官归档

> 仓库：`t1804496337-droid/kb`（Next.js，公开仓库）
> 线上：<https://kb-zeta-one.vercel.app/studio>（Vercel 项目 `kb`）
> 第二主题：`/studio/ring`（神经星环 Neural Ring）
> 归档基线：`origin/main = 3e0ae00`（PR #105 合并提交）
> 归档分支：`docs/studio-closing-archive`（本文档所在分支，OPEN 待复核，未合入）
> 归档日期：2026-10-25

## 0. 数字来源说明（先读）

本任务最高要求是“流程代码需要仔细”。本文档所有事实分三类标注，绝不混写：

- **A 类 — gh / git / 仓库文件实测**：PR 号、合并提交 SHA、分支指向、文件清单、增减行数、模块行数、快照键表、总线类型、断点档位、截图与脚本路径。均由归档执行方在基线 `3e0ae00` 上实测。
- **B 类 — 执行方完工报告 + 脚本结构复核**：各批 QA 运行数字。归档时未重复跑全量 QA，但已逐一核对脚本的断言结构（`check(` 调用数、TOTAL 计算式、SKIP 分支是否为条件触发），数字与脚本结构一致才写入；运行本身仍属执行方报告口径。
- **C 类 — 用户工作记录转述**：用户原话、立规日期与情境、队列中的未完事项。来源为用户工作记录（MEMORY），仓库内无独立载体时如实标注，不伪装成 git 核实。

**未能核实而如实标注的项**：

1. “2026-10-20 接手”——仓库内交接文档（`docs/studio-handoff-prompt.md` 等）未载明日期，日期来自用户工作记录，未用 git 独立核实。
2. Vercel 后台“部署保护”开关的界面状态——未进 Vercel 后台核实；2026-10-25 线上探针返回站内登录墙（见 §1），无 Vercel 鉴权墙，与“保护已关闭”一致。
3. 各批 QA 运行数字——见 B 类说明。
4. 用户原话——C 类，逐条标日期与情境。

**与简报锚点不一致的发现（已核实）**：

1. 简报主干链 `56ba75f → 7c3559e → b9bafe2 → 3e0ae00` 漏了 PR #102：完整链是 `e3bd41c（#102，10-24 15:24）→ 56ba75f（#101，16:30）→ 7c3559e（#103，17:37）→ b9bafe2（#104，21:37）→ 3e0ae00（#105，10-25 00:36）`。#102 合并时间早于 #101。
2. 简报“第一主题 P0 封板等用户生产确认（PR #95）”表述不精确：PR #95 已合并（`31e320d`，2026-10-23），未完的是用户本人在生产站的确认，不是合并本身。
3. 模块行数以 HEAD 实测为准：日历 722 行（简报旧称 721）、灵感池 643 行（旧称 642）、健康 656 行（旧称 655）。
4. `public/works-sync.json` 在 HEAD 不存在（见 §2.5），作品同步卡以“尚未投递 + 未接入”空态呈现，不是已交付状态。
5. “第一主题零触碰”只适用于第 2/3/4 批模块重构 diff；PR #102 是经用户批准的共享顶栏修复，动了 `neural-landing.tsx`、`theme-switcher.*`、`globals.css`、`ring/final/neural.mount.ts`，属例外而非违规。

---

## 1. 总览

### 1.1 时间线（A 类时间为 git 合并提交时间，CST；C 类为工作记录）

| 日期 | 事件 | 证据 |
|---|---|---|
| 2026-10-20（C） | 接手个人网站 studio（仓库 `t1804496337-droid/kb`） | 用户工作记录；仓库交接文档见 `docs/studio-handoff-prompt.md` |
| 2026-10-21（C） | 留底分支令；外部参考“只补缺失”规；视觉验收纪律 | 用户立规；留底分支见 §1.3 |
| 2026-10-22（C） | 移动端三原则；方案/样机先行；备选必由用户点选 | 用户立规 |
| 2026-10-23（A） | PR #81 星环 S0 合并（`97ded23`，后废弃）；PR #95 本体 gap 合并（`31e320d`） | git log |
| 2026-10-23（C） | 方案审查新规（外部方案先独立验算） | 用户立规 |
| 2026-10-24 08:06（A） | PR #96 最终版星环落地合并（`047944b`）——星环唯一基准 | git log、gh |
| 2026-10-24 08:59（A） | PR #98 九子模块暗色工作台合并（`a61c27b`） | git log、gh |
| 2026-10-24 10:40 / 11:25（A） | PR #99 点击下钻修复、PR #100 子模块 CSS 硬化 + 主题切换器合并 | git log、gh |
| 2026-10-24 15:24（A） | PR #102 两端顶栏修复合并（`e3bd41c`） | git log、gh |
| 2026-10-24 16:30（A） | PR #101 财务 v2 合并（`56ba75f`） | git log、gh |
| 2026-10-24 17:37（A） | PR #103 第二批三模块合并（`7c3559e`） | git log、gh |
| 2026-10-24 21:37（A） | PR #104 第三批四模块合并（`b9bafe2`） | git log、gh |
| 2026-10-25 00:36（A） | PR #105 技能库收官合并（`3e0ae00`）——9 模块全部收官 | git log、gh |
| 2026-10-25 00:45（C） | 用户下令收官归档 | 用户指令 |

### 1.2 最终主干状态（A 类，基线 `3e0ae00`）

- 主干 HEAD：`3e0ae00`（`Merge pull request #105 from feat/ring-batch4-skills-parity`）。
- 第二主题 9 大业务模块全部完成并合入：财务、日历、灵感池、健康、作品库、数据库、本体、创作空间、技能库。
- 线上探针（2026-10-25，`browser.open`）：`https://kb-zeta-one.vercel.app/studio` 直接返回站内登录墙（“请输入神经凭证”账号/密码表单），无 Vercel 鉴权墙；与“Vercel 部署保护已关闭、站内 SITE_AUTH 登录墙”一致。
- 第一主题文件在 2/3/4 批 diff 中零改动（见 §3 各批文件清单；#102 为批准的例外）。

### 1.3 留底与归档分支（A 类）

| 分支 | 指向 | 说明 |
|---|---|---|
| `backup-verified-20261021` | `44a0a8b561c3c927273867bb1de6423180435c9e` | 2026-10-21 已验状态留底（E 首页 + 全部完善 + 健康视频 + 手机端修复），出问题按此整站恢复 |
| `origin/archive/ring-s0-20261023` | `31e320d22666f3ac4615a90ac01bc7ec9be47d61` | 旧星环 S0 归档，截点恰为 PR #95 合并提交；S0 简化版已废弃，唯一基准为 PR #96 ring-port 最终版 |
| `docs/studio-closing-archive` | 本归档分支 | 仅新增 `docs/` 下本文档与附录，未合入 |

### 1.4 模块行数（A 类，HEAD 实测 `wc -l`）

| 模块 | 文件 | 行数 |
|---|---|---|
| 财务 | `src/components/ring/modules/ring-finance.tsx`（另 `finance-calc.ts` 162 行） | 1465 |
| 日历 | `ring-calendar.tsx` | 722 |
| 灵感池 | `ring-inspiration.tsx` | 643 |
| 健康 | `ring-health.tsx` | 656 |
| 作品库 | `ring-works.tsx` | 763 |
| 数据库 | `ring-database.tsx` | 465 |
| 本体 | `ring-ontology.tsx` | 543 |
| 创作空间 | `ring-studio.tsx` | 516 |
| 技能库 | `ring-skills.tsx` | 589 |
| 壳（未重构） | `ring-exec-log.tsx` / `ring-health-sync.tsx` / `ring-snapshot.tsx` | 各 9 行 |
| 星环首页 | `ring-home.tsx` | 47 |

星环资产在主干 `src/components/ring/final/`（`NeuralRing.tsx`、`ring-data.ts`、`ensureThree.ts`、`neural.mount.ts`、`neural.template.ts`），唯一基准为 PR #96 落地版。

---

## 2. 架构与设计决策

### 2.1 方向 E：HUD 仪表盘（C 类，用户拍板）

第二主题定为高密度数据仪表盘：银黑配色、信息密度高、功能丰富；明确不走极简、扁平、稀疏侧边栏路线；审美取向科幻 / 赛博朋克 / 高科技。落地页布局用户拍板：健康 / 财务节点固定左上 / 右上空位；节点全面数据驱动（自定义模块增删自动同步枢纽）。

### 2.2 第一主题零触碰原则（A 类 diff + C 类用户令）

- 第 2/3/4 批（PR #103/#104/#105）的 diff 文件清单中无第一主题文件：`hud-module-content.tsx`、`snapshot.ts`、`bus.ts`、`ring/final/*`、主题切换器、`globals.css` 顶栏均未改动。
- 例外（批准的）：PR #102 共享顶栏修复动了 `neural-landing.tsx`、`theme-switcher.*`、`globals.css`、`ring/final/neural.mount.ts`（见 §3.2），属两端顶栏共用部分，不属模块重构。
- 外部参考代码只许补本站缺失项，严禁替换 / 改动已验的现有部分（2026-10-21 19:15 用户令）。

### 2.3 事件总线与快照键登记制（A 类）

- 总线类型（`src/components/studio/bus.ts`，共 10 个，2/3/4 批零新增类型）：`FINANCE_ADD_ENTRY`、`FINANCE_DELETE_ENTRY`、`DECISION_ARCHIVE`、`DECISION_RESTORE`、`DECISION_PICK`、`SNAPSHOT_IMPORT`、`HEALTH_SYNC`、`STUDIO_STAGE_MOVE`、`MINDMAP_NODE`、`MINDMAP_EDGE`。
- 第二主题重构实际发出的事件只有既有类型：创作空间 / 灵感池发 `STUDIO_STAGE_MOVE`，健康发 `HEALTH_SYNC`；作品库、本体、数据库、技能库零 emit（`emit(` 0 命中，diff 实测）。
- 快照登记（`src/components/studio/snapshot.ts`，共 32 片）：24 个 `jsonSlice` + 4 个 `flagSlice` + 1 个 `budget`（财务预算，存储为数字字符串、快照归一为数字）+ 3 个 `raw`（`marquee`、`windowTitle`、`obsidianVault`，纯字符串片）。注意：`grep -c "jsonSlice|flagSlice"` 得 30（含 2 处 helper 定义），不是 32；32 = 28 个调用 + 1 个 budget + 3 个 raw。完整键表见附录。
- 铁律：不新增任何 `studio_*` 键；不新建孤儿 store / 数据层文件；不新增总线事件类型；新键先登记再写。

### 2.4 断点与移动端（A 类 + C 类）

- 断点死锁 1180px：`styles/modules.css` 在 HEAD 含 `@media (max-width: 1180px)` 6 处、`@media (max-width: 900px)` 2 处（900 档为旧批次遗留，各批新增 @media 只许 1180）；另有 1 处 `max-width: 120px` 属性（旧批次遗留，非媒体查询，不在任何一批 diff 内）。
- 1180 以下单列；技能库右栏在 1180 以下改抽屉（双属性门控，见 §3.6）。
- 移动端三原则（2026-10-22 用户立）：① 拒绝无脑堆叠（<768px 用底部导航 + 上滑抽屉隐藏非核心区，保首屏一屏流）；② 触控交互降级（所有 :hover 关键操作与动效必须有 Touch 等价逻辑）；③ 性能分级（移动端自动屏蔽高开销滤镜，桌面端不受影响）。

### 2.5 数据路线（A 类文件实测 + B/C 类口径）

| 数据 | 路线 | HEAD 状态（A） |
|---|---|---|
| 技能 | `/skills-sync.json`（构建期 import + fetch no-store 双通道） | 已交付：13 条（grokbot 8 / Luna 5），`updated_at` 2026-10-20T16:50:00+08:00 |
| 健康同步 | `/health-sync.json`（晨间机器提交直写 main，格式见 `docs/health-sync.md`） | 已交付：文件存在；数据新鲜度取决于用户手机同步进度，模块显示“数据截至”，不装实时 |
| 作品同步 | `/works-sync.json`（no-store 拉取）+ `studio_works_sync_v1` 只读缓存 | **未交付**：`public/` 下无此文件；作品同步卡以“尚未投递 + 未接入”空态呈现，属预期空态而非故障 |
| 其余模块 | `studio_*` localStorage 键（见附录键表） | 全部已登记，零新增 |

---

## 3. 分模块过程

QA 数字口径统一说明：TOTAL = 脚本 `results` 条数；PASS = 真通过；SKIP 永远单列、不算进 PASS；FAIL 必须为 0。B 类数字的脚本结构均已复核（见 §0）。

### 3.1 财务 v2 —— PR #101（A 类：头 `716a54f`，合并 `56ba75f`，2026-10-24 16:30，+2080/−35，4 文件）

- 目的：第一主题财务全量业务对等重构 v2。
- 文件（A）：新建 `finance-calc.ts`（162 行，纯函数逐字复刻；`isNonConsumption` / `isRepayment` / `fmtMoney` / `FINANCE_ASSET_TYPES` import 自 `@/components/studio/finance-module`）；`ring-finance.tsx` 306 → 1465 行；`ring-module-shell.tsx`（删“回第一主题录入”）；`styles/modules.css`。
- 结构：中区折叠表单 → 明细 → 概览条 → 月度报告（2×3 六卡）→ 分类泳道 → 负债台账 → 资产台账 → 订阅台账（仅展示）；右栏预算 / 现金流 / 选中详情。
- 键（A）：5 财务键全已登记（`entries:198`、`liabilities:199`、`assets:200`、`subscriptions:203`、`budget:206`），零新增片；总线用既有 `FINANCE_ADD_ENTRY` / `FINANCE_DELETE_ENTRY`。
- QA（B）：`fin-v2-qa.js` 36/36；`fin-smoke.js` 6/6（只读零错）。执行方报告口径：种子 2 笔（2026-10-17 日用 ¥22 + 还款 ¥401.54）净 −423.54 / 支出 423.54 / 偿还 401.54；记 ¥22.5 后支出 446.04，与第一主题逐项相等。
- **关键纠偏 —— 订阅空态逃避文案事件（A 类 git 核实 + C 类用户令）**：v2 初版订阅空态写“暂无订阅记录 · 可在第一主题订阅管理中添加”，用户 2026-10-24 16:16 定性为暗度陈仓的逃避文案、PR 一度绝不准合并；整改提交 `716a54f`（即本 PR 头）改为纯中性“暂无活跃订阅”，全仓确认仅此一处逃避文案，16:30 用户复核通过才准合并。git 核实：`716a54f` 的提交信息与 diff 均载明该改动。

### 3.2 两端顶栏修复 —— PR #102（A 类：头 `009d8a2`，合并 `e3bd41c`，2026-10-24 15:24，+79/−9，5 文件）

- 文件（A）：`src/app/globals.css`、`src/components/ring/final/neural.mount.ts`、`src/components/studio/neural-landing.tsx`、`src/components/theme-switcher.css`、`src/components/theme-switcher.tsx`。
- 内容（B）：星环切换器改贴 `.tools` 同行左邻（JS 按缩放系数实算，三档隙 18/19/26px，不碰 `.cap`；用户 15:34 定死保持此实测做法，v2 方案 `fixed right:210px` 已作废）+ 降档链补关辉光 + 大屏 pr cap；追加修复第一主题顶栏内容本征溢出（1152 超 495px、1440 超 202px、1728 超 37px）：`padding-right` 12→20px、≤1780 ACT 火花让位 + 短标签、≤1600 MEM 火花 + SKILLS 指标让位、≤1439 仅顶栏换行；复测右缘距视口 1440→34 / 1728→35 / 1920→35px。
- 本批为 §2.2 所述批准例外：动了两端共用顶栏文件，不属模块重构的零触碰范畴。

### 3.3 第二批三模块 —— PR #103（A 类：头 `7fb00c1`，合并 `7c3559e`，2026-10-24 17:37，+2158/−12，4 文件）

- 文件（A）：`ring-calendar.tsx`（9 → 722 行）、`ring-inspiration.tsx`（9 → 643 行）、`ring-health.tsx`（9 → 656 行）、`styles/modules.css`（+152 行，执行方报告口径）。
- 日历：折叠表单（标题 1–80 / 日期默认今天 / 备注 ≤100 空不带字段 / id `cal-`）+ 7×N 月历（周一首日偏移 `firstDow=(getDay()+6)%7`、可翻月、今日高亮）+ 按日期分组列表（完成切换 / 行内编辑 / 二次确认删除）+ 待办票派生区；不发总线。
- 灵感池：折叠表单（5 字段校验）+ 我 / AI / Agent 三泳道（行内编辑 / 删除、阶段芯片流转 孵化 ⇄ 制作 ⇄ 待发）+ 右栏详情 / 阶段统计；写 `studio_workflow_steps_v2`，发既有 `STUDIO_STAGE_MOVE`（`moduleId=inspiration`）。
- 健康：今日打卡大卡（打卡 / 撤销 + 连续天数）+ 同步指标（读 `/health-sync.json`，静态 import + fetch no-store 双通道，manualWins 手动优先）+ 手动同步表单 + 古法 14 天格子 + 训练清单只读（内容逐字搬运第一主题 HealthBody 常量）；发既有 `HEALTH_SYNC`。
- 键（A）：5 键全已登记（`calendarItems:239`、`workflowSteps:240`、`healthCheckins:242`、`healthManual:245`、`ancientCheckins:255`）。
- QA（B）：`batch2-qa.js` TOTAL 46（45 PASS + 1 SKIP，0 FAIL；SKIP 为 theme-1 calendar card 选择器未命中的 best-effort 探查）。主干生产回归同口径合格（日历 4 / 未完成 3 / 待办票 4 / 完成率 25% / 未来 7 天 1；健康 3/3；手动同步 7.5h / 9000 步生效与清除；古法 2→1→2；1180 单列、月历 / 古法保持 7 列）。
- **关键纠偏**：施工中修复的真 bug（执行方报告）：`isDateStr` 回绕校验 `getMonth()-1===m-1` 误写致全部日期判非法（日历 / 健康两处同改）；健康页 `diet.principles` 实为字符串却按数组 `.map` 致整页崩溃，已按挂载侧口径修正。
- **死信验证（B）**：HEALTH_SYNC 双页同 context 实测——健康页打卡切换后星环首页 HEALTH 面无导航下经 storage 事件实时刷新 3→2→3，路由返回重挂载同为 3；NeuralRing 的 storage 监听覆盖全部 `studio_` 前缀键。
- **用户裁定（C，2026-10-24 17:37）**：训练清单维持逐字搬运，保留“水瓶推举 / 水瓶弯举”不改名（与 2026-10-22 瓶身单手抓握铁律的张力由用户知情保留）。

### 3.4 第三批四模块 —— PR #104（A 类：头 `5e7d4ff`，合并 `b9bafe2`，2026-10-24 21:37，+2401/−16，5 文件）

- 文件（A）：`ring-works.tsx`（9 → 763 行）、`ring-database.tsx`（9 → 465 行）、`ring-ontology.tsx`（9 → 543 行）、`ring-studio.tsx`（9 → 516 行）、`styles/modules.css`。
- 作品库：折叠表单（标题 1–80 必填 / 平台 / 状态自由串默认“待发布”/ 备注 ≤200 / 链接可选 / id `work-${Date.now()}`）→ 作品卡列（状态芯片 · 未同步 · 视频号意向 · 编辑 · 删除）→ 待办票 → 多平台同步卡；右栏选中详情 + 统计。写 `studio_works_items_v1`（snapshot:265）；视频号意向独立键 `studio_works_channels_intent_v1`（:260，`{workId:true}`，删作品不连带删意向）；同步缓存 `studio_works_sync_v1`（:310）只读呈现；不发总线。
- 数据库：分段条（技能索引 `/skills-sync.json` 的 `agents.flatMap(skills)` / 流程索引 `studio_workflow_steps_v2` / 条目索引）+ 单区呈现；分段切换纯前端状态不落盘；右栏详情 + 镜像说明。纯只读、无 CRUD、不发总线。`entryRows` 逐字复刻 DatabaseBody：两条写死作品行（`e-yt-ep01` / `e-sph-ep01`）+ 财务现行 localStorage 映射 + 睡眠汇总行（含 manualWins 合并口径与 STALE / FRESH 判定）。
- 本体：置顶库名条（raw 键 `studio_obsidian_vault_v1`，:296）→ 笔记表单 + 列表 + 行内编辑 + 删除（写 `studio_ontology_notes_v1`，:303；title 1–80 / tag 枚举 灵感 / 干货 / 待办线索 / 人脉 / 消费决策 / 其他 / body ≤2000 可选 / createdAt ISO / id `onto-${Date.now()}`）→ 库内文件清单（`ONTOLOGY_FILES` 只读）+ [OBSIDIAN] 按钮 → 元信息卡；右栏详情 + 统计。不发总线。`openInObsidian` 逐字对齐第一主题：`vault.trim()`，空 → `setNeedVault(true)` + 聚焦输入框、不发链接；否则 `window.open("obsidian://open?vault="+encodeURIComponent(v)+"&file="+encodeURIComponent(file), "_blank")`。
- 创作空间：三泳道按 status 分组（孵化 / 制作 / 待发），与灵感池同写 `studio_workflow_steps_v2`（:240），写前必读最新数组防旧快照覆盖；换道复刻第一主题 StudioBoard 的指针拖拽（pointer 拖起 + `elementFromPoint` 命中 `[data-board-lane]`，落空 / 落回原道不改状态）+ ‹ › 箭头按钮触屏兜底；写盘成功后发既有 `STUDIO_STAGE_MOVE`（`moduleId=studio`，detail 带“标题 → 目标阶段”）；新增入口跳同主题 `/studio/ring/inspiration`，绝不指向第一主题。
- 待办票口径（A 类机制 + B 类断言）：作品 status 为“待发布 / 待公开”成票 + 日历 !done 事项成票，作品库与日历两端计数绝对一致；作品键不存在时按 WorksBody 口径播种两件真实作品并落盘，键已存在（含空数组）照读、删除不复活。
- QA（B）：`batch3-qa.js` TOTAL 43（42 PASS + 1 SKIP，0 FAIL；SKIP 为第一主题作品卡片探查未命中）。关键断言：作品种子 2 件 + 待办票 4 → 新增 3 件 / 票 5 → 改已发布票 4 → 删除回 2 件且意向记录存活；数据库 13/4/5、条目 5 行；本体库名 raw 存取 + Obsidian 编码链接实测；创作空间泳道 2/1/1 → 箭头 1/2/1 → 拖拽 1/1/2 → 同道拖拽无变化 → 平台 sph 落盘 → 跳灵感池同键同步 → 路由返回不丢；第一主题访问后星环写入键 2/4/2 完好；零 pageerror。
- **关键纠偏 —— 平台词表 SYNC / FLOW 两套之辨（A 类 HEAD 核实 + C 类用户裁决）**：方案枚举（youtube / channels / xhs / bili / x）混用了两套词表。HEAD 实测：作品词表 `SYNC_PLATFORMS`（hud-module-content:880）为 douyin / bilibili / youtube / channels / x / tiktok；流程词表 `FLOW_PLATFORMS`（:191）为 xhs / yt / bili / sph / x。执行方按作品 SYNC 版逐字实现作品模块，用户 2026-10-24 21:37 裁决维持 SYNC 版（方案该处确系笔误，严防跨主题脏数据）。
- **关键纠偏 —— 财务种子路径保留（C 类用户批复，2026-10-24 17:54）**：数据库文件含第一主题 loader 自带的财务种子写入路径（键不存在时写既有财务键与种子标记）。用户批复保留，理由：对等原则防冷启动两主题数据不一致；写入的是既有合法财务键，零新增快照。
- **审查修正（B 类，执行前审查留痕）**：基线用合入后 HEAD 而非方案封面号；`needVault` 复位是“库名输入变非空时清除”，非方案写的 1.5 秒定时器；本体笔记是平铺列表，无“按标签三区分组”，清单该验收项表述错误、不许凭空造分组；快照自检口径见 §2.3。

### 3.5 技能库收官 —— PR #105（A 类：头 `1028d63`，合并 `3e0ae00`，2026-10-25 00:36，+698/−4，2 文件）

- 文件（A）：`ring-skills.tsx`（9 → 589 行）、`styles/modules.css`（+114 行）。
- 定位：只读镜像中枢，本地不做 CRUD。数据源 `/skills-sync.json`（13 条，见 §2.5）；唯一本地写键 `studio_skills_collapsed_v1`（snapshot:237 已登记，与第一主题 SkillsBody 共用）。
- 结构：三分段（A·AGENT 按 `agents[].id` 分组 + 可折叠；B·标签按 `skill.tag` 分组、组内按 `zh` 排序；C·高密表格 中文名 / EN / TAG / 来源 / 操作，行高 30px，1920 下一屏 ≥20 条）+ 搜索（命中字段 zh / name / tag / source / desc，与第一主题 `match` 同口径；搜索时分组强制展开但不写回折叠态）+ 右栏详情 / 调用控制台 / 同步状态。
- 调用控制台：`COPY PROMPT` 按钮；有 `detail` 复制 detail 全文，无 `detail` 拼装四行调用卡（逐字对齐第一主题 `copySkill`，见附录）；复制反馈成功 1.2s 复原（已复制提示词 / 已复制调用卡），失败留存“复制失败·请检查权限”；三级降级 `clipboard` → `textarea + execCommand` → fail；`detail` 用 `white-space:pre-wrap` 等宽预排版、超高独立滚动 + `overflow-wrap:anywhere`，无 detail 显示“暂未同步详细介绍”。
- 同步：挂载 fetch no-store，失败用构建期 import 副本兜底并标“离线副本”（import 路径照搬数据库 / 创作空间的既成写法）；头部 `[↻ 刷新]` 重拉；跨标签页监听 storage，仅折叠态变化时同步折叠状态，不重拉 json；不做轮询。
- QA（B）：`batch4-qa.js` TOTAL 32（32 PASS，0 FAIL，0 SKIP；脚本内两处 SKIP 为 clipboard 读不到时的条件兜底，本轮未触发）。关键断言：已装 13 条、更新 2026-10-20 16:50、grokbot 8 / Luna 5；A 段折叠写共享键且刷新保持；搜索“分镜”强制展开命中 1 条、清空恢复折叠态；B 段 10 标签组计数逐项核对；C 段高密 13 行、行高实测 30px；无 detail 复制剪贴板与四行调用卡逐字一致、有 detail 技能详情与剪贴板长度同为 3234、按钮 1.2s 复原；刷新、离线兜底、localStorage 仅含折叠键、第一主题访问后折叠键原值不变、1180 单列与抽屉、1920 / 1440 / 1728 横向溢出均为 0、零 pageerror。
- **披露偏差（执行方报告，归档复核无行为打折）**：① 更新时间用 `slice(0,16)` 全格式（清单“HH:MM”为简写）；② 快照 grep 口径见 §2.3；③ 清单断点 grep 模板有笔误（`max-width://s*`），实测新增仅 1180；④ B 段标签组折叠仅本页内存态、不写共享键（防污染与第一主题共用的 agent 折叠记录；清单只要求 A 段折叠持久化）；⑤ 方案 HTML 的 grokbot 14 / luna 3 为旧数据，实测 8/5，QA 按实测断言；⑥ QA 脚本两次测试侧问题（单进程多 context 连接关闭、断言大小写笔误），应用代码未动；⑦ 抽屉实现：壳的 `.rm-detail` 在壳外，抽屉状态经 body 双属性门控（`body[data-sk-page="skills"][data-sk-drawer="open"]`，HEAD 实测 `modules.css:1339/1342`）+ 本页作用域 CSS，仅本页生效，不动其他模块 1180 下的堆叠规则；关闭时删属性，1180 下抽屉开合几何实测贴合。
- **收官意义**：本批之后，第二主题 9 大业务模块全部完成对等重构；用户 2026-10-25 00:36 复核通过（认可 32/32、7 项偏差全部批准、快照 32 片 / 总线 0 emit / 逃避文案 0 命中）后准予合入。

---

## 4. 流程方法论（C 类：用户立规 + 执行留痕）

1. **分平台拆爆款再动手**（2026-10-16 用户惯例，扩展为全平台）：做任何平台内容前先拆解该平台同赛道爆款——结构、封面 / 标题、钩子、节奏、视觉风格，形成该平台专属风格记忆再动手；不跨平台套用审美。本重建中对应：每个模块动手前先读第一主题对应 Body 的实现与常量，逐字搬运，不按自己想法拼。
2. **方案 / 样机先行，用户拍案后施工**（2026-10-22 用户立规）：给搭建 / 改版指令，先生成图片 / 样机让用户拍案，通过后再施工。本重建中对应：每批施工交接清单 + 定稿 HTML 先行，用户批复后才开工；清单自带“未过审，严禁施工方提前编码”状态，用户批复取代该状态后方可动手。
3. **外部方案独立审查**（2026-10-23 用户立规）：拿到的每个方案（尤其外部 AI 出的方案 / 工单），必须先用自己的判断过一遍——可行性、实现前提、数据来源是否真实存在、与既有口径和红线是否冲突、验收能否落地、风险在哪；发现疑问先提出来并给出修正建议，把工单打磨到尽量一次执行到位；不许把方案当圣旨无脑照搬。用户拍板的方向仍照单执行，但执行前的审查与质疑是职责。本重建留痕：BATCH3 审查修正 6 项、BATCH4 审查修正 6 项、平台词表之辨、快照 grep 口径修正，全部折入施工单。
4. **动前先定位**（2026-10-23 教训）：用户指的视觉元素须先在代码里定位唯一对应物再动手，施工前 grep 列全候选规则并确认唯一生效处，PR 附自证。反例：#85 改的 `.hud-cards::before` 是被降噪段同名规则覆盖的死规则、#86 撤的水位线硬边亦非所指，真身是降噪段 `.hud-cards::after`（top:26px）；#87 修复为 top 26px→4px。
5. **约束式修复**（2026-10-21）：用户挑出问题后，修复只动点名项，保住已认可的最强部分，不重构版块、不改文案；一轮只修一处最大差异 + 一次截图对比；评审 + 修复 2–3 轮封顶，超了停下复盘。禁止无约束的“fix it”。
6. **坏了先恢复**（2026-10-21）：经用户点头或验证过的状态立即 commit 打标；修复被否，第一动作 restore 到恢复点重开，不在坏版本上叠改；试新方向开分支。本重建留底：`backup-verified-20261021 = 44a0a8b`（见 §1.3）。
7. **视觉验收逐图目检**（2026-10-21 教训 + 2026-10-21 动效教训）：子代理断言全过 ≠ 验收过（PR #26–#30 自称 76 断言全过，用户验收 10 分钟内连挑 5 处：水母黑方块底、自定义模块旧静图未统一、模块地图展开区裸文字行、日历页待办票与事项混排、暖灰主题硬套深色底图）。交付前必须逐张目检截图，覆盖三主题 × 主要页面 × 双端（桌面 + 移动 390×844），警觉 iOS Safari 渲染差异（Chromium 抓不到的兼容问题靠前缀补齐 + 代码审查兜底）。动效类交付必须用 Playwright `reducedMotion: 'reduce'` 再验一遍（用户机器系统动画关闭会触发站点自身的 `prefers-reduced-motion` 全冻规则）；个人站点的 HUD 动效是设计本体，禁止给主视觉加 blanket reduced-motion 冻结规则。
8. **PR 未经用户审查绝不合入**（全程铁律）：每批 PR 均保持 OPEN 等用户复核批复后才合并；合并提交信息载明用户批复要点。本重建 5 批合并时间均晚于用户批复时间（见 §1.1）。
9. **交付标准**（2026-10-24 交付纪律）：说“验过”必须同条消息带证据（截图 / 量测 / 真实操作）；验收走用户真实动作路径（真鼠标、用户视口、真实账号状态）；合成 `el.click()`、HTTP 200、子代理断言全过都是假绿；修正版附件换新文件名；汇报剩余工作对全清单核对；SKIP 不许算进 PASS 报数。

## 5. 提示词与派工方法

### 5.1 派工三段式（每份派工单固定结构）

1. **要改的（编号）**：模块、文件、行数目标、字段表、键、事件，逐项编号。
2. **不许动的（逐项，含未点名文件）**：第一主题文件、快照、总线、既有口径注释、已验部分，未点名文件默认不许动。
3. **作用域文件**：只列允许改动的文件清单；交付回报实际改动文件清单对账，超出即返工。

### 5.2 派工单骨架（本重建各批实际使用的结构，C 类方法总结）

- 基线锁定（`origin/main` 某提交，不用本地分支头）→ 施工依据（交接清单 + 定稿 HTML，图纸仅参照、不进提交）→ 改动面收敛（文件清单 + 行数目标）→ 逐块施工要点（字段、校验、键、事件、口径，逐字复刻项标明第一主题行号）→ Luna 审查修正（覆盖方案原文）→ 全站红线（零触碰 / 零新键 / 零新事件 / 断点死锁 / 逃避文案零命中）→ 验收与交付（生产构建、QA 脚本、截图规格、PR OPEN 不合并、回报格式：分支头号 + PR 状态 + diff 清单 + QA 精确口径 + 偏差清单）。

### 5.3 开工对版（以 origin 为准）

- 开工先拉远端最新、通读相关 diff 再动手；对版与恢复一律以 `origin` 为准（本地 main ref 会过期，已踩坑）。
- worktree 占用纪律：`main` 分支被另一 worktree 占用检出时，`git checkout main` 会失败；不许强行切换或动他人 worktree 状态；树等价验证用 `git diff <分支头> origin/main --stat` 为空证明。
- 规格文件即真相：既定设计逐步量化成仓库内的 token / 构图规格文件；口头与聊天描述不作数，施工与恢复都按规格核对。

### 5.4 派工与复核分工

- 执行方：按派工单施工、写 QA 脚本、跑断言、截图自检、开 PR（OPEN）。
- 复核方（Luna）：独立复核 PR 状态 / 头号、diff 红线、截图逐张目检、QA 数字精确口径，再交付用户；执行方报告摘要化时（如 BATCH3 完工回报只剩一句话），复核方不得凭摘要交货，必须自己重验全部证据。

## 6. 工具链

### 6.1 基础栈（A 类仓库实测）

- Next.js（App Router + Tailwind）+ Vercel（项目 `kb`，生产域名 `https://kb-zeta-one.vercel.app`）；公开仓库 `t1804496337-droid/kb`。
- 登录凭证只从环境变量 `SITE_AUTH_USER` / `SITE_AUTH_PASS` 读，绝不写进代码 / 文档 / 提交；缺失则 fail closed（仓库 `AGENTS.md` 明文规则）。
- 改动走分支 + PR，不直接推 main（health-sync 机器提交除外）；`gh` 以 `t1804496337-droid` 登录，push 前 `gh auth setup-git`。
- Vercel 部署探针以 GitHub 提交的 Vercel 状态（`gh api commits/<sha>/status` 或 `gh pr checks`）为准；`/login` 页 CSS chunk 指纹是错探针。

### 6.2 Playwright 本地验收配方（C 类执行留痕）

- 无头 Chromium：`playwright-core` + `--no-sandbox --disable-dev-shm-usage --disable-gpu --no-zygote --single-process`（2026-10-23 晚实证：此前 SIGTRAP 真因为容器沙箱 / shm）；脚本必须放 `~/workspace/login-qa/` 下跑（模块解析）；单进程实例一轮一页。
- 本地服务：worktree 里 `npm run build` 后以 `SITE_AUTH_USER` / `SITE_AUTH_PASS` 环境变量注入 QA 账号起 `next start`（先 `ss` 查端口、按 PID kill，禁用 `pkill -f` 防误杀自身 shell；起服务用 background exec 保活）。各批端口：回归 3100、BATCH3 3101、BATCH4 3102，互不冲突。
- 登录是 `/studio` 的表单，不是 basic auth。QA 先经 `/studio` 登录会触发第一主题播种示例账目，财务计数一律用增量。
- 字体缓存坑：`next/font/google` 在 build 时现下 `fonts.gstatic.com`；该域名在云机间歇不可达时，全新 build 会以 Turbopack font 404 失败。`rm -rf .next` 会连字体缓存一起清掉——救法：从任一兄弟 worktree 移植整个 `.next` + `node_modules` 再增量 build，复用其中字体产物即可过。
- 动效验收：Playwright `reducedMotion: 'reduce'` 再验一遍（见 §4.7）。
- 减动效与触屏：hover-only 补触屏等价或明示桌面限定；QA 断言用真鼠标点击，不用合成 `el.click()` 冒充。

### 6.3 EPERM 写文件铁律（C 类执行留痕，2026-10-21 / 10-22 实证）

- 现象：exec 派生的写操作间歇 EPERM（`git hash-object -w` / commit、ffmpeg 输出、python 写文件），`touch` / `mkdir` / `mv` / `ln` 仍可用，`muse.write` 工具通道仍可用。
- 铁律：写前先 `cp` 备份再写；宁可写到 `/tmp` 新文件再 `mv`，不许对唯一副本做原地 `open(..., "w")`（2026-10-22 实证：先截断后写在 EPERM 块期间毁过唯一副本文件，后重建验证 32/32 等价）。
- 应急范式：git 提交走 GitHub Git Data API 拼 commit（blobs → tree → commit → PATCH ref），范式脚本 `~/workspace/login-qa/api-commit.py`、`~/workspace/login-qa/jelly-commit.py`（A 类：文件存在）；本地 worktree 随后与推送 ref 内容一致、HEAD 落后，写恢复后重同步。

### 6.4 浏览器任务纪律（C 类）

- 巡查 / 浏览器任务运行中途，一律不打断、不查状态、不轮询：发 status 查询 / 新指令会顶替原任务导致其提前结束。耐心等结果自动投递；只在结果确认失败（>15 分钟未投递）时才按规则处置。

## 7. 用户立下的铁律原文清单（C 类：用户原话或已核实转述，标日期与情境）

| 日期 | 情境 | 原话 / 转述 |
|---|---|---|
| 2026-10-17 | 研究 / 学习任务 | “不要把问题又抛给我”——被要求研究 / 学习时，学完直接动手、成片发审，不把半成品的判断题抛回给用户 |
| 2026-10-21 18:46 | 现有站保存 | “现有站保存好，有问题改回去”——留底分支 `backup-verified-20261021 = 44a0a8b` |
| 2026-10-21 19:15 | 外部参考代码使用 | “只用加我们没有达到要求的，不要改原来的”——外部参考代码只许补本站缺失项，严禁替换 / 改动已验的现有部分 |
| 2026-10-22 | 搭建 / 改版指令 | 先生成图片 / 样机让用户拍案，通过后再施工（由“换素材先审图”扩展为全部设计施工的默认流程） |
| 2026-10-22 | 备选方案 | “你先问我选哪个在执行”——给出备选方案（哪怕标注了“推荐”）时，不许替用户选完直接执行，必须先让他点选 |
| 2026-10-23 | 外部 AI 方案 / 工单 | 方案审查新规：先独立验算再执行（见 §4.3） |
| 2026-10-23 | 贯穿线视觉误诊 | 动前先定位到文件 / 行段写进派工单，定位不到不许动手（见 §4.4） |
| 2026-10-24 16:16 | 订阅空态文案 | 逃避文案定性为暗度陈仓，PR 一度绝不准合并（见 §3.1） |
| 2026-10-24 全程 | 合并纪律 | PR 未经用户审查通过绝不合入 main（见 §4.8） |
| 2026-10-22 | 瓶身实物纠正 | 瓶身约 9cm 上细下粗、普通手掌包不住——不许单手抓握做推举 / 弯举（训练清单名称按用户裁定逐字保留，与此铁律的张力用户已知情，见 §3.3） |
| 2026-10-22 | 数据驱动视觉 | 只吃真实数据、绝不编造分数——睡眠色温按真实睡眠时长 + 入睡时间加权派生，无数据时不染色、保持原色 |
| 2026-10-24 11:50 | 购物跑腿 | 购物平台这类跑腿（登录 / 验证码 / 身份验证 / 下单代操作）以后不再用 Luna（与本站重建无关，列入以防后人误接） |

## 8. 未完事项（明确写在收官档里，不许假装全部完成）

1. **Issue #80 仍 OPEN（A 类 gh 核实）**：“补偿归档：PR #79 合并后补跑 qa-crud-p12 与 qa-persistence 存证”（创建于 2026-10-23），未正式补跑。
2. **第一主题 P0 板的用户生产确认（A 类 PR 已合并 + C 类待确认）**：PR #95 已合并（`31e320d`，2026-10-23）；未完的是用户本人在生产站的确认，不是合并本身。
3. **后端存储 / 跨设备同步方案（C 类队列）**：细节专场后再定；一次性任务 `studio-backend-sync-proposal-20261021` 已停用（cron.status 核实 Disabled）；本体知识库细节顺延。
4. **生产站实机最终验收（C 类用户令，2026-10-24 16:41）**：生产站实机最终验收由用户亲自过，细微样式 / 交互瑕疵再沟通；本归档的 QA 均为本地 QA 环境断言，不替代用户实机验收。
5. **作品同步数据未交付（A 类 HEAD 实测）**：`public/works-sync.json` 不存在，作品同步卡现为空态；待作品同步数据投递后，同步卡才有真实内容。
6. **健康数据断档（A 类 `docs/health-sync.md` 载明）**：最近一次完整睡眠记录停在 2026-10-17 周六晚；晨间简报盯断档并提醒（HealthKit 自 2026-10-22 起未同步，判睡眠缺失必须直查 sessions 原始记录）。

## 9. 仓库外资产清单（仅索引，不复制进仓库）

| 资产 | 路径 | 用途 |
|---|---|---|
| BATCH2 施工交接清单 + 定稿 | `~/workspace/kb-batch3/交付包_56ba75f/`（7 文件）及 `~/workspace/user/files/56ba75f.tar.gz`（27,760 字节） | 第二批图纸 |
| BATCH3 施工交接清单 + 定稿 | 同上包内 | 第三批图纸 |
| BATCH4 施工交接清单 + 技能库方案 | `~/workspace/kb-batch4/交付包_b9bafe2/`（9 文件）及 `~/workspace/user/files/b9bafe2.tar.gz`（34,503 字节，SHA256 `5461fd57…7e59c41`） | 第四批图纸 |
| BATCH2 QA 脚本 | `~/workspace/login-qa/batch2-qa.js` | 第二批断言（TOTAL 46 结构） |
| BATCH3 QA 脚本 | `~/workspace/login-qa/batch3-qa.js`（另 `batch3-errprobe.js`、`batch3-t1probe.js`） | 第三批断言（TOTAL 43 结构） |
| BATCH4 QA 脚本 | `~/workspace/login-qa/batch4-qa.js` | 第四批断言（TOTAL 32 结构） |
| 财务 QA 脚本 | `~/workspace/login-qa/fin-v2-qa.js`、`~/workspace/login-qa/fin-smoke.js` | 财务 v2 断言（36 / 6 结构） |
| 动效 QA 脚本 | `~/workspace/login-qa/check-motion.js`、`~/workspace/login-qa/check-reduced.js` | reduced-motion 模拟验收 |
| 应急提交脚本 | `~/workspace/login-qa/api-commit.py`、`~/workspace/login-qa/jelly-commit.py` | GitHub Git Data API 拼 commit（EPERM 应急） |
| BATCH2 截图 | `~/workspace/login-qa/batch2-shots/`（8 张：cal / insp / health ×1728/1180 + ring-1728/1920） | 第二批目检证据 |
| BATCH3 截图 | `~/workspace/login-qa/batch3-shots/`（8 张：db / onto / studio / works ×1728/1180） | 第三批目检证据 |
| BATCH4 截图 | `~/workspace/login-qa/batch4-shots/`（8 张：skills A/B/C/详情/搜索 ×1728 + 1180/抽屉开/抽屉关） | 第四批目检证据 |
| 工作区 | `~/workspace/kb-batch3/`（BATCH3 分支 worktree）、`~/workspace/kb-batch4/`（BATCH4 分支 worktree）、`~/workspace/kb-skills-loop/`、`~/workspace/kb-cal-test/`（main 占用检出） | 各批施工 worktree；`main` 被 `kb-cal-test` 占用检出，勿动 |
| 既有仓库文档 | `docs/studio-handoff-prompt.md`、`docs/studio-给其他AI交接.md`、`docs/health-sync.md`、`docs/skills-sync-api.md`、`docs/finance-subscriptions-briefing.md` | 交接与数据格式（本归档不改动） |

---

*本文档为收官归档，不含任何凭证。登录凭证只从环境变量读（见 §6.1）。后续改动另开分支与 PR，本文档基线 `3e0ae00` 保持只读参照。*
