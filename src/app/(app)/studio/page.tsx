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
  Wallet,
  HeartPulse,
  Network,
  GripVertical,
} from "lucide-react";
import { NeuralOrb } from "@/components/studio/neural-orb";
import { NeuralLanding, type LandingNode } from "@/components/studio/neural-landing";
import { NeuralWorkspace, NeuralWorkspaceMobile, type WsHub } from "@/components/studio/neural-workspace";
import { WorksSyncSection } from "@/components/studio/works-sync";
import {
  FinanceModuleView,
  type FinanceEntry,
  type FinanceLiability,
  type FinanceAsset,
} from "@/components/studio/finance-module";
import { HealthModuleView } from "@/components/studio/health-module";
import { OntologyModuleView } from "@/components/studio/ontology-module";
import { moduleJellyBeam } from "@/components/studio/module-jelly";
import { FluidPillGroup } from "@/components/ui/fluid-pill";
import { InlineConfirmButton } from "@/components/ui/inline-confirm";
import { RollNumber } from "@/components/ui/roll-number";
import { useSpringStagger } from "@/components/ui/spring-stagger";
import { XUANZI_PROMPTS } from "@/lib/xuanzi-prompts";
import { cn } from "@/lib/utils";

type ThemeId = "silver" | "warm" | "neu";
type HubKey = "top" | "left" | "ll" | "right" | "lr";
/** A module the user added from the UI (create-task modal). Persisted locally. */
type CustomModule = { id: string; label: string; en: string };
type CustomRow = { id: string; title: string; a: string; b: string; c?: string };
const CUSTOM_MODULES_KEY = "studio_custom_modules_v1";
const CUSTOM_ROWS_KEY = "studio_custom_rows_v1";
const SEEDED_MODULES_KEY = "studio_seeded_modules_v1";
/** Default modules seeded once per browser profile. They behave exactly like
 *  user-created modules (rows, delete) — the seed marker below just stops a
 *  deleted one from being re-seeded on the next load. */
const SEED_MODULES: CustomModule[] = [
  { id: "health", label: "身体健康", en: "HEALTH" },
  { id: "finance", label: "财务系统管理", en: "FINANCE" },
];
const SEEDED_MODULES_V2_KEY = "studio_seeded_modules_v2";
/** Later seed batches get their own marker key: profiles that already ran
 *  an earlier batch still receive the new defaults exactly once, and a
 *  module from any batch that the user deleted never comes back. */
const SEED_MODULES_V2: CustomModule[] = [
  { id: "ontology", label: "本体知识库", en: "ONTOLOGY" },
];
const SEED_BATCHES: { modules: CustomModule[]; marker: string }[] = [
  { modules: SEED_MODULES, marker: SEEDED_MODULES_KEY },
  { modules: SEED_MODULES_V2, marker: SEEDED_MODULES_V2_KEY },
];
/** Finance module （财务系统管理） storage: entries / liabilities / assets /
 *  monthly budget, all local — every number in the module is derived from
 *  these, nothing is hard-coded. */
const FIN_ENTRIES_KEY = "studio_finance_entries_v1";
const FIN_LIABILITIES_KEY = "studio_finance_liabilities_v1";
const FIN_ASSETS_KEY = "studio_finance_assets_v1";
const FIN_BUDGET_KEY = "studio_finance_budget_v1";
const FIN_SEEDED_KEY = "studio_finance_seeded_v1";
/** Health module （身体健康） check-ins: "YYYY-MM-DD" array, local only.
 *  The module's site-wide count is the total number of check-in days. */
const HEALTH_CHECKINS_KEY = "studio_health_checkins_v1";
/** First-run seed for finance entries: Tang's real ledger rows
 *  (~/workspace/goals/ai-2/hidden_files/ledger/ledger.csv, both 2026-10-17).
 *  Written only when the entries key is absent AND the seed marker is unset,
 *  so entries the user deleted never come back. Marked source:"ledger" and
 *  shown with a 「台账导入」 badge. */
const FINANCE_SEED_ENTRIES: FinanceEntry[] = [
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
/** Landing hubs are data-driven: every custom module gets a native jelly
 *  node on the landing (health/finance pinned to the upper corners), the
 *  rest fill the remaining layout slots; overflow falls back to the card
 *  row under the orb. Which jelly + beam a module gets comes from the
 *  shared assignment in components/studio/module-jelly (the workspace map
 *  uses the same helpers, so a module looks identical in both places). */
const MAX_CUSTOM_LANDING_NODES = 6;
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
  kind: "workflow" | "skill" | "pending" | "slot" | "custom";
};

const PILL_NAV: { id: SectionId; label: string; en: string }[] = [
  { id: "workspace", label: "工作台", en: "WORKSPACE" },
  { id: "works", label: "作品库", en: "WORKS" },
  { id: "drafts", label: "技能库", en: "SKILLS" },
  { id: "ideas", label: "灵感池", en: "WORKFLOW" },
  { id: "calendar", label: "日历表", en: "CALENDAR" },
  { id: "database", label: "数据库", en: "DATABASE" },
];

/** One installed skill row (synced per-agent via /skills-sync.json). */
type SkillEntry = {
  id: string;
  name: string;
  zh: string;
  tag: string;
  source: string;
  /** Short intro, pushed by the owning agent (optional). */
  desc?: string;
  /** Full detail text, pushed by the owning agent (optional). */
  detail?: string;
};

/** Skills grouped by owning agent; each agent maintains only its own block. */
type SkillAgentGroup = { id: string; name: string; skills: SkillEntry[] };

/** grokbot's installed skills (agent-data/workflows). */
const SKILLS: SkillEntry[] = [
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
];
/** The eight aigc-course entries that used to follow (s-01…s-08:
 *  学课/搭账号/养号/写大纲/出分镜/剪视频/发布/数据回炉) were the old 8-step
 *  pipeline wearing skill clothes — removed together with the steps;
 *  grokbot keeps its eight workflow skills above. Mirrored in
 *  public/skills-sync.json. */

/** Luna's installed skills (~/workspace/custom-skills). */
const LUNA_SKILLS: SkillEntry[] = [
  {
    id: "l-find",
    name: "Find Skills",
    zh: "技能发现与安装",
    tag: "发现",
    source: "custom-skills/find_skills",
    desc: "当内置能力覆盖不了需求时，从开放技能生态里找现成技能：先评估是否适配本环境，再按规范安装并验证，帮 Luna 持续扩展能力边界。",
    detail: "# Find Skills\n\nHelp the user discover and install new agent skills when the built-in capabilities don't cover what they need.\n\n## When to use\n\nUse this skill when the user:\n- Asks \"how do I do X\" where X might be a common task with an existing skill\n- Says \"find a skill for X\" or \"is there a skill for X\"\n- Asks \"can you do X\" where X is a specialized capability\n- Expresses interest in extending your capabilities\n\n## How to find skills\n\n1. Understand what they need: the domain and the specific task.\n2. Search the open agent-skills ecosystem:\n   - Browse https://skills.sh/ or run `npx skills find <query>` in the terminal\n   - Search GitHub for `SKILL.md` files on the topic\n   - Check curated lists (e.g. awesome-claude-skills style repos)\n3. Evaluate candidates before installing: read the SKILL.md, check what tools it assumes, and judge whether it fits this environment (terminal shell, live browser, files, subagents). Prefer plain instruction files over ones requiring unavailable CLIs or services. Installation counts are a weak signal — fit matters more.\n\n## How to install a skill here\n\nCustom skills live in `~/workspace/custom-skills/<skill_name>/` with two files:\n\n- `SKILL.md`: the instructions alone, with no YAML frontmatter. Strip the frontmatter from the downloaded file and adapt tool references to this environment (e.g. replace harness-specific paths and commands with the equivalents here).\n- `skill.yaml`: metadata. Copy the template from `/opt/muse/skills/custom-connector-setup/templates/skill/skill.yaml` and fill in:\n  - `name`: snake_case, matching the folder name (system skill names are reserved)\n  - `title`: plain task name\n  - `description`: one sentence naming the outcome and when to use it\n  - `category`: an existing category such as \"Work and knowledge\"\n  - `include_in_prompt`: true to list it in every conversation, false to leave it to skill search\n\nAdapt before saving: convert tool-specific references to this environment's equivalents and drop anything that can't work here. Never write secrets, keys, or tokens into a skill. After saving, verify with `muse.skill_search`.\n\nTell the user what you installed, what you adapted or dropped and why, and what the skill now covers.\n",
  },
  {
    id: "l-grill",
    name: "Grill Me",
    zh: "拷问对齐",
    tag: "规划",
    source: "custom-skills/grill_me",
    desc: "把模糊的想法当成一棵设计树来拷问：一轮轮只问前提已经落定的问题，每题都附上推荐答案，直到所有分支都达成共识、没有默默假设，才开始动手。",
    detail: "# Grill Me\n\nInterview the user relentlessly until you reach a shared understanding of their idea, plan, or decision. Use when the user's request is vague or high-level and needs sharpening before you act — or when the user explicitly asks to be grilled.\n\nMap the idea as a **design tree**: every decision branches into the decisions that hang off it.\n\nWork the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before the next round.\n\nConduct the interview in the user's language.\n\nFormat a round like so:\n\n```\n❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>\n\n➡️ <your recommended answer>\n\n---\n\n❓ **Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>\n\n➡️ <your recommended answer>\n```\n\nWord each question so \"yes\" accepts your recommended answer.\n\nEach round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.\n\nFinding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (files, tools, web), look it up yourself or dispatch a subagent; don't ask the user for anything you could find yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait; ask the rest of the frontier now. The _decisions_ are the user's: put each to them and wait.\n\nThe session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on the plan until the user confirms you have reached a shared understanding.\n\nThis skill is stateless: it writes no files and leaves no workspace behind. The only result is a clearer version of the idea, in the user's head.\n\n<!-- Adapted from mattpocock/skills (MIT): skills/productivity/grilling -->\n",
  },
  {
    id: "l-grill-docs",
    name: "Grill With Docs",
    zh: "拷问对齐 · 带记录",
    tag: "规划",
    source: "custom-skills/grill_with_docs",
    desc: "Grill Me 的带记录版：拷问计划的同时，把术语定义和关键决策实时写进一份会话文档，还会拿你的说法和已有文档交叉核对、指出矛盾；也能用来审查现成计划的漏洞。",
    detail: "# Grill With Docs\n\nA relentless interview to sharpen a plan or design (following the Grill Me method), which also creates written records — key terms and decisions — as the session goes. Use when the user wants to stress-test their thinking _and_ keep a record of what was decided, or when asked to review an existing plan.\n\n## Interview\n\nFollow the Grill Me method: map the idea as a design tree, work the frontier in rounds, number each question with a recommended answer, and wait for the user's answers. Conduct the interview in the user's language. Do not act until the user confirms a shared understanding.\n\n## Create docs as you go\n\nAs terms and decisions crystallize during the interview, write them down immediately instead of batching them up:\n\n- **Terms**: when the user uses a vague or overloaded term, propose a precise canonical term and record the agreed definition. If the user later contradicts a recorded term, call it out: \"Earlier we defined X as ..., but you seem to mean Y now. Which is it?\"\n- **Decisions**: when a hard-to-reverse decision is made — one a future reader would wonder about, resulting from a real trade-off between alternatives — record it with the alternatives considered and the reason for the choice.\n- **Cross-check**: when the user states how something works, check it against any existing docs, files, or prior conversation. If you find a contradiction, surface it: \"Your notes say X, but you just said Y. Which is right?\"\n\nKeep a single session note (a markdown file under `~/workspace/` or the relevant goal folder) with two sections: Terms and Decisions. Create it lazily — only when there is something worth writing.\n\n## Review an existing plan\n\nWhen asked to review a plan or proposal rather than build one from scratch: read the plan and any supporting docs first, then grill the weak points — unstated assumptions, logical gaps, contradictions with the docs, and decisions missing their rationale. Report findings as questions where possible, so the user resolves them instead of just receiving criticism.\n\n<!-- Adapted from mattpocock/skills (MIT): skills/engineering/grill-with-docs (= grilling + domain-modeling) -->\n",
  },
  {
    id: "l-xhs-img",
    name: "XHS Infographic",
    zh: "小红书信息图",
    tag: "图文",
    source: "custom-skills/xhs-infographic",
    desc: "小红书浅色信息图的制作规范：AI 写实底图 + 固定版式模板叠字 + 单一亮蓝强调，中文全部在排版层叠加，不让生图模型写中文；含双模板、制作流程和踩坑清单。",
    detail: "# 小红书浅色信息图 Skill\n\n> 沉淀自 2026-10-18 实战：从深色科技风 → v5 浅色信息图 → v6 图层架构\n> 参考：柒柒的AI体验局《AI收入暴涨12倍》、用户自写拆解文档\n\n---\n\n## 一句话\n\n**AI 写实底图 + 固定版式模板叠字 + 单蓝强调**，中文全部排版层叠加，不让生图模型写中文。\n\n---\n\n## 视觉规范（铁律）\n\n| 项目 | 规范 |\n|------|------|\n| 强调色 | 只用 `#1F5BFF` 亮蓝，全图唯一强调色，不加红/橙/粉 |\n| 背景 | `#FFFFFF` 纯白 |\n| 正文 | `#111111` 近黑 |\n| 次要文字 | `#6B7280` 灰 |\n| 浅蓝底 | `#E8F0FF`（事实条、浅底标注） |\n| 顶栏 | 左：黑色胶囊 `AI LIFESTYLE`；右：`AI × TECH × LIFE` + 三色点（蓝/浅蓝/灰） |\n| 标题 | 超粗黑体，2行；关键词换亮蓝 + 手绘下划线（下划线不划问号） |\n| 旁注 | 右上蓝色短句，如\"越赚钱，越缺钱？\" |\n| 底栏 | 蓝底白字结论条，圆角 |\n| 画幅 | 1080×1440（3:4竖版） |\n\n---\n\n## 双模板\n\n### 模板A：人物场景卡\n- 全幅写实人物/办公场景底图（AI 生成，无字）\n- 右侧竖排 2-3 个白色圆角信息气泡（不挡人物面部）\n- 适用：观点类、数据解读类\n\n### 模板B：三栏卡\n- 横向三等分，每栏：编号圆（蓝底白字01/02/03）+ 配图 + 标题 + ✓要点 + 底部浅蓝事实条\n- 适用：对比类、清单类、多方观点类\n\n---\n\n## 制作流程\n\n1. **定模板**：A（人物卡）或 B（三栏卡）\n2. **出底图**：AI 生成写实摄影底图，prompt 必须含 `no text, no words, no letters, no watermark`；人物图上下各留 1/4 弱内容区\n3. **叠字**：用 `make_cards_v6.py` 的 Canvas 图层架构\n   ```python\n   from make_cards_v6 import Canvas, LayerTopBar, LayerNote, LayerHeadline, LayerPhoto, LayerBubbles, LayerBottomBar\n   c = Canvas()\n   c.add(LayerTopBar())\n   c.add(LayerNote(\"旁注文案\"))\n   c.add(LayerHeadline([\"标题行1\", \"标题行2\"], blue_words=[\"蓝词\"]))\n   c.add(LayerPhoto(\"底图路径\"))\n   c.add(LayerBubbles([\"气泡1\", \"气泡2\", \"气泡3\"], side=\"right\"))\n   c.add(LayerBottomBar(\"底栏结论\"))\n   c.render(\"output.png\")\n   ```\n4. **微调**：只改对应层，如 `c.get('headline').lines = [\"新标题\"]`，不用重跑整张\n5. **检查**：顶栏五张一致、蓝号一致、中文清晰、无 emoji 方框、气泡不挡脸\n\n---\n\n## 踩过的坑\n\n| 坑 | 解决办法 |\n|----|----------|\n| 深色科技风用户不喜欢 | 切浅色白底，学爆款原图 |\n| 每张套同一版式被批\"死板\" | 按内容选模板A/B，不硬套 |\n| 加红橙粉被批\"抢戏\" | 全图只认一个亮蓝 |\n| emoji 显示成方框 □ | 不用 emoji，用纯文字 |\n| 气泡挡住人物面部 | 气泡放右侧竖排，避开脸部区域 |\n| 标题下划线划到问号 | 下划线只到蓝词结束，不含标点 |\n| 配图与内容脱节（如美女配财经） | 底图必须贴合主题：讲烧钱就配机房/办公室 |\n| 信息密度低 | 每张至少 3-5 个数据点，字号保证手机可读 |\n\n---\n\n## 下次替换的内容\n\n- `LayerHeadline.lines`：标题文案\n- `LayerHeadline.blue_words`：蓝关键词\n- `LayerNote.text`：旁注\n- `LayerPhoto.photo_path`：底图路径\n- `LayerBubbles.items`：气泡文案列表\n- `LayerBottomBar.text`：底栏结论\n- 模板A/B 选择\n\n## 不变的内容\n\n- 顶栏样式、配色规范、字体、画幅尺寸\n- 图层架构代码\n- \"中文排版叠加，不让 AI 写中文\"原则\n",
  },
  {
    id: "l-xhs-note",
    name: "xhs-note-writer",
    zh: "小红书笔记文案",
    tag: "文案",
    source: "custom-skills/xhs_note_writer",
    desc: "为「野生搞钱薯」账号写小红书笔记草稿：标题用代码点计数硬卡 20 字、普通人实测口吻、禁营销腔与收益承诺，只学爆款结构不抄文案，默认只交草稿不发布。",
    detail: "# xhs-note-writer\n\nWrite a Xiaohongshu note as a draft. Enforce the 20-character title with the formatter. Adapted from guobinmengxiang-rgb/skills (MIT) for the \"野生搞钱薯\" AI 副业搞钱 account: plain writer discipline, no marketing-speak, no AI voice.\n\nThis is a tight **writer** skill. It does not publish. In this environment, publishing happens only through the approved 小红书 posting flow (user-approved copy → scheduled post task → live browser). Never drive a browser to xiaohongshu.com from this skill.\n\n## Language / 语言\n\nDefault 中文. Keep the note in the account's voice: 普通人实测分享口吻, dry, specific, 真诚. Not marketing-speak, not 专家腔.\n\n## Title\n\n- Count with Unicode code points: `Array.from(title).length`.\n- **Max 20.** Over 20 is a hard fail, not a warning.\n- Offer **at least two** title options. Every option must be ≤20. Show the count next to each.\n- Prefer the 爆款公式: 数字 + 人群 + 结果/悬念. Concrete hook over slogan.\n\n## Body\n\nOne arc, in this order:\n\n1. **Pain** — the mistake or confusion in one or two lines.\n2. **One method or one step** — the thing to do. Not a lecture series.\n3. **Gotcha / payoff** — the check that tells you it worked, or the trap if you skip it.\n\nFor 数字清单体 (the account's preferred format): N 条金句/方法, one line each plus a one-line comment; each image card carries 1–2 items; the cover card holds the 3 most striking ones as the hook.\n\nForbidden voice:\n\n- 家人们\n- 宝子\n- 赋能 / 闭环\n- stacked 感叹号 (`!!`, `！！`, or a trail of `!`)\n- generic AI cadence (\"in this post we'll explore\")\n- 收益承诺 (\"保证赚钱\", \"月入十万\", specific income numbers)\n\nCompliance: no fabricated case data, no exaggerated claims; AI-generated images must be labeled as such in the note.\n\nDo not copy sentences from a 爆款. If given a viral URL, **learn structure only** (hook type, approximate length, tag pattern) and rewrite in the account's voice.\n\n## Tags\n\n- 5–10 tags for this account (broader than the original 3–5: discoverability matters for a new account).\n- Add `#` if missing.\n- Specific over empty trends. Mix: 赛道词 (#AI副业 #搞钱) + 内容词 (#AI工具 #提示词) + 1–2 trending.\n\n## Formatter (required)\n\nFrom this skill directory:\n\n```bash\nnode scripts/format.mjs --title \"你的标题\" --body \"正文段落一。正文段落二。\" --tags \"AI副业,搞钱,AI工具\"\n```\n\n- Import path: `formatNote` from `scripts/format.mjs` (also used by `scripts/demo.mjs`).\n- Title over 20 → the script throws `title too long`.\n- No default course link in this adaptation; pass `--link` only when the note genuinely needs one (e.g. 返佣商品卡片备注, never a raw URL in body).\n\nAlways run the script on the chosen title + body + tags before handing the draft over. If it fails, shorten the title and run again.\n\nSanity check:\n\n```bash\nnode scripts/demo.mjs\n```\n\n## Publish policy\n\n**Default: stop at draft.** Return the formatted text. Publishing goes through the account's own approved flow (user reviews exact copy → scheduled task posts via live browser). This skill never posts.\n\n## Output\n\n1. Two or more titles with code-point counts.\n2. The formatted draft (script output).\n3. Tags used.\n4. A one-line reminder: 默认不发布，停在草稿 / draft only.\n\n## Anti-patterns\n\n- Titles counted as UTF-16 units or \"Chinese characters only\"\n- Shipping one title\n- Pasting viral copy with the nouns swapped\n- Publishing because the draft looks good\n",
  },
];

/**
 * Built-in fallback for the skills library — mirrors public/skills-sync.json.
 * Used until the fetch lands (and whenever the file is missing/unreachable).
 */
const SKILL_AGENTS_FALLBACK: SkillAgentGroup[] = [
  { id: "grokbot", name: "grokbot", skills: SKILLS },
  { id: "luna", name: "Luna", skills: LUNA_SKILLS },
];
const ALL_SKILLS_FALLBACK: SkillEntry[] = SKILL_AGENTS_FALLBACK.flatMap(
  (a) => a.skills,
);
const SKILL_TOTAL_FALLBACK = ALL_SKILLS_FALLBACK.length;

/**
 * Workflow steps (灵感池) — user-managed state, grouped by executor zone.
 * The built-in 8-step AIGC list (学课/搭账号/养号/写大纲/出分镜/剪视频/发布/
 * 数据回炉 + 派给角色) was cleared on 2026-10-20 at the user's request;
 * it survives in git history (pre-PR #11) if it is ever needed again.
 * Steps live in React state + localStorage `studio_workflow_steps_v2`,
 * start empty, and every "步数" count in the app derives from that state.
 */
type FlowZone = "me" | "ai" | "agent";
type FlowStep = { id: string; title: string; zone: FlowZone; note?: string };
const FLOW_ZONES: { id: FlowZone; label: string; en: string }[] = [
  { id: "me", label: "我", en: "ME" },
  { id: "ai", label: "AI", en: "AI" },
  { id: "agent", label: "Agent", en: "AGENT" },
];
const FLOW_STEPS_KEY = "studio_workflow_steps_v2";

/**
 * Calendar items （日历事项）: user-managed entries pinned to a date.
 * React state + localStorage `studio_calendar_items_v1`, starts empty.
 * The grid still shows one fixed month (CAL_YEAR/CAL_MONTH, no paging yet);
 * the old static CAL_MARKS placeholders no longer feed anything — day
 * markers, the item list and every calendar count derive from this state.
 * Count口径: wherever a calendar "n" is shown (landing node, module map,
 * WS_HUBS default) it is the number of ITEMS (calItems.length), not the
 * number of marked days; the "N 条待办" sub stays tickets-only.
 */
type CalItem = { id: string; date: string; title: string; note?: string };
const CAL_ITEMS_KEY = "studio_calendar_items_v1";
const CAL_YEAR = 2026;
const CAL_MONTH = 10;
/** Monday-first leading blanks for the fixed month (same formula as the
 *  health check-in month grid, so both calendar grids align alike). */
const CAL_FIRST_DOW =
  (new Date(CAL_YEAR, CAL_MONTH - 1, 1).getDay() + 6) % 7;
const calDateStr = (day: number): string =>
  `${CAL_YEAR}-${String(CAL_MONTH).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const todayStr = (): string => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};
/** Ids of the cleared built-in steps — stripped from persisted hub rows. */
const LEGACY_STEP_IDS = new Set([
  "w1", "w2", "w3", "w4", "w5", "w6", "w7", "w8",
]);
/** One-time purge marker: legacy 8-step rows scrubbed from persisted hubs. */
const PURGED_LEGACY_STEPS_KEY = "studio_purged_legacy_steps_v1";
/**
 * Why a purge is needed: PR #11 deleted the built-in steps from code and its
 * sync effect cleaned React state, but the pre-#11 app had already saved the
 * default hub rows into `studio_hub_rows_v1` ("top" rows id `w1`–`w8`,
 * database rows `db-w1`–`db-w8`, static calendar placeholders `cal-d<day>`).
 * The stored copy was never rewritten, and the sync effect treated unknown
 * rows as hand-added "extra", so the dead steps kept resurfacing in the
 * workspace fan and in every row count. Identification is conservative:
 *  1. exact legacy ids (`w1`–`w8`, `db-w1`–`db-w8`);
 *  2. the old static calendar placeholder ids (`cal-d<day>`);
 *  3. an exact step title ("N 学课" / "学课" / "学课 · 飞书通 · 01-学课")
 *     TOGETHER with a pipeline marker (a = 流水线 or `步骤 n/8`, the step's
 *     legacy role in b, or a "· 0n-" fan suffix in the title).
 * Hand-added rows can never match: the create flow stamps them with
 * `row-local-*` ids (checked first) and user flow steps use `flow-*`.
 */
const LEGACY_STEP_TITLES = [
  "学课", "搭账号", "养号", "写大纲", "出分镜", "剪视频", "发布", "数据回炉",
];
const LEGACY_STEP_ROLES = [
  "飞书通", "Muse", "运营助手 / WorkBuddy", "待改派",
  "分镜工 / 豆包", "WorkBuddy + 本人导出", "Muse + 本人点发",
];
type HubRowLike = { id: string; title: string; a: string; b: string };
function isLegacyStepRow(r: HubRowLike): boolean {
  if (!r || typeof r.id !== "string") return false;
  if (r.id.startsWith("row-local-") || r.id.startsWith("flow-")) return false;
  if (LEGACY_STEP_IDS.has(r.id)) return true;
  if (/^db-w[1-8]$/.test(r.id)) return true;
  if (/^cal-d\d{1,2}$/.test(r.id)) return true;
  const title = typeof r.title === "string" ? r.title : "";
  const bare = title.replace(/^[1-8]\s+/, "");
  const titleHit = LEGACY_STEP_TITLES.some(
    (t) => bare === t || bare.startsWith(`${t} · `),
  );
  if (!titleHit) return false;
  return (
    r.a === "流水线" ||
    /^步骤 [1-8]\/8$/.test(r.a ?? "") ||
    LEGACY_STEP_ROLES.includes(r.b ?? "") ||
    /· 0[1-8]-/.test(title)
  );
}
function purgeLegacyRows(
  saved: Record<string, HubRowLike[]>,
): { cleaned: Record<string, HubRowLike[]>; changed: boolean } {
  let changed = false;
  const cleaned: Record<string, HubRowLike[]> = {};
  for (const [k, rows] of Object.entries(saved)) {
    const list = Array.isArray(rows) ? rows : [];
    const kept = list.filter((r) => !isLegacyStepRow(r));
    if (kept.length !== list.length) changed = true;
    cleaned[k] = kept;
  }
  return { cleaned, changed };
}
const flowZoneLabel = (z: FlowZone): string =>
  FLOW_ZONES.find((x) => x.id === z)?.label ?? z;

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

const THEMES: { id: ThemeId; label: string; en: string; short: string }[] = [
  { id: "silver", label: "银黑", en: "SILVER BLACK", short: "Dark" },
  { id: "warm", label: "暖灰", en: "WARM GRAY", short: "Warm" },
  { id: "neu", label: "新拟物", en: "NEUMORPH", short: "Soft" },
];

const CAL_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

type ModalKind = null | "edit" | "manage" | "create" | "step" | "newmodule" | "caladd";

const WS_HUBS: WsHub[] = [
  {
    key: "top", section: "ideas", n: 0, label: "灵感池", en: "Workflow", sub: "0 步拉新流水线",
    rows: [],
  },
  {
    key: "ll", section: "drafts", n: SKILL_TOTAL_FALLBACK, label: "技能库", en: "Skills", sub: "已装 Skill",
    rows: ALL_SKILLS_FALLBACK.map((k) => ({ id: k.id, title: `${k.zh} · ${k.name}`, a: k.tag, b: "已装" })),
  },
  {
    key: "left", section: "works", n: WORK_SLOTS.length, label: "作品库", en: "Works", sub: "ep01 待发布",
    rows: [
      ...WORK_SLOTS.map((w) => ({ id: w.id, title: w.title, a: w.subtitle, b: w.date, c: w.status })),
      ...PENDING_TICKETS.map((t) => ({ id: t.id, title: t.title, a: t.detail, b: t.owner, c: "待办" })),
    ],
  },
  {
    key: "right", section: "database", n: SKILL_TOTAL_FALLBACK, label: "数据库", en: "Database", sub: "Skill + 流程",
    rows: [
      ...ALL_SKILLS_FALLBACK.map((k) => ({ id: `db-${k.id}`, title: `${k.zh} · ${k.name}`, a: "Skill", b: k.source })),
    ],
  },
  {
    key: "lr", section: "calendar", n: 0, label: "日历表", en: "Calendar", sub: `${PENDING_TICKETS.length} 条待办`,
    rows: [
      ...PENDING_TICKETS.map((t) => ({ id: `cal-${t.id}`, title: t.title, a: t.owner, b: "本周", c: "待办" })),
    ],
  },
];

/** Stepped-flow header (Taku's stepwise menu, polish batch 1): the beats
 *  of a create flow — pick → write → confirm — stay visible the whole way,
 *  so the state is continuous and the result is clear before committing. */
function StepDots({
  steps,
  current,
  testid,
}: {
  steps: string[];
  current: number;
  testid: string;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5" data-testid={testid} aria-label="步骤">
      {steps.map((s, i) => {
        const n = i + 1;
        const on = current === n;
        const done = current > n;
        return (
          <li key={s} className="flex items-center gap-1.5">
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                on
                  ? "studio-pill-active"
                  : done
                    ? "bg-[color:var(--studio-accent)] text-black"
                    : "bg-white/10 text-[color:var(--studio-muted)]",
              )}
            >
              {done ? "✓" : n}
            </span>
            <span
              className={cn(
                "text-[11px]",
                on ? "font-semibold" : "text-[color:var(--studio-muted)]",
              )}
            >
              {s}
            </span>
            {n < steps.length && (
              <span className="mx-0.5 h-px w-3 bg-white/15" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function StudioPage() {
  const [theme, setTheme] = React.useState<ThemeId>("silver");
  const [section, setSection] = React.useState<SectionId>("workspace");
  const [selectedBoardId, setSelectedBoardId] = React.useState<string | null>(
    BOARD_ITEMS[0]?.id ?? null,
  );
  const [metricFocus, setMetricFocus] = React.useState<number | null>(null);
  const [tileFocus, setTileFocus] = React.useState<string | null>(null);
  const [modal, setModal] = React.useState<ModalKind>(null);
  // Polish batch 1: stepped create/caladd flows (1 pick → 2 write → 3 confirm),
  // bottom-sheet drag offset on phones, in-modal arm state for the step delete.
  const [createStep, setCreateStep] = React.useState(1);
  const [calStep, setCalStep] = React.useState(1);
  const [stepDeleteArm, setStepDeleteArm] = React.useState(false);
  const [sheetDrag, setSheetDrag] = React.useState(0);
  const [sheetShaking, setSheetShaking] = React.useState(false);
  const sheetDragRef = React.useRef<{ startY: number; dragging: boolean }>({
    startY: 0,
    dragging: false,
  });
  const sheetHintRef = React.useRef<string | null>(null);
  // Toast: a passive message, or a message carrying one action
  // （撤销 for the flow drag-sort). One timer owns dismissal so rapid
  // successive toasts never cut each other short.
  type ToastState = {
    msg: string;
    actionLabel?: string;
    onAction?: () => void;
  };
  const [toast, setToast] = React.useState<ToastState | null>(null);
  const toastTimerRef = React.useRef<number | null>(null);
  const [promptsOpen, setPromptsOpen] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [newTitle, setNewTitle] = React.useState("");
  const [tickets, setTickets] = React.useState(PENDING_TICKETS);
  const [hubs, setHubs] = React.useState<WsHub[]>(() => WS_HUBS.map((h) => ({ ...h, rows: [...h.rows] })));
  // Create-task target: a built-in hub key, or a custom module id.
  const [activeHubKey, setActiveHubKey] = React.useState<string>("ll");
  const [customModules, setCustomModules] = React.useState<CustomModule[]>([]);
  const [customRows, setCustomRows] = React.useState<Record<string, CustomRow[]>>({});
  // Skills library: grouped by agent, synced from /skills-sync.json
  // (each agent maintains its own block; fallback = built-in mirror).
  const [skillAgents, setSkillAgents] =
    React.useState<SkillAgentGroup[]>(SKILL_AGENTS_FALLBACK);
  // Skills library drawers: per-agent open state (all closed by default),
  // persisted to localStorage `studio_skills_open_v1`. While a search is
  // active, groups with matches render open without touching this memory.
  const [skillsOpen, setSkillsOpen] = React.useState<Record<string, boolean>>(
    {},
  );
  const skillsOpenLoaded = React.useRef(false);
  // Skill whose detail panel is expanded inline (one at a time).
  const [openSkillId, setOpenSkillId] = React.useState<string | null>(null);
  // Save effect is declared before the load effect on purpose: on mount it
  // runs first, sees the not-loaded flag and skips, so it can never clobber
  // the stored value with the initial empty state.
  React.useEffect(() => {
    if (!skillsOpenLoaded.current) return;
    try {
      window.localStorage.setItem(
        "studio_skills_open_v1",
        JSON.stringify(skillsOpen),
      );
    } catch {
      /* storage unavailable */
    }
  }, [skillsOpen]);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem("studio_skills_open_v1");
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const next: Record<string, boolean> = {};
          for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === "boolean") next[k] = v;
          }
          setSkillsOpen(next);
        }
      }
    } catch {
      /* storage unavailable */
    }
    skillsOpenLoaded.current = true;
  }, []);
  // Database zones: per-zone open state with its own memory
  // (`studio_db_open_v1`, independent of the skills library drawers).
  // Zones default to OPEN — the database is a lookup table and used to
  // render fully expanded; remembering an explicit close is enough.
  const [dbOpen, setDbOpen] = React.useState<Record<string, boolean>>({});
  const dbOpenLoaded = React.useRef(false);
  // Same save-before-load ordering as the skills drawers above.
  React.useEffect(() => {
    if (!dbOpenLoaded.current) return;
    try {
      window.localStorage.setItem("studio_db_open_v1", JSON.stringify(dbOpen));
    } catch {
      /* storage unavailable */
    }
  }, [dbOpen]);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem("studio_db_open_v1");
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const next: Record<string, boolean> = {};
          for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === "boolean") next[k] = v;
          }
          setDbOpen(next);
        }
      }
    } catch {
      /* storage unavailable */
    }
    dbOpenLoaded.current = true;
  }, []);
  // Workflow steps (灵感池): user-managed, zoned by executor, persisted
  // locally. Starts empty — the built-in 8 steps were cleared by request.
  const [flowSteps, setFlowSteps] = React.useState<FlowStep[]>([]);
  const [flowDraft, setFlowDraft] = React.useState<{
    zone: FlowZone;
    title: string;
  } | null>(null);
  const [activeCustom, setActiveCustom] = React.useState<string | null>(null);
  const [newModuleLabel, setNewModuleLabel] = React.useState("");
  const [newModuleEn, setNewModuleEn] = React.useState("");
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [editMode, setEditMode] = React.useState(false);
  // Workspace header chrome: collapsed by default on the module map
  // (only a slim handle shows); hovering the top zone or tapping the
  // handle expands it, leaving / tapping the main area collapses it.
  const [chromeOpen, setChromeOpen] = React.useState(false);
  const chromeHandleTs = React.useRef(0);
  const [landing, setLanding] = React.useState<"on" | "leaving" | "off">("on");
  const [minimized, setMinimized] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [fsFallback, setFsFallback] = React.useState(false);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  // Spring-stagger entrances (batch 2): skills rows + flow step rows
  // play once when their list first appears.
  const skillsSpringRef = useSpringStagger<HTMLDivElement>();
  const flowSpringRef = useSpringStagger<HTMLDivElement>();
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
  // Workspace header copy (brand suffix / headline / EN line): editable in
  // edit mode, persisted like the window title. A stored user value always
  // wins; the defaults below only apply when nothing was ever saved.
  const HEAD_COPY_KEY = "studio_head_copy_v1";
  const HEAD_COPY_DEFAULT = {
    brand: "个人第二大脑",
    headline: "九大模块，一个第二大脑。",
    en: "Nine modules, one second brain.",
  };
  const [headCopy, setHeadCopy] = React.useState(HEAD_COPY_DEFAULT);
  const commitHeadCopy = (patch: Partial<typeof HEAD_COPY_DEFAULT>) => {
    const next = { ...headCopy, ...patch };
    setHeadCopy(next);
    try {
      window.localStorage.setItem(HEAD_COPY_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem("studio_hub_rows_v1");
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, WsHub["rows"]>;
        // One-time purge (marker: studio_purged_legacy_steps_v1): scrub the
        // persisted legacy 8-step rows out of every hub and write the cleaned
        // copy back, so they cannot ride in again as "extra" rows. The
        // parse-time filter runs on every load as a belt-and-braces.
        const { cleaned, changed } = purgeLegacyRows(saved);
        if (changed) {
          window.localStorage.setItem(
            "studio_hub_rows_v1",
            JSON.stringify(cleaned),
          );
        }
        if (!window.localStorage.getItem(PURGED_LEGACY_STEPS_KEY)) {
          window.localStorage.setItem(PURGED_LEGACY_STEPS_KEY, "1");
        }
        setHubs((prev) =>
          prev.map((h) => (cleaned[h.key] ? { ...h, rows: cleaned[h.key], n: cleaned[h.key].length } : h)),
        );
      } else if (!window.localStorage.getItem(PURGED_LEGACY_STEPS_KEY)) {
        window.localStorage.setItem(PURGED_LEGACY_STEPS_KEY, "1");
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
      let modules: CustomModule[] = [];
      const rawM = window.localStorage.getItem(CUSTOM_MODULES_KEY);
      if (rawM) modules = JSON.parse(rawM) as CustomModule[];
      // One-time seed of the default modules, batch by batch. Each batch is
      // guarded by its own marker key so a seed the user deleted never
      // comes back, while profiles that predate a batch still receive its
      // modules once; modules already present (matched by id) are left
      // untouched.
      for (const batch of SEED_BATCHES) {
        if (window.localStorage.getItem(batch.marker)) continue;
        const missing = batch.modules.filter(
          (s) => !modules.some((m) => m.id === s.id),
        );
        if (missing.length > 0) {
          modules = [...modules, ...missing];
          window.localStorage.setItem(
            CUSTOM_MODULES_KEY,
            JSON.stringify(modules),
          );
        }
        window.localStorage.setItem(batch.marker, "1");
      }
      setCustomModules(modules);
      const rawR = window.localStorage.getItem(CUSTOM_ROWS_KEY);
      if (rawR) setCustomRows(JSON.parse(rawR) as Record<string, CustomRow[]>);
    } catch {
      /* ignore */
    }
  }, []);
  const persistCustomModules = React.useCallback((next: CustomModule[]) => {
    try {
      window.localStorage.setItem(CUSTOM_MODULES_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);
  const persistCustomRows = React.useCallback((next: Record<string, CustomRow[]>) => {
    try {
      window.localStorage.setItem(CUSTOM_ROWS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FLOW_STEPS_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as FlowStep[];
        if (Array.isArray(arr)) {
          setFlowSteps(
            arr.filter(
              (s) =>
                s &&
                typeof s.id === "string" &&
                typeof s.title === "string" &&
                (s.zone === "me" || s.zone === "ai" || s.zone === "agent"),
            ),
          );
        }
      }
    } catch {
      /* ignore */
    }
  }, []);
  const persistFlowSteps = React.useCallback((next: FlowStep[]) => {
    try {
      window.localStorage.setItem(FLOW_STEPS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);
  const addFlowStep = React.useCallback(
    (title: string, zone: FlowZone) => {
      const step: FlowStep = { id: `flow-${Date.now()}`, title, zone };
      setFlowSteps((prev) => {
        const next = [...prev, step];
        persistFlowSteps(next);
        return next;
      });
      return step;
    },
    [persistFlowSteps],
  );
  const deleteFlowStep = React.useCallback(
    (id: string) => {
      setFlowSteps((prev) => {
        const next = prev.filter((s) => s.id !== id);
        persistFlowSteps(next);
        return next;
      });
    },
    [persistFlowSteps],
  );
  const flowCount = flowSteps.length;
  // ─── Flow drag-sort (polish batch 2, Taku 拖放收纳） ───
  // Reordering happens inside a step's own zone only; the flat array
  // keeps its shape — the zone's slice is permuted in place and the
  // whole list is persisted exactly like add/delete. Every committed
  // reorder snapshots the previous order and offers it back through an
  // undo toast. The drag itself is pointer-driven from the grip
  // (mouse and touch alike); the keyboard path is ↑/↓ on the grip.
  type FlowDrag = {
    id: string;
    zone: FlowZone;
    from: number;
    over: number;
    dy: number;
    h: number;
    count: number;
  };
  const [flowDrag, setFlowDrag] = React.useState<FlowDrag | null>(null);
  const flowDragRef = React.useRef<(FlowDrag & { startY: number }) | null>(
    null,
  );
  const commitFlowReorder = (zone: FlowZone, from: number, to: number) => {
    if (from === to) return;
    const snapshot = flowSteps;
    setFlowSteps((prev) => {
      const slots = prev
        .map((s, i) => (s.zone === zone ? i : -1))
        .filter((i) => i >= 0);
      const zoneSteps = slots.map((i) => prev[i]);
      const [moved] = zoneSteps.splice(from, 1);
      zoneSteps.splice(to, 0, moved);
      const next = [...prev];
      slots.forEach((slot, k) => {
        next[slot] = zoneSteps[k];
      });
      persistFlowSteps(next);
      return next;
    });
    showActionToast("步骤顺序已调整", "撤销", () => {
      setFlowSteps(snapshot);
      persistFlowSteps(snapshot);
      showToast("已恢复原顺序");
    });
  };
  const startFlowDrag = (
    e: React.PointerEvent,
    step: FlowStep,
    indexInZone: number,
  ) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const row = (e.currentTarget as HTMLElement).closest<HTMLElement>(
      "[data-flow-row]",
    );
    if (!row) return;
    e.preventDefault();
    const zoneSteps = flowSteps.filter((s) => s.zone === step.zone);
    const state = {
      id: step.id,
      zone: step.zone,
      from: indexInZone,
      over: indexInZone,
      dy: 0,
      h: row.offsetHeight + 8,
      count: zoneSteps.length,
      startY: e.clientY,
    };
    flowDragRef.current = state;
    setFlowDrag(state);
    const onMove = (ev: PointerEvent) => {
      const s = flowDragRef.current;
      if (!s) return;
      const dy = ev.clientY - s.startY;
      const over = Math.max(
        0,
        Math.min(s.count - 1, s.from + Math.round(dy / s.h)),
      );
      const next = { ...s, dy, over };
      flowDragRef.current = next;
      setFlowDrag(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const s = flowDragRef.current;
      flowDragRef.current = null;
      setFlowDrag(null);
      if (s && s.over !== s.from) commitFlowReorder(s.zone, s.from, s.over);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const flowGripKeyDown = (
    e: React.KeyboardEvent,
    step: FlowStep,
    indexInZone: number,
  ) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const count = flowSteps.filter((s) => s.zone === step.zone).length;
    const to = indexInZone + (e.key === "ArrowUp" ? -1 : 1);
    if (to < 0 || to >= count) return;
    commitFlowReorder(step.zone, indexInZone, to);
  };
  // Calendar items （日历事项）: state + localStorage, starts empty.
  const [calItems, setCalItems] = React.useState<CalItem[]>([]);
  const [calDraft, setCalDraft] = React.useState<{
    date: string;
    title: string;
    note: string;
  } | null>(null);
  const [calFocusDate, setCalFocusDate] = React.useState<string | null>(null);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CAL_ITEMS_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as CalItem[];
        if (Array.isArray(arr)) {
          setCalItems(
            arr.filter(
              (i) =>
                i &&
                typeof i.id === "string" &&
                typeof i.date === "string" &&
                /^\d{4}-\d{2}-\d{2}$/.test(i.date) &&
                typeof i.title === "string",
            ),
          );
        }
      }
    } catch {
      /* ignore */
    }
  }, []);
  const persistCalItems = React.useCallback((next: CalItem[]) => {
    try {
      window.localStorage.setItem(CAL_ITEMS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);
  const addCalItem = React.useCallback(
    (date: string, title: string, note?: string) => {
      const item: CalItem = {
        id: `calitem-${Date.now()}`,
        date,
        title,
        ...(note ? { note } : {}),
      };
      setCalItems((prev) => {
        const next = [...prev, item];
        persistCalItems(next);
        return next;
      });
      return item;
    },
    [persistCalItems],
  );
  const deleteCalItem = React.useCallback(
    (id: string) => {
      setCalItems((prev) => {
        const next = prev.filter((i) => i.id !== id);
        persistCalItems(next);
        return next;
      });
    },
    [persistCalItems],
  );
  const openCalAdd = React.useCallback((date: string) => {
    setCalDraft({ date, title: "", note: "" });
    setCalFocusDate(date);
    setCalStep(1);
    setModal("caladd");
  }, []);
  const sortedCalItems = React.useMemo(
    () =>
      [...calItems].sort((a, b) =>
        a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1,
      ),
    [calItems],
  );
  const calItemCount = calItems.length;
  // Finance module （财务系统管理）: entries / liabilities / assets / budget,
  // all localStorage-backed. Every figure in the module view is derived
  // from these arrays — see components/studio/finance-module.tsx.
  const [finEntries, setFinEntries] = React.useState<FinanceEntry[]>([]);
  const [finLiabilities, setFinLiabilities] = React.useState<FinanceLiability[]>([]);
  const [finAssets, setFinAssets] = React.useState<FinanceAsset[]>([]);
  const [finBudget, setFinBudget] = React.useState<number | null>(null);
  React.useEffect(() => {
    try {
      // Entries: seed once from Tang's real ledger (see FINANCE_SEED_ENTRIES).
      const rawE = window.localStorage.getItem(FIN_ENTRIES_KEY);
      let entries: FinanceEntry[] = [];
      if (rawE) {
        const arr = JSON.parse(rawE) as FinanceEntry[];
        if (Array.isArray(arr)) {
          entries = arr.filter(
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
          entries = [...FINANCE_SEED_ENTRIES];
          window.localStorage.setItem(FIN_ENTRIES_KEY, JSON.stringify(entries));
        }
        window.localStorage.setItem(FIN_SEEDED_KEY, "1");
      }
      setFinEntries(entries);
      const rawL = window.localStorage.getItem(FIN_LIABILITIES_KEY);
      if (rawL) {
        const arr = JSON.parse(rawL) as FinanceLiability[];
        if (Array.isArray(arr)) {
          setFinLiabilities(
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
          setFinAssets(
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
        if (Number.isFinite(n) && n > 0) setFinBudget(n);
      }
    } catch {
      /* ignore */
    }
  }, []);
  const persistFinEntries = React.useCallback((next: FinanceEntry[]) => {
    try {
      window.localStorage.setItem(FIN_ENTRIES_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);
  const persistFinLiabilities = React.useCallback(
    (next: FinanceLiability[]) => {
      try {
        window.localStorage.setItem(FIN_LIABILITIES_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [],
  );
  const persistFinAssets = React.useCallback((next: FinanceAsset[]) => {
    try {
      window.localStorage.setItem(FIN_ASSETS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);
  const addFinEntry = React.useCallback(
    (data: Omit<FinanceEntry, "id">) => {
      const entry: FinanceEntry = { ...data, id: `fin-${Date.now()}` };
      setFinEntries((prev) => {
        const next = [...prev, entry];
        persistFinEntries(next);
        return next;
      });
      return entry;
    },
    [persistFinEntries],
  );
  const updateFinEntry = React.useCallback(
    (id: string, data: Omit<FinanceEntry, "id" | "source">) => {
      setFinEntries((prev) => {
        const next = prev.map((e) => (e.id === id ? { ...e, ...data } : e));
        persistFinEntries(next);
        return next;
      });
    },
    [persistFinEntries],
  );
  const deleteFinEntry = React.useCallback(
    (id: string) => {
      setFinEntries((prev) => {
        const next = prev.filter((e) => e.id !== id);
        persistFinEntries(next);
        return next;
      });
    },
    [persistFinEntries],
  );
  const addFinLiability = React.useCallback(
    (data: Omit<FinanceLiability, "id">) => {
      const item: FinanceLiability = { ...data, id: `finl-${Date.now()}` };
      setFinLiabilities((prev) => {
        const next = [...prev, item];
        persistFinLiabilities(next);
        return next;
      });
      return item;
    },
    [persistFinLiabilities],
  );
  const updateFinLiability = React.useCallback(
    (id: string, data: Omit<FinanceLiability, "id">) => {
      setFinLiabilities((prev) => {
        const next = prev.map((l) => (l.id === id ? { ...l, ...data } : l));
        persistFinLiabilities(next);
        return next;
      });
    },
    [persistFinLiabilities],
  );
  const deleteFinLiability = React.useCallback(
    (id: string) => {
      setFinLiabilities((prev) => {
        const next = prev.filter((l) => l.id !== id);
        persistFinLiabilities(next);
        return next;
      });
    },
    [persistFinLiabilities],
  );
  const addFinAsset = React.useCallback(
    (data: Omit<FinanceAsset, "id">) => {
      const item: FinanceAsset = { ...data, id: `fina-${Date.now()}` };
      setFinAssets((prev) => {
        const next = [...prev, item];
        persistFinAssets(next);
        return next;
      });
      return item;
    },
    [persistFinAssets],
  );
  const updateFinAsset = React.useCallback(
    (id: string, data: Omit<FinanceAsset, "id">) => {
      setFinAssets((prev) => {
        const next = prev.map((a) => (a.id === id ? { ...a, ...data } : a));
        persistFinAssets(next);
        return next;
      });
    },
    [persistFinAssets],
  );
  const deleteFinAsset = React.useCallback(
    (id: string) => {
      setFinAssets((prev) => {
        const next = prev.filter((a) => a.id !== id);
        persistFinAssets(next);
        return next;
      });
    },
    [persistFinAssets],
  );
  const setFinBudgetPersisted = React.useCallback((n: number | null) => {
    setFinBudget(n);
    try {
      if (n === null) window.localStorage.removeItem(FIN_BUDGET_KEY);
      else window.localStorage.setItem(FIN_BUDGET_KEY, String(n));
    } catch {
      /* ignore */
    }
  }, []);
  // Health module （身体健康）: daily check-ins, localStorage-backed.
  // Site-wide count for the module = total check-in days (see
  // customModuleCount) — same pattern as finance entries.
  const [healthCheckins, setHealthCheckins] = React.useState<string[]>([]);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HEALTH_CHECKINS_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as unknown;
        if (Array.isArray(arr)) {
          setHealthCheckins([
            ...new Set(
              arr.filter(
                (d): d is string =>
                  typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d),
              ),
            ),
          ]);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);
  const toggleHealthCheckin = React.useCallback((date: string) => {
    setHealthCheckins((prev) => {
      const next = prev.includes(date)
        ? prev.filter((d) => d !== date)
        : [...prev, date].sort();
      try {
        window.localStorage.setItem(HEALTH_CHECKINS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  const allSkills = React.useMemo(
    () => skillAgents.flatMap((a) => a.skills),
    [skillAgents],
  );
  const skillTotal = allSkills.length;
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/skills-sync.json", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { agents?: unknown };
        if (!Array.isArray(data?.agents)) return;
        const groups: SkillAgentGroup[] = [];
        for (const raw of data.agents) {
          const a = raw as { id?: unknown; name?: unknown; skills?: unknown };
          if (typeof a?.id !== "string" || !Array.isArray(a.skills)) continue;
          const skills: SkillEntry[] = [];
          a.skills.forEach((rs, i) => {
            const s = rs as Partial<SkillEntry>;
            if (typeof s?.name !== "string" || !s.name) return;
            skills.push({
              id: typeof s.id === "string" && s.id ? s.id : `${a.id}-${i}`,
              name: s.name,
              zh: typeof s.zh === "string" && s.zh ? s.zh : s.name,
              tag: typeof s.tag === "string" ? s.tag : "",
              source: typeof s.source === "string" ? s.source : "",
              desc:
                typeof s.desc === "string" && s.desc ? s.desc : undefined,
              detail:
                typeof s.detail === "string" && s.detail
                  ? s.detail
                  : undefined,
            });
          });
          groups.push({
            id: a.id,
            name: typeof a.name === "string" && a.name ? a.name : a.id,
            skills,
          });
        }
        if (!cancelled && groups.length) setSkillAgents(groups);
      } catch {
        /* keep built-in fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  // Keep the workspace skill/database/inspiration hub rows in step with
  // the library + workflow data (rows a user added by hand are preserved;
  // rows of the cleared built-in steps are stripped).
  React.useEffect(() => {
    const skillIds = new Set(allSkills.map((s) => s.id));
    const flowIds = new Set(flowSteps.map((s) => s.id));
    setHubs((prev) =>
      prev.map((h) => {
        if (h.key === "ll") {
          const extra = h.rows.filter(
            (r) => !skillIds.has(r.id) && !isLegacyStepRow(r),
          );
          const rows = [
            ...allSkills.map((k) => ({
              id: k.id,
              title: `${k.zh} · ${k.name}`,
              a: k.tag,
              b: "已装",
            })),
            ...extra,
          ];
          return { ...h, rows, n: rows.length };
        }
        if (h.key === "top") {
          const extra = h.rows.filter(
            (r) =>
              !flowIds.has(r.id) &&
              !LEGACY_STEP_IDS.has(r.id) &&
              !r.id.startsWith("flow-") &&
              !isLegacyStepRow(r),
          );
          const rows = [
            ...flowSteps.map((s, i) => ({
              id: s.id,
              title: s.title,
              a: `步骤 ${i + 1}/${flowSteps.length}`,
              b: `${flowZoneLabel(s.zone)}区`,
            })),
            ...extra,
          ];
          return {
            ...h,
            rows,
            n: rows.length,
            sub: `${flowSteps.length} 步拉新流水线`,
          };
        }
        if (h.key === "right") {
          const extra = h.rows.filter(
            (r) => !r.id.startsWith("db-") && !isLegacyStepRow(r),
          );
          const rows = [
            ...flowSteps.map((s) => ({
              id: `db-${s.id}`,
              title: s.title,
              a: "流水线",
              b: `${flowZoneLabel(s.zone)}区`,
            })),
            ...allSkills.map((k) => ({
              id: `db-${k.id}`,
              title: `${k.zh} · ${k.name}`,
              a: "Skill",
              b: k.source,
            })),
            ...extra,
          ];
          return { ...h, rows, n: rows.length };
        }
        if (h.key === "lr") {
          // Calendar hub mirrors the calendar items; the old static
          // `cal-d*` placeholder rows are stripped, ticket mirrors (`cal-*`)
          // and hand-added rows are preserved as-is.
          const extra = h.rows.filter(
            (r) =>
              !r.id.startsWith("cal-d") &&
              !r.id.startsWith("calitem-row-") &&
              !isLegacyStepRow(r),
          );
          const rows = [
            ...extra,
            ...sortedCalItems.map((i) => ({
              id: `calitem-row-${i.id}`,
              title: i.title,
              a: "日历事项",
              b: i.date,
            })),
          ];
          return { ...h, rows, n: rows.length };
        }
        return h;
      }),
    );
  }, [allSkills, flowSteps, sortedCalItems]);
  React.useEffect(() => {
    try {
      const t = window.localStorage.getItem(TITLE_KEY);
      if (t && t.trim()) setWinTitle(t.trim());
    } catch {
      /* ignore */
    }
  }, []);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HEAD_COPY_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<typeof HEAD_COPY_DEFAULT>;
        setHeadCopy({
          brand: saved.brand?.trim() || HEAD_COPY_DEFAULT.brand,
          headline: saved.headline?.trim() || HEAD_COPY_DEFAULT.headline,
          en: saved.en?.trim() || HEAD_COPY_DEFAULT.en,
        });
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      showToast("登录成功 · 进入神经主体");
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
    showToast("已退出登录");
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
  const activeCustomModule =
    customModules.find((m) => m.id === activeCustom) ?? null;
  const inWsMap = section === "workspace" && !activeCustomModule;
  const chromeCollapsed =
    inWsMap && landing === "off" && !chromeOpen && !editMode;
  const navItems: { id: string; label: string; en: string; custom?: boolean }[] = [
    ...PILL_NAV.map((p) => ({ id: p.id as string, label: p.label, en: p.en })),
    ...customModules.map((m) => ({ id: m.id, label: m.label, en: m.en, custom: true })),
  ];
  const openNavItem = (item: { id: string; label: string; custom?: boolean }) => {
    if (item.custom) {
      setActiveCustom(item.id);
      showToast(`打开 · ${item.label}`);
      return;
    }
    setActiveCustom(null);
    setSection(item.id as SectionId);
  };
  // Landing reads live state (not the module-level constants):
  // stats — Skills/Steps/Slots from their data sources, Tickets from state;
  // node counts — each node's hub rows in state; calendar sub shows live tickets.
  const landingStats = [
    { key: "skills", value: skillTotal, label: "已装 Skill", en: "Skills" },
    { key: "steps", value: flowCount, label: "流水线步", en: "Steps" },
    { key: "tickets", value: tickets.length, label: "待办票", en: "Tickets" },
    { key: "slots", value: WORK_SLOTS.length, label: "成片槽", en: "Slots" },
  ];
  // Works-section metric cards — same sources as the landing stats.
  const metrics = [
    { value: skillTotal, label: "已装 Skill", en: "Skills" },
    { value: flowCount, label: "流水线步", en: "Steps" },
    { value: PENDING_TICKETS.length, label: "待办票", en: "Tickets" },
    { value: WORK_SLOTS.length, label: "成片槽", en: "Slots" },
  ];
  const builtinLandingNodes: LandingNode[] = LANDING_NODES.map((node) => {
    const hk = SECTION_TO_HUB[node.section];
    const hub = hk ? hubs.find((h) => h.key === hk) : undefined;
    const live = hub ? hub.rows.length : node.n;
    if (node.section === "calendar")
      // 口径：n = 日历事项总数 (calItems.length); sub 的待办数仍只走 tickets。
      return { ...node, n: calItemCount, sub: `${tickets.length} 条待办` };
    if (node.section === "ideas")
      return { ...node, n: live, sub: `${flowCount} 步拉新流水线` };
    return { ...node, n: live };
  });
  // Site-wide count for a custom module. 口径： finance counts its ledger
  // entries (finEntries), health counts its total check-in days
  // (healthCheckins) — their rows live in their own stores, not in
  // customRows — every other module counts its custom rows. All surfaces
  // (landing node / card row, module map, manage panel, create targets)
  // go through this one helper so the numbers can never disagree.
  const customModuleCount = (m: CustomModule): number =>
    m.id === "finance"
      ? finEntries.length
      : m.id === "health"
        ? healthCheckins.length
        : (customRows[m.id] ?? []).length;
  // Custom modules as native landing nodes: health/finance first (pinned to
  // slots 0/1), the rest in creation order filling the remaining slots.
  const orderedCustomModules = [
    ...customModules.filter((m) => m.id === "health"),
    ...customModules.filter((m) => m.id === "finance"),
    ...customModules.filter((m) => m.id !== "health" && m.id !== "finance"),
  ];
  const nodeModules = orderedCustomModules.slice(0, MAX_CUSTOM_LANDING_NODES);
  const nodeModuleIds = new Set(nodeModules.map((m) => m.id));
  const freeSlots = [0, 1, 2, 3, 4, 5].filter(
    (s) =>
      !(s === 0 && nodeModuleIds.has("health")) &&
      !(s === 1 && nodeModuleIds.has("finance")),
  );
  let freeSlotIdx = 0;
  const customLandingNodes: LandingNode[] = nodeModules.map((m) => {
    const slot =
      m.id === "health" ? 0 : m.id === "finance" ? 1 : freeSlots[freeSlotIdx++];
    return {
      key: `custom:${m.id}`,
      section: "workspace",
      customId: m.id,
      slot,
      n: customModuleCount(m),
      label: m.label,
      en: m.en,
      sub: "自定义模块",
      beam: moduleJellyBeam(m.id),
    };
  });
  const landingNodes: LandingNode[] = [
    ...builtinLandingNodes,
    ...customLandingNodes,
  ];
  // The bottom card row only carries modules that did not get a node.
  const landingCustomCards = customModules
    .filter((m) => !nodeModuleIds.has(m.id))
    .map((m) => ({
      id: m.id,
      label: m.label,
      en: m.en,
      count: customModuleCount(m),
      beam: moduleJellyBeam(m.id),
    }));
  // Workspace module map: one pseudo-hub per custom module, standing in the
  // same hub column as the five built-ins and fanning its own rows.
  const wsHubs = React.useMemo<WsHub[]>(
    () => [
      ...hubs,
      ...customModules.map((m) => ({
        key: `custom:${m.id}`,
        section: m.id,
        n: customModuleCount(m),
        label: m.label,
        en: m.en,
        sub: "自定义模块",
        rows: customRows[m.id] ?? [],
        customId: m.id,
        beam: moduleJellyBeam(m.id),
      })),
    ],
    // finEntries / healthCheckins feed customModuleCount for their hubs' n.
    [hubs, customModules, customRows, finEntries, healthCheckins],
  );
  const openCustomFromLanding = (id: string) => {
    const mod = customModules.find((m) => m.id === id);
    if (!mod) return;
    enterFromLanding("workspace");
    setActiveCustom(id);
    showToast(`打开 · ${mod.label}`);
  };
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

  // Board items = workflow steps from state + the static ticket/skill base
  // + every custom module's rows (so the module map fans them to their hub).
  const boardItems = React.useMemo<BoardItem[]>(
    () => [
      ...flowSteps.map((s, i) => ({
        id: s.id,
        title: s.title,
        subtitle: `灵感池 · ${flowZoneLabel(s.zone)}区`,
        meta: `步骤 ${i + 1}/${flowSteps.length}`,
        hub: "ideas" as SectionId,
        status: "自建",
        kind: "workflow" as const,
      })),
      ...customModules.flatMap((m) =>
        (customRows[m.id] ?? []).map((r) => ({
          id: r.id,
          title: r.title,
          subtitle: m.label,
          meta: r.a,
          hub: m.id as SectionId,
          status: r.c ?? "自建",
          kind: "custom" as const,
        })),
      ),
      ...BOARD_ITEMS,
    ],
    [flowSteps, customModules, customRows],
  );

  const selected =
    (selectedBoardId && boardItems.find((b) => b.id === selectedBoardId)) ||
    boardItems[0] ||
    null;

  const armToastTimer = (ms: number) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), ms);
  };
  const showToast = (msg: string) => {
    setToast({ msg });
    armToastTimer(2200);
  };
  /** Toast with one action button (Taku 拖放收纳： every re-arrangement
   *  offers its undo). Lives longer than a passive toast. */
  const showActionToast = (
    msg: string,
    actionLabel: string,
    onAction: () => void,
  ) => {
    setToast({ msg, actionLabel, onAction });
    armToastTimer(6000);
  };
  const openStepDetail = (id: string) => {
    const step = flowSteps.find((s) => s.id === id);
    if (!step) return;
    setSelectedBoardId(step.id);
    setSection("ideas");
    setStepDeleteArm(false);
    setModal("step");
    showToast(`步骤 · ${step.title}`);
  };

  // Sheet/modal housekeeping: every open starts with no drag offset, no
  // leftover shake, and the backdrop-hint may fire once per modal kind.
  React.useEffect(() => {
    setSheetDrag(0);
    setSheetShaking(false);
    sheetDragRef.current.dragging = false;
  }, [modal]);

  /** Form modals never close from the backdrop (Ludi: a stray tap on the
   *  scrim must not eat half-typed input). The scrim nudges the sheet and
   *  explains itself once; ✕ / 取消 remain the way out. Non-form modals
   *  keep the classic backdrop-dismiss. */
  const FORM_MODALS: ModalKind[] = ["create", "caladd", "newmodule", "edit"];
  const onBackdropClick = () => {
    if (modal && FORM_MODALS.includes(modal)) {
      setSheetShaking(true);
      window.setTimeout(() => setSheetShaking(false), 340);
      if (sheetHintRef.current !== modal) {
        sheetHintRef.current = modal;
        showToast("表单还没保存 · 点 ✕ 或「取消」关闭");
      }
      return;
    }
    setModal(null);
  };
  /** Drag-to-dismiss for the phone bottom sheet. On form modals a hard
   *  drag springs back instead of closing (same no-data-loss rule). */
  const onSheetPointerDown = (e: React.PointerEvent) => {
    sheetDragRef.current = { startY: e.clientY, dragging: true };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onSheetPointerMove = (e: React.PointerEvent) => {
    if (!sheetDragRef.current.dragging) return;
    setSheetDrag(Math.max(0, e.clientY - sheetDragRef.current.startY));
  };
  const onSheetPointerUp = () => {
    if (!sheetDragRef.current.dragging) return;
    sheetDragRef.current.dragging = false;
    if (sheetDrag > 110) {
      if (modal && FORM_MODALS.includes(modal)) {
        setSheetShaking(true);
        window.setTimeout(() => setSheetShaking(false), 340);
      } else {
        setModal(null);
      }
    }
    setSheetDrag(0);
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

  const filteredSkillAgents = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return skillAgents
      .map((agent) => ({
        ...agent,
        skills: q
          ? agent.skills.filter(
              (s) =>
                s.name.toLowerCase().includes(q) ||
                s.zh.toLowerCase().includes(q) ||
                s.tag.toLowerCase().includes(q),
            )
          : agent.skills,
      }))
      .filter((agent) => !q || agent.skills.length > 0);
  }, [skillAgents, query]);

  // Drawer open state: while searching, every rendered group (only groups
  // with matches survive the filter above) shows open — the remembered
  // state in `skillsOpen` is neither read nor written for this, so clearing
  // the search restores exactly the remembered drawers.
  const searchingSkills = query.trim().length > 0;
  const isAgentOpen = (agentId: string) =>
    searchingSkills ? true : (skillsOpen[agentId] ?? false);
  const toggleAgentOpen = (agentId: string) =>
    setSkillsOpen((prev) => ({ ...prev, [agentId]: !(prev[agentId] ?? false) }));

  // Database zone drawers: the database table is zoned by owning agent
  // (same grouping as the skills library) plus one zone for the workflow
  // steps it has always carried. Unset zones render open (see dbOpen).
  const isDbZoneOpen = (zoneId: string) => dbOpen[zoneId] ?? true;
  const toggleDbZone = (zoneId: string) =>
    setDbOpen((prev) => ({ ...prev, [zoneId]: !(prev[zoneId] ?? true) }));
  const flowZoneOpen = isDbZoneOpen("workflow");

  // 分析概览 Board 只属于工作台首页：分区页不再渲染该栏，内容区占满全宽。
  // （workspace 视图下 ws-legacy 由 plate 层覆盖显示，与改前一致。）
  const showBoard = section === "workspace" && !activeCustomModule;

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
      data-section={activeCustomModule ? "custom" : section}
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
          nodes={landingNodes}
          themeLabel={currentTheme.label}
          themeEn={currentTheme.en}
          onCycleTheme={() => {
            const i = THEMES.findIndex((t) => t.id === theme);
            setTheme(THEMES[(i + 1) % THEMES.length].id);
          }}
          onEnter={enterFromLanding}
          leaving={landing === "leaving"}
          quick={introQuick}
          stats={landingStats}
          customCards={landingCustomCards}
          onOpenCustom={openCustomFromLanding}
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
        data-section={activeCustomModule ? "custom" : section}
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
          <div
            className={cn("studio-chrome", chromeCollapsed && "studio-chrome-collapsed")}
            onMouseEnter={() => {
              if (inWsMap) setChromeOpen(true);
            }}
            onMouseLeave={() => {
              // Touch devices fire a synthetic mouseleave right after
              // a tap — treating it as "pointer left" would slam the
              // chrome shut the moment a tap opens it. On hover-less
              // devices the chrome closes via the handle / main-area
              // taps instead.
              if (window.matchMedia("(hover: none)").matches) return;
              if (inWsMap) setChromeOpen(false);
            }}
          >
            <div className="studio-chrome-body">
          <div className="studio-head mb-2 flex shrink-0 flex-row flex-wrap items-center gap-x-2 gap-y-2 lg:mb-3 lg:flex-nowrap lg:justify-between lg:gap-3">
            <div className="order-1 min-w-0 flex-1 basis-0 lg:flex-none lg:basis-auto lg:shrink-0">
              <p className="studio-brand whitespace-nowrap text-[13px] font-semibold tracking-[0.14em]">
                TANG / NEURAL
              </p>
              <p className="mt-0.5 truncate text-[10px] text-[color:var(--studio-muted)]">
                Skill · 工作流 · {flowCount} 步拉新流水线
              </p>
            </div>

            <FluidPillGroup
              as="nav"
              magnet
              className="studio-pill-nav order-3 flex w-full flex-wrap items-center justify-center gap-0.5 self-stretch rounded-full p-1 lg:order-2 lg:mx-2 lg:w-auto"
              aria-label="创作面板导航"
            >
              {navItems.map((item) => {
                const active = item.custom
                  ? activeCustomModule?.id === item.id
                  : section === item.id && !activeCustomModule;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-pill-active={active || undefined}
                    onClick={() => openNavItem(item)}
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
            </FluidPillGroup>

            <div className="order-2 ml-auto flex shrink-0 items-center justify-end gap-1.5 lg:order-3 lg:ml-0">
              <FluidPillGroup
                className="studio-theme-seg hidden items-center gap-0.5 rounded-full p-0.5 lg:flex"
                indicatorClassName="fluid-pill-ind-neutral"
                role="group"
                aria-label="主题"
              >
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    data-testid={`hdr-theme-${t.id}`}
                    data-pill-active={theme === t.id || undefined}
                    aria-pressed={theme === t.id}
                    className={cn("studio-theme-seg-btn", theme === t.id && "is-on")}
                    onClick={() => setTheme(t.id)}
                  >
                    {t.label} <small>{t.short}</small>
                  </button>
                ))}
              </FluidPillGroup>
              <button
                type="button"
                className="xuan-btn"
                data-testid="hdr-edit"
                aria-pressed={editMode || editingTitle}
                onClick={() => {
                  // One behaviour everywhere: 编辑 toggles the site's
                  // edit mode (the head copy rides the same mode). This
                  // used to special-case the workspace into window-title
                  // editing, which left the workspace with NO path into
                  // edit mode at all — the title keeps its own inline
                  // click-to-edit affordance in the window bar.
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
                  setCreateStep(1);
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
            </div>
            {inWsMap && landing === "off" && (
              <button
                type="button"
                className="studio-chrome-handle"
                data-testid="chrome-handle"
                aria-expanded={!chromeCollapsed}
                onPointerDown={() => {
                  // Toggle on pointerdown, not click: a touch tap ALSO
                  // fires a compatibility mouseenter (which opens the
                  // chrome) before its click — click-toggling would
                  // immediately undo the tap. The click handler below
                  // only serves keyboard activation (no pointerdown).
                  chromeHandleTs.current = Date.now();
                  setChromeOpen((v) => !v);
                }}
                onClick={() => {
                  if (Date.now() - chromeHandleTs.current > 500) {
                    setChromeOpen((v) => !v);
                  }
                }}
              >
                <span className="studio-chrome-grip" aria-hidden />
                <span>{chromeCollapsed ? "展开头部" : "收起"}</span>
              </button>
            )}
          </div>

          <div
            className="studio-scroll min-h-0 flex-1 overflow-y-auto pb-2"
            onClickCapture={(e) => {
              // Touch path for the collapsible chrome: tapping empty
              // main-area space folds the header back up; taps on real
              // controls keep it open.
              if (
                chromeOpen &&
                inWsMap &&
                !(e.target as HTMLElement).closest(
                  "button, a, input, textarea, select",
                )
              ) {
                setChromeOpen(false);
              }
            }}
          >
            {section === "workspace" && !activeCustomModule && (
              <div className="ws-desktop-layer">
                <NeuralWorkspace
                  hubs={wsHubs}
                  headCopy={headCopy}
                  editMode={editMode}
                  onHeadCopyChange={commitHeadCopy}
                  themeId={theme}
                  compact={chromeCollapsed}
                  moduleCount={NEURAL_MODULES.length + customModules.length}
                  stepCount={flowCount}
                  themeLabel={currentTheme.label}
                  themeEn={currentTheme.en}
                  onSelectHub={(k) =>
                    setActiveHubKey(k.startsWith("custom:") ? k.slice(7) : k)
                  }
                  onCycleTheme={() => {
                    const i = THEMES.findIndex((t) => t.id === theme);
                    setTheme(THEMES[(i + 1) % THEMES.length].id);
                  }}
                  onOpenSection={(id) => {
                    const cm = customModules.find((m) => m.id === id);
                    if (cm) {
                      setActiveCustom(cm.id);
                      showToast(`打开 · ${cm.label}`);
                      return;
                    }
                    if (!PILL_NAV.some((p) => p.id === id)) return;
                    setSection(id as SectionId);
                    showToast(`打开 · ${PILL_NAV.find((p) => p.id === id)?.label ?? id}`);
                  }}
                  onReturnLanding={returnToLanding}
                  onPickRow={(row, hub) => {
                    if (hub.customId) {
                      const cm = customModules.find((m) => m.id === hub.customId);
                      setSelectedBoardId(row.id);
                      setActiveCustom(hub.customId);
                      showToast(`打开 · ${cm?.label ?? hub.label} · ${row.title}`);
                      return;
                    }
                    if (hub.section === "ideas" && flowSteps.some((w) => w.id === row.id)) {
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
            {section === "workspace" && !activeCustomModule && (
              <div className="ws-mobile-layer">
                <NeuralWorkspaceMobile
                  hubs={wsHubs}
                  themeId={theme}
                  onSelectHub={(k) =>
                    setActiveHubKey(k.startsWith("custom:") ? k.slice(7) : k)
                  }
                  onOpenSection={(id) => {
                    const cm = customModules.find((m) => m.id === id);
                    if (cm) {
                      setActiveCustom(cm.id);
                      showToast(`打开 · ${cm.label}`);
                      return;
                    }
                    if (!PILL_NAV.some((p) => p.id === id)) return;
                    setSection(id as SectionId);
                    showToast(`打开 · ${PILL_NAV.find((p) => p.id === id)?.label ?? id}`);
                  }}
                  onReturnLanding={returnToLanding}
                  onPickRow={(row, hub) => {
                    if (hub.customId) {
                      const cm = customModules.find((m) => m.id === hub.customId);
                      setSelectedBoardId(row.id);
                      setActiveCustom(hub.customId);
                      showToast(`打开 · ${cm?.label ?? hub.label} · ${row.title}`);
                      return;
                    }
                    if (hub.section === "ideas" && flowSteps.some((w) => w.id === row.id)) {
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
            <div
              className={cn(
                "ws-legacy grid min-h-0 gap-4",
                showBoard && "lg:grid-cols-[minmax(0,1fr)_260px]",
              )}
            >
              <div className="min-w-0 space-y-4" key={section}>
                {section === "workspace" && !activeCustomModule && (
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
                        AIGC 网文拉新 · {flowCount} 步流水线 + 已装 Skill
                      </p>
                    </header>
                    <NeuralModuleMap
                      items={boardItems}
                      selectedId={selectedBoardId}
                      modules={[
                        ...NEURAL_MODULES.map((m) =>
                          m.id === "drafts"
                            ? { ...m, n: skillTotal }
                            : m.id === "database"
                              ? { ...m, n: skillTotal + flowCount }
                              : m.id === "calendar"
                                ? { ...m, n: calItemCount }
                                : m.id === "ideas" || m.id === "workspace"
                                  ? { ...m, n: flowCount }
                                  : m,
                        ),
                        ...customModules.map((m) => ({
                          id: m.id as SectionId,
                          n: customModuleCount(m),
                          label: m.label,
                          en: m.en,
                        })),
                      ]}
                      onOpen={(id) => {
                        const cm = customModules.find((m) => m.id === id);
                        if (cm) {
                          setActiveCustom(cm.id);
                          showToast(`打开 · ${cm.label}`);
                          return;
                        }
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

                {section === "works" && !activeCustomModule && (
                  <>
                    <WorksSyncSection />

                    <header>
                      <h1 className="studio-slogan text-2xl font-semibold tracking-tight md:text-[1.75rem]">
                        成片槽位 · 待发布。
                      </h1>
                      <p className="mt-1 text-[12px] text-[color:var(--studio-muted)] md:text-[13px]">
                        真实流水线槽位 · 无演示封面 / 无他人脸
                      </p>
                    </header>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {metrics.map((m, i) => (
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
                            <RollNumber value={m.value} />
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
                        onClick={() => {
                          setCreateStep(1);
                          setModal("create");
                        }}
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

                {section === "drafts" && !activeCustomModule && (
                  <SectionPane
                    icon={<Wrench className="h-4 w-4" />}
                    title="技能库"
                    en="Skills"
                    desc="已装 Skill · 按 Agent 分区 · 各 Agent 在 skills-sync.json 维护自己区块"
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
                    <div
                      className="space-y-3"
                      data-testid="skills-library"
                      ref={skillsSpringRef}
                    >
                      {filteredSkillAgents.map((agent) => {
                        const open = isAgentOpen(agent.id);
                        return (
                          <div
                            key={agent.id}
                            data-agent-group={agent.id}
                            data-open={open ? "1" : "0"}
                            className="studio-glass overflow-hidden"
                          >
                            <button
                              type="button"
                              data-testid={`skills-group-toggle-${agent.id}`}
                              aria-expanded={open}
                              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:opacity-95"
                              onClick={() => toggleAgentOpen(agent.id)}
                            >
                              <span className="flex min-w-0 items-baseline gap-2">
                                <span className="text-[13px] font-semibold">
                                  {agent.name}
                                </span>
                                <span className="text-[10px] uppercase tracking-wider text-[color:var(--studio-muted)]">
                                  {agent.id} · {agent.skills.length} 个 Skill
                                </span>
                              </span>
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 shrink-0 transition-transform duration-200",
                                  open && "rotate-180",
                                )}
                              />
                            </button>
                            <div
                              className={cn(
                                "studio-collapse",
                                open && "studio-collapse-open",
                              )}
                            >
                              <div className="studio-collapse-inner">
                                <ul className="space-y-2 px-3 pb-3">
                                  {agent.skills.map((s) => {
                                    const detailOpen = openSkillId === s.id;
                                    return (
                                      <li key={s.id} data-spring-item>
                                        <button
                                          type="button"
                                          data-skill={s.id}
                                          aria-expanded={detailOpen}
                                          className={cn(
                                            "studio-glass flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:opacity-95",
                                            selectedBoardId === s.id &&
                                              "studio-row-on",
                                          )}
                                          onClick={() => {
                                            setSelectedBoardId(s.id);
                                            setOpenSkillId((prev) =>
                                              prev === s.id ? null : s.id,
                                            );
                                          }}
                                        >
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium">
                                              {s.zh}
                                            </p>
                                            <p className="truncate text-[10px] text-[color:var(--studio-muted)]">
                                              {s.name} · {s.source}
                                            </p>
                                          </div>
                                          <span className="flex shrink-0 items-center gap-2">
                                            <span className="rounded-full px-2 py-0.5 text-[10px] studio-pill-active">
                                              {s.tag}
                                            </span>
                                            <ChevronDown
                                              className={cn(
                                                "h-3.5 w-3.5 text-[color:var(--studio-muted)] transition-transform duration-200",
                                                detailOpen && "rotate-180",
                                              )}
                                            />
                                          </span>
                                        </button>
                                        <div
                                          className={cn(
                                            "studio-collapse",
                                            detailOpen &&
                                              "studio-collapse-open",
                                          )}
                                        >
                                          <div className="studio-collapse-inner">
                                            <div
                                              className="mt-2 rounded-[10px] border border-[color:var(--studio-border)] bg-black/20 px-4 py-3"
                                              data-testid={`skill-detail-box-${s.id}`}
                                            >
                                              {s.desc ? (
                                                <p
                                                  className="text-[12px] leading-relaxed"
                                                  data-testid={`skill-desc-${s.id}`}
                                                >
                                                  {s.desc}
                                                </p>
                                              ) : null}
                                              {s.detail ? (
                                                <pre
                                                  className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[color:var(--studio-muted)]"
                                                  data-testid={`skill-detail-${s.id}`}
                                                >
                                                  {s.detail}
                                                </pre>
                                              ) : (
                                                <p
                                                  className="mt-2 text-[11px] leading-relaxed text-[color:var(--studio-muted)]"
                                                  data-testid={`skill-detail-${s.id}`}
                                                >
                                                  该技能暂未同步详细介绍，待{" "}
                                                  {agent.name}{" "}
                                                  通过技能接口推送补充。
                                                </p>
                                              )}
                                              <p className="mt-2 text-[10px] text-[color:var(--studio-muted)]">
                                                来源 · {s.source}
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {filteredSkillAgents.length === 0 && (
                        <p className="px-1 text-[12px] text-[color:var(--studio-muted)]">
                          没有匹配的 Skill
                        </p>
                      )}
                    </div>
                  </SectionPane>
                )}

                {section === "ideas" && !activeCustomModule && (
                  <SectionPane
                    icon={<Workflow className="h-4 w-4" />}
                    title="灵感池 · 工作流"
                    en="Workflow"
                    desc="按执行者分区 · 我 / AI / Agent · 步骤保存在本机浏览器"
                  >
                    <div
                      data-testid="flow-zones"
                      className="space-y-5"
                      ref={flowSpringRef}
                    >
                      {FLOW_ZONES.map((zone) => {
                        const steps = flowSteps.filter(
                          (s) => s.zone === zone.id,
                        );
                        const drafting = flowDraft?.zone === zone.id;
                        return (
                          <div
                            key={zone.id}
                            data-testid={`flow-zone-${zone.id}`}
                          >
                            <div className="mb-2 flex items-center justify-between gap-2 px-1">
                              <p className="text-[13px] font-semibold">
                                {zone.label}
                                <span className="ml-2 text-[10px] font-normal tracking-wider text-[color:var(--studio-muted)]">
                                  {zone.en}
                                </span>
                                <span className="ml-2 text-[11px] font-normal tabular-nums text-[color:var(--studio-muted)]">
                                  {steps.length} 步
                                </span>
                              </p>
                              <button
                                type="button"
                                data-testid={`flow-add-${zone.id}`}
                                className="xuan-btn shrink-0"
                                onClick={() =>
                                  setFlowDraft({ zone: zone.id, title: "" })
                                }
                              >
                                ＋ 加步骤
                              </button>
                            </div>
                            {drafting && (
                              <div
                                className="mb-2 flex items-center gap-2"
                                data-testid={`flow-add-form-${zone.id}`}
                              >
                                <input
                                  data-testid="flow-add-input"
                                  autoFocus
                                  value={flowDraft.title}
                                  onChange={(e) =>
                                    setFlowDraft({
                                      zone: zone.id,
                                      title: e.target.value,
                                    })
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const title = flowDraft.title.trim();
                                      if (!title) {
                                        showToast("先给步骤起个名");
                                        return;
                                      }
                                      addFlowStep(title, zone.id);
                                      setFlowDraft({ zone: zone.id, title: "" });
                                      showToast(`已加步骤 · ${title}`);
                                    }
                                    if (e.key === "Escape") setFlowDraft(null);
                                  }}
                                  placeholder={`给「${zone.label}」区加一步…`}
                                  className="min-w-0 flex-1 rounded-[10px] border border-[color:var(--studio-border)] bg-black/20 px-3 py-2 text-[13px] outline-none"
                                />
                                <button
                                  type="button"
                                  data-testid="flow-add-confirm"
                                  className="xuan-btn xuan-btn-primary shrink-0"
                                  onClick={() => {
                                    const title = flowDraft.title.trim();
                                    if (!title) {
                                      showToast("先给步骤起个名");
                                      return;
                                    }
                                    addFlowStep(title, zone.id);
                                    setFlowDraft({ zone: zone.id, title: "" });
                                    showToast(`已加步骤 · ${title}`);
                                  }}
                                >
                                  添加
                                </button>
                                <button
                                  type="button"
                                  className="xuan-btn shrink-0"
                                  onClick={() => setFlowDraft(null)}
                                >
                                  取消
                                </button>
                              </div>
                            )}
                            {steps.length === 0 ? (
                              <p className="px-1 text-[12px] text-[color:var(--studio-muted)]">
                                暂无步骤 · 点右上「＋ 加步骤」往这个区里加
                              </p>
                            ) : (
                              <ol
                                className={cn(
                                  "flow-list space-y-2",
                                  flowDrag?.zone === zone.id &&
                                    "flow-list-dragging",
                                )}
                                data-flow-list={zone.id}
                              >
                                {steps.map((step, i) => {
                                  const drag =
                                    flowDrag?.zone === zone.id
                                      ? flowDrag
                                      : null;
                                  let liStyle:
                                    | React.CSSProperties
                                    | undefined;
                                  let liClass = "";
                                  if (drag) {
                                    if (step.id === drag.id) {
                                      liStyle = {
                                        transform: `translateY(${drag.dy}px)`,
                                      };
                                      liClass = "flow-row-drag";
                                    } else if (
                                      drag.from < drag.over &&
                                      i > drag.from &&
                                      i <= drag.over
                                    ) {
                                      liStyle = {
                                        transform: `translateY(${-drag.h}px)`,
                                      };
                                    } else if (
                                      drag.over < drag.from &&
                                      i >= drag.over &&
                                      i < drag.from
                                    ) {
                                      liStyle = {
                                        transform: `translateY(${drag.h}px)`,
                                      };
                                    }
                                  }
                                  return (
                                  <li
                                    key={step.id}
                                    data-spring-item
                                    data-flow-row={step.id}
                                    className={liClass}
                                    style={liStyle}
                                  >
                                    <div
                                      className={cn(
                                        "studio-glass flex w-full items-center gap-3 px-4 py-3 text-left",
                                        selectedBoardId === step.id &&
                                          "studio-row-on",
                                      )}
                                    >
                                      <button
                                        type="button"
                                        className="flow-grip"
                                        data-testid={`flow-grip-${step.id}`}
                                        aria-label={`调整顺序：${step.title}（拖动把手，或按上下方向键）`}
                                        onPointerDown={(e) =>
                                          startFlowDrag(e, step, i)
                                        }
                                        onKeyDown={(e) =>
                                          flowGripKeyDown(e, step, i)
                                        }
                                      >
                                        <GripVertical
                                          className="h-4 w-4"
                                          aria-hidden
                                        />
                                      </button>
                                      <button
                                        type="button"
                                        data-step={step.id}
                                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                        onClick={() => openStepDetail(step.id)}
                                      >
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold studio-pill-active">
                                          {i + 1}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                          <span className="block truncate text-sm font-medium">
                                            {step.title}
                                          </span>
                                          <span className="block truncate text-[10px] text-[color:var(--studio-muted)]">
                                            {zone.label}区
                                            {step.note ? ` · ${step.note}` : ""}
                                          </span>
                                        </span>
                                      </button>
                                      <InlineConfirmButton
                                        label="删除"
                                        confirmLabel="确认删除"
                                        testId={`flow-del-${step.id}`}
                                        ariaLabel={`删除步骤 ${step.title}`}
                                        className="shrink-0 rounded-full px-2 py-1 text-[11px] text-[color:var(--studio-muted)] transition-colors hover:bg-white/10 hover:text-red-300"
                                        onConfirm={() => {
                                          deleteFlowStep(step.id);
                                          if (selectedBoardId === step.id)
                                            setSelectedBoardId(null);
                                          showToast(`已删除 · ${step.title}`);
                                        }}
                                      />
                                    </div>
                                  </li>
                                  );
                                })}
                              </ol>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </SectionPane>
                )}

                {section === "calendar" && !activeCustomModule && (
                  <SectionPane
                    icon={<CalendarDays className="h-4 w-4" />}
                    title="日历表"
                    en="Calendar"
                    desc="点任意一天加事项 · 事项保存在本机浏览器"
                  >
                    <div className="studio-glass p-4" data-testid="cal-pane">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-xs text-[color:var(--studio-muted)]">
                          {CAL_YEAR} · October
                        </p>
                        <button
                          type="button"
                          data-testid="cal-add-btn"
                          className="xuan-btn shrink-0"
                          onClick={() => openCalAdd(todayStr())}
                        >
                          ＋ 加事项
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-1.5" data-testid="cal-grid">
                        {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
                          <span
                            key={w}
                            className="text-center text-[9px] text-[color:var(--studio-muted)]"
                          >
                            {w}
                          </span>
                        ))}
                        {Array.from({ length: CAL_FIRST_DOW }).map((_, i) => (
                          <span key={`cal-blank-${i}`} aria-hidden="true" />
                        ))}
                        {CAL_DAYS.map((d) => {
                          const ds = calDateStr(d);
                          const count = calItems.reduce(
                            (n, i) => (i.date === ds ? n + 1 : n),
                            0,
                          );
                          const isToday = ds === todayStr();
                          const isFocus = ds === calFocusDate;
                          return (
                            <button
                              key={d}
                              type="button"
                              data-testid={`cal-day-${d}`}
                              data-count={count}
                              data-today={isToday || undefined}
                              data-focus={isFocus || undefined}
                              onClick={() => openCalAdd(ds)}
                              className={cn(
                                "relative flex h-9 items-center justify-center rounded-lg text-[12px] transition-colors",
                                count > 0
                                  ? "studio-pill-active font-semibold"
                                  : "text-[color:var(--studio-muted)] hover:bg-white/5",
                                isToday &&
                                  "ring-1 ring-inset ring-[color:var(--studio-accent)]",
                                isFocus &&
                                  "ring-2 ring-inset ring-[color:var(--studio-accent)]",
                              )}
                            >
                              {d}
                              {count > 0 && (
                                <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[color:var(--studio-accent)] px-0.5 text-[9px] font-bold leading-none text-black">
                                  {count}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <div
                        className="mt-4 border-t border-[color:var(--studio-border)] pt-3"
                        data-testid="cal-items"
                      >
                        <p className="mb-2 text-[11px] text-[color:var(--studio-muted)]">
                          事项 · 共 {calItemCount} 条 · 点一条跳回对应日期
                        </p>
                        {sortedCalItems.length === 0 ? (
                          <p className="text-[12px] text-[color:var(--studio-muted)]">
                            暂无事项 · 点任意日期，或点右上「＋ 加事项」添加
                          </p>
                        ) : (
                          <ul className="space-y-1">
                            {sortedCalItems.map((i) => (
                              <li key={i.id} className="flex items-center gap-1">
                                <button
                                  type="button"
                                  data-testid={`cal-item-${i.id}`}
                                  data-date={i.date}
                                  className={cn(
                                    "min-w-0 flex-1 rounded-lg px-2 py-2 text-left text-[12px] leading-snug transition-colors hover:bg-white/5",
                                    calFocusDate === i.date &&
                                      "bg-white/5 text-[color:var(--studio-text)]",
                                  )}
                                  onClick={() => {
                                    setCalFocusDate(i.date);
                                    if (
                                      i.date.startsWith(
                                        `${CAL_YEAR}-${String(CAL_MONTH).padStart(2, "0")}-`,
                                      )
                                    ) {
                                      const day = parseInt(i.date.slice(8, 10), 10);
                                      document
                                        .querySelector(
                                          `[data-testid="cal-day-${day}"]`,
                                        )
                                        ?.scrollIntoView({
                                          block: "nearest",
                                          behavior: "smooth",
                                        });
                                    }
                                    showToast(`事项 · ${i.date} · ${i.title}`);
                                  }}
                                >
                                  <span className="mr-2 shrink-0 font-medium tabular-nums text-[color:var(--studio-accent)]">
                                    {parseInt(i.date.slice(5, 7), 10)} 月{" "}
                                    {parseInt(i.date.slice(8, 10), 10)} 日
                                  </span>
                                  <span className="font-medium text-[color:var(--studio-text)]">
                                    {i.title}
                                  </span>
                                  {i.note && (
                                    <span className="text-[color:var(--studio-muted)]">
                                      {" · "}
                                      {i.note}
                                    </span>
                                  )}
                                </button>
                                <InlineConfirmButton
                                  label="删除"
                                  confirmLabel="确认删除"
                                  testId={`cal-del-${i.id}`}
                                  className="shrink-0 rounded-lg px-2 py-1 text-[11px] text-[color:var(--studio-muted)] transition-colors hover:bg-white/5 hover:text-[color:var(--studio-text)]"
                                  onConfirm={() => {
                                    deleteCalItem(i.id);
                                    showToast(`已删除 · ${i.title}`);
                                  }}
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div
                        className="mt-4 border-t border-[color:var(--studio-border)] pt-3"
                        data-testid="cal-tickets"
                      >
                        <p className="mb-2 text-[11px] text-[color:var(--studio-muted)]">
                          待办票 · 共 {tickets.length} 条 · 全站待办，不挂具体日期
                        </p>
                        <ul className="space-y-2">
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
                    </div>
                  </SectionPane>
                )}

                {section === "database" && !activeCustomModule && (
                  <SectionPane
                    icon={<Database className="h-4 w-4" />}
                    title="数据库"
                    en="Database"
                    desc="Skill + 流水线字段表 · 按 Agent 分区"
                  >
                    <div className="space-y-3" data-testid="database-zones">
                      {skillAgents.map((agent) => {
                        const open = isDbZoneOpen(agent.id);
                        return (
                          <div
                            key={agent.id}
                            data-db-group={agent.id}
                            data-open={open ? "1" : "0"}
                            className="studio-glass overflow-hidden"
                          >
                            <button
                              type="button"
                              data-testid={`db-group-toggle-${agent.id}`}
                              aria-expanded={open}
                              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:opacity-95"
                              onClick={() => toggleDbZone(agent.id)}
                            >
                              <span className="flex min-w-0 items-baseline gap-2">
                                <span className="text-[13px] font-semibold">
                                  {agent.name}
                                </span>
                                <span className="text-[10px] uppercase tracking-wider text-[color:var(--studio-muted)]">
                                  {agent.id} · {agent.skills.length} 条
                                </span>
                              </span>
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 shrink-0 transition-transform duration-200",
                                  open && "rotate-180",
                                )}
                              />
                            </button>
                            <div
                              className={cn(
                                "studio-collapse",
                                open && "studio-collapse-open",
                              )}
                            >
                              <div className="studio-collapse-inner">
                                <div className="overflow-x-auto">
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
                                      {agent.skills.map((s) => (
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
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {flowSteps.length > 0 && (
                        <div
                          data-db-group="workflow"
                          data-open={flowZoneOpen ? "1" : "0"}
                          className="studio-glass overflow-hidden"
                        >
                          <button
                            type="button"
                            data-testid="db-group-toggle-workflow"
                            aria-expanded={flowZoneOpen}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:opacity-95"
                            onClick={() => toggleDbZone("workflow")}
                          >
                            <span className="flex min-w-0 items-baseline gap-2">
                              <span className="text-[13px] font-semibold">
                                流水线步骤
                              </span>
                              <span className="text-[10px] uppercase tracking-wider text-[color:var(--studio-muted)]">
                                灵感池 · {flowSteps.length} 条
                              </span>
                            </span>
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 shrink-0 transition-transform duration-200",
                                flowZoneOpen && "rotate-180",
                              )}
                            />
                          </button>
                          <div
                            className={cn(
                              "studio-collapse",
                              flowZoneOpen && "studio-collapse-open",
                            )}
                          >
                            <div className="studio-collapse-inner">
                              <div className="overflow-x-auto">
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
                                    {flowSteps.map((s, i) => (
                                      <tr
                                        key={s.id}
                                        className="cursor-pointer border-b border-[color:var(--studio-border)] last:border-0 hover:bg-white/5"
                                        onClick={() => openStepDetail(s.id)}
                                      >
                                        <td className="px-3 py-2.5">
                                          {i + 1} {s.title}
                                        </td>
                                        <td className="px-3 py-2.5">流水线</td>
                                        <td className="px-3 py-2.5">
                                          {flowZoneLabel(s.zone)}区
                                        </td>
                                        <td className="px-3 py-2.5 text-[color:var(--studio-muted)]">
                                          {s.note ?? "灵感池 · 自建步骤"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </SectionPane>
                )}

                {activeCustomModule && activeCustomModule.id === "ontology" ? (
                  <SectionPane
                    icon={<Network className="h-4 w-4" />}
                    title={activeCustomModule.label}
                    en={activeCustomModule.en}
                    desc="建设中 · 模块骨架已就位，内容细节待定"
                  >
                    <OntologyModuleView />
                  </SectionPane>
                ) : activeCustomModule && activeCustomModule.id === "finance" ? (
                  <SectionPane
                    icon={<Wallet className="h-4 w-4" />}
                    title={activeCustomModule.label}
                    en={activeCustomModule.en}
                    desc="概览 · 记账 · 月度报告 · 负债 · 资产 —— 数字全部由本机数据派生"
                  >
                    <FinanceModuleView
                      entries={finEntries}
                      liabilities={finLiabilities}
                      assets={finAssets}
                      budget={finBudget}
                      onAddEntry={addFinEntry}
                      onUpdateEntry={updateFinEntry}
                      onDeleteEntry={deleteFinEntry}
                      onAddLiability={addFinLiability}
                      onUpdateLiability={updateFinLiability}
                      onDeleteLiability={deleteFinLiability}
                      onAddAsset={addFinAsset}
                      onUpdateAsset={updateFinAsset}
                      onDeleteAsset={deleteFinAsset}
                      onSetBudget={setFinBudgetPersisted}
                      showToast={showToast}
                    />
                  </SectionPane>
                ) : activeCustomModule && activeCustomModule.id === "health" ? (
                  <SectionPane
                    icon={<HeartPulse className="h-4 w-4" />}
                    title={activeCustomModule.label}
                    en={activeCustomModule.en}
                    desc="今日安排 · 每日打卡 · 健康数据 · 饮食 —— 计划源自塑形计划，数据走 health-sync 下发"
                  >
                    <HealthModuleView
                      checkins={healthCheckins}
                      onToggleCheckin={toggleHealthCheckin}
                      showToast={showToast}
                    />
                  </SectionPane>
                ) : activeCustomModule ? (
                  <SectionPane
                    icon={<LayoutGrid className="h-4 w-4" />}
                    title={activeCustomModule.label}
                    en={activeCustomModule.en}
                    desc="自定义模块 · 在「新建任务」里给它加条目，数据保存在本机浏览器"
                  >
                    <div data-testid="custom-module-view">
                      {(customRows[activeCustomModule.id] ?? []).length === 0 ? (
                        <p className="text-[12px] text-[color:var(--studio-muted)]">
                          还没有条目。点右上角「新建任务」，目标模块选「{activeCustomModule.label}」即可添加。
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {(customRows[activeCustomModule.id] ?? []).map((row) => (
                            <li key={row.id}>
                              <button
                                type="button"
                                className={cn(
                                  "studio-glass flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:opacity-95",
                                  selectedBoardId === row.id && "studio-row-on",
                                )}
                                onClick={() => {
                                  setSelectedBoardId(row.id);
                                  showToast(`选中 · ${row.title}`);
                                }}
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium">{row.title}</p>
                                  <p className="truncate text-[10px] text-[color:var(--studio-muted)]">
                                    {row.a} · {row.b}
                                  </p>
                                </div>
                                {row.c && (
                                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] studio-pill-active">
                                    {row.c}
                                  </span>
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </SectionPane>
                ) : null}
              </div>

              {showBoard && (
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
                          `${flowCount} 步工作流 · 按执行者分区（我 / AI / Agent）`}
                        {selected.kind === "skill" &&
                          "已装 Skill · 可从技能库打开"}
                        {selected.kind === "pending" &&
                          "待办票 · 阻塞发布或改派"}
                        {selected.kind === "slot" && "成片槽 · 无演示封面"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          ["Skill", "Skills", skillTotal, Wrench],
                          ["步骤", "Steps", flowCount, Workflow],
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
                          showToast(`打开技能库 · ${selected.title}`);
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
              )}
            </div>
          </div>

          <div className="studio-footer shrink-0 border-t border-[color:var(--studio-border)] bg-[color:color-mix(in_srgb,var(--studio-bg)_92%,transparent)] py-1.5 backdrop-blur-md sm:py-3">
            <div className="flex flex-row items-center justify-between gap-2 sm:items-end">
              <div className="min-w-0">
                <p className="mb-1.5 hidden text-[9px] font-semibold uppercase tracking-[0.16em] text-[color:var(--studio-accent)] sm:block">
                  主题动效 · Theme
                </p>
                <FluidPillGroup className="studio-pill-nav inline-flex flex-wrap gap-0.5 rounded-full p-1">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      data-pill-active={theme === t.id || undefined}
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
                </FluidPillGroup>
              </div>

              {(() => {
                const step = flowSteps.find((s) => s.id === selectedBoardId);
                if (!step) return null;
                return (
                  <button
                    type="button"
                    data-testid="step-pill"
                    className="studio-step-pill"
                    onClick={() => openStepDetail(step.id)}
                    title="打开步骤详情"
                  >
                    步骤 · {step.title}
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
          className="studio-sheet-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={onBackdropClick}
          role="presentation"
        >
          <div
            className={cn(
              "studio-root studio-glass studio-sheet-panel w-full max-w-md p-5 shadow-2xl",
              `theme-${theme}`,
              sheetShaking && "sheet-shake",
            )}
            data-theme={theme}
            style={
              sheetDrag > 0
                ? {
                    transform: `translateY(${sheetDrag}px)`,
                    transition: sheetDragRef.current.dragging
                      ? "none"
                      : "transform 0.32s cubic-bezier(0.32, 1.3, 0.44, 1)",
                  }
                : undefined
            }
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
          >
            <div
              className="sheet-handle"
              aria-hidden
              onPointerDown={onSheetPointerDown}
              onPointerMove={onSheetPointerMove}
              onPointerUp={onSheetPointerUp}
              onPointerCancel={onSheetPointerUp}
            />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                {modal === "edit" && "编辑条目"}
                {modal === "manage" && "管理面板"}
                {modal === "create" && "新建任务"}
                {modal === "newmodule" && "新建模块"}
                {modal === "step" && "步骤详情"}
                {modal === "caladd" && "添加日历事项"}
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
              const step = flowSteps.find((s) => s.id === selectedBoardId);
              if (!step) {
                // Graceful fallback: the step is gone (workflow was rebuilt
                // into 我 / AI / Agent zones) — never render stale data.
                return (
                  <div className="space-y-3" data-testid="step-detail">
                    <p className="text-[13px] leading-relaxed text-[color:var(--studio-muted)]">
                      这条步骤已不存在——工作流已按「我 / AI / Agent」分区重构，需要的步骤可以在灵感池里重新添加。
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="xuan-btn xuan-btn-primary"
                        onClick={() => {
                          setModal(null);
                          setSection("ideas");
                        }}
                      >
                        去灵感池
                      </button>
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
              }
              const zoneSteps = flowSteps.filter((s) => s.zone === step.zone);
              const idx = zoneSteps.findIndex((s) => s.id === step.id);
              return (
                <div className="space-y-3" data-testid="step-detail">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold studio-pill-active">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[16px] font-semibold">{step.title}</p>
                      <p className="text-[12px] text-[color:var(--studio-muted)]">
                        {flowZoneLabel(step.zone)}区 · 本区第 {idx + 1} 步（全站共 {flowCount} 步）
                      </p>
                    </div>
                    <span className="ml-auto shrink-0 rounded-full px-2.5 py-1 text-[11px] studio-pill-active">
                      {flowZoneLabel(step.zone)}
                    </span>
                  </div>
                  <div className="studio-glass space-y-2 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-accent)]">
                      备注 · Note
                    </p>
                    <p className="text-[13px] leading-relaxed">
                      {step.note ??
                        "自建步骤 · 在灵感池对应分区里管理：点分区头「＋ 加步骤」继续添加，点步骤行右侧「删除」移除。"}
                    </p>
                  </div>
                  {stepDeleteArm ? (
                    <div
                      className="space-y-2 rounded-[12px] border border-[rgba(229,72,77,0.4)] p-3"
                      data-testid="step-delete-confirm"
                    >
                      <p className="text-[12px] leading-relaxed">
                        确定删除「{step.title}」这一步？删除后不可恢复。
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="xuan-btn xuan-btn-danger flex-1 justify-center"
                          data-testid="step-delete-do"
                          onClick={() => {
                            deleteFlowStep(step.id);
                            if (selectedBoardId === step.id)
                              setSelectedBoardId(null);
                            setStepDeleteArm(false);
                            setModal(null);
                            showToast(`已删除 · ${step.title}`);
                          }}
                        >
                          删除这一步
                        </button>
                        <button
                          type="button"
                          className="xuan-btn justify-center"
                          onClick={() => setStepDeleteArm(false)}
                        >
                          再想想
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="xuan-btn xuan-btn-primary"
                        data-testid="step-action-primary"
                        onClick={() => setModal(null)}
                      >
                        完成
                      </button>
                      <button
                        type="button"
                        className="xuan-btn xuan-btn-danger-ghost"
                        data-testid="step-delete-arm"
                        onClick={() => setStepDeleteArm(true)}
                      >
                        删除这一步
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {modal === "caladd" && calDraft && (
              <div className="space-y-3 text-[13px]" data-testid="modal-caladd">
                <StepDots
                  steps={["选日期", "填事项", "确认"]}
                  current={calStep}
                  testid="cal-steps"
                />
                {calStep === 1 && (
                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-[10px] text-[color:var(--studio-muted)]">
                        日期（可改，想加到哪天改哪天）
                      </span>
                      <input
                        type="date"
                        data-testid="cal-add-date"
                        value={calDraft.date}
                        onChange={(e) =>
                          setCalDraft({ ...calDraft, date: e.target.value })
                        }
                        className="mt-1 w-full rounded-[10px] border border-[color:var(--studio-border)] bg-black/20 px-3 py-2 outline-none [color-scheme:dark]"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="xuan-btn justify-center"
                        onClick={() =>
                          setCalDraft({ ...calDraft, date: todayStr() })
                        }
                      >
                        今天
                      </button>
                      <button
                        type="button"
                        className="xuan-btn justify-center"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 1);
                          const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                          setCalDraft({ ...calDraft, date: s });
                        }}
                      >
                        明天
                      </button>
                      <span className="flex-1" />
                      <button
                        type="button"
                        className="xuan-btn justify-center"
                        onClick={() => setModal(null)}
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        className="xuan-btn xuan-btn-primary justify-center"
                        data-testid="cal-add-next-1"
                        onClick={() => {
                          if (!/^\d{4}-\d{2}-\d{2}$/.test(calDraft.date)) {
                            showToast("先选日期");
                            return;
                          }
                          setCalStep(2);
                        }}
                      >
                        下一步 · 填事项
                      </button>
                    </div>
                  </div>
                )}
                {calStep === 2 && (
                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-[10px] text-[color:var(--studio-muted)]">
                        任务事项（必填）
                      </span>
                      <input
                        data-testid="cal-add-title"
                        value={calDraft.title}
                        onChange={(e) =>
                          setCalDraft({ ...calDraft, title: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (!calDraft.title.trim()) {
                              showToast("先填任务事项");
                              return;
                            }
                            setCalStep(3);
                          }
                        }}
                        placeholder="比如：发布视频号 ep02"
                        className="mt-1 w-full rounded-[10px] border border-[color:var(--studio-border)] bg-black/20 px-3 py-2 outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] text-[color:var(--studio-muted)]">
                        备注（可不填）
                      </span>
                      <input
                        data-testid="cal-add-note"
                        value={calDraft.note}
                        onChange={(e) =>
                          setCalDraft({ ...calDraft, note: e.target.value })
                        }
                        placeholder="补充说明…"
                        className="mt-1 w-full rounded-[10px] border border-[color:var(--studio-border)] bg-black/20 px-3 py-2 outline-none"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="xuan-btn justify-center"
                        onClick={() => setCalStep(1)}
                      >
                        上一步
                      </button>
                      <button
                        type="button"
                        className="xuan-btn xuan-btn-primary flex-1 justify-center"
                        data-testid="cal-add-next-2"
                        onClick={() => {
                          if (!calDraft.title.trim()) {
                            showToast("先填任务事项");
                            return;
                          }
                          setCalStep(3);
                        }}
                      >
                        下一步 · 确认
                      </button>
                    </div>
                  </div>
                )}
                {calStep === 3 && (
                  <div className="space-y-3">
                    <div
                      className="studio-glass space-y-1.5 p-3"
                      data-testid="cal-add-summary"
                    >
                      <p>
                        <span className="text-[color:var(--studio-muted)]">日期 · </span>
                        <span className="tabular-nums">{calDraft.date}</span>
                      </p>
                      <p>
                        <span className="text-[color:var(--studio-muted)]">事项 · </span>
                        {calDraft.title.trim()}
                      </p>
                      <p>
                        <span className="text-[color:var(--studio-muted)]">备注 · </span>
                        {calDraft.note.trim() || "—"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="xuan-btn justify-center"
                        onClick={() => setCalStep(2)}
                      >
                        返回修改
                      </button>
                      <button
                        type="button"
                        className="xuan-btn xuan-btn-primary flex-1 justify-center"
                        data-testid="cal-add-confirm"
                        onClick={() => {
                          const title = calDraft.title.trim();
                          const item = addCalItem(
                            calDraft.date,
                            title,
                            calDraft.note.trim() || undefined,
                          );
                          setCalFocusDate(item.date);
                          setCalDraft(null);
                          setModal(null);
                          showToast(`已加事项 · ${item.date} · ${title}`);
                        }}
                      >
                        保存事项
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

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
                      nav.id === "drafts" ? skillTotal
                      : nav.id === "database" ? skillTotal + flowCount
                      : hub ? hub.rows.length
                      : nav.id === "ideas" ? flowCount
                      : nav.id === "works" ? WORK_SLOTS.length
                      : nav.id === "calendar" ? tickets.length
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
                          setActiveCustom(null);
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
                {customModules.length > 0 && (
                  <div className="grid gap-1.5">
                    <p className="text-[11px] text-[color:var(--studio-muted)]">
                      自建模块
                    </p>
                    {customModules.map((m) => (
                      <div key={m.id} className="flex items-center gap-1.5">
                        <button
                          type="button"
                          data-manage={m.id}
                          className={cn(
                            "xuan-btn w-full justify-between",
                            activeCustom === m.id && "xuan-btn-primary",
                          )}
                          onClick={() => {
                            setActiveCustom(m.id);
                            setModal(null);
                            showToast(`打开 · ${m.label}`);
                          }}
                        >
                          <span>{m.label} <small className="opacity-60">{m.en}</small></span>
                          <span className="tabular-nums opacity-70">
                            {customModuleCount(m)}
                          </span>
                        </button>
                        <InlineConfirmButton
                          label="删除"
                          confirmLabel="删除模块"
                          testId={`delete-module-${m.id}`}
                          ariaLabel={`删除${m.label}`}
                          className="xuan-btn shrink-0"
                          onConfirm={() => {
                            setCustomModules((prev) => {
                              const next = prev.filter((x) => x.id !== m.id);
                              persistCustomModules(next);
                              return next;
                            });
                            setCustomRows((prev) => {
                              const next = { ...prev };
                              delete next[m.id];
                              persistCustomRows(next);
                              return next;
                            });
                            if (activeCustom === m.id) setActiveCustom(null);
                            if (activeHubKey === m.id) setActiveHubKey("ll");
                            showToast(`已删除模块 · ${m.label}`);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
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
              const targets = [
                ...hubs.map((h) => ({
                  key: h.key as string,
                  label: h.label,
                  en: h.en,
                  section: h.section as string,
                  count: h.rows.length,
                  custom: false,
                })),
                ...customModules.map((m) => ({
                  key: m.id,
                  label: m.label,
                  en: m.en,
                  section: m.id,
                  count: customModuleCount(m),
                  custom: true,
                })),
              ];
              const target = targets.find((t) => t.key === activeHubKey) ?? targets[0];
              const submitCreate = () => {
                const title = newTitle.trim() || `未命名 · ${target.label}`;
                const id = `row-local-${Date.now()}`;
                const row = {
                  id,
                  title,
                  a: "手动新建",
                  b: "tang",
                  c: "新",
                };
                if (target.custom) {
                  setCustomRows((prev) => {
                    const next = {
                      ...prev,
                      [target.key]: [row, ...(prev[target.key] ?? [])],
                    };
                    persistCustomRows(next);
                    return next;
                  });
                  setSelectedBoardId(id);
                  setModal(null);
                  setNewTitle("");
                  setActiveCustom(target.key);
                  showToast(`已加入 ${target.label} · ${title}`);
                  return;
                }
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
              };
              return (
              <div className="space-y-3 text-[13px]" data-testid="modal-create">
                <StepDots
                  steps={["选模块", "写标题", "确认"]}
                  current={createStep}
                  testid="create-steps"
                />
                {createStep === 1 && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-[color:var(--studio-muted)]">
                      先选加到哪个模块 · 点一下就进下一步
                    </p>
                    <div className="grid max-h-[44vh] gap-1.5 overflow-y-auto pr-0.5">
                      {targets.map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          data-testid={`create-target-${t.key}`}
                          className={cn(
                            "xuan-btn w-full justify-between",
                            t.key === target.key && "xuan-btn-primary",
                          )}
                          onClick={() => {
                            setActiveHubKey(t.key);
                            setCreateStep(2);
                          }}
                        >
                          <span>
                            {t.label}{" "}
                            <small className="opacity-60">{t.en}</small>
                          </span>
                          <span className="tabular-nums opacity-70">
                            {t.count}
                          </span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      data-testid="create-new-module"
                      className="text-[12px] font-medium text-[color:var(--studio-accent)] hover:underline"
                      onClick={() => {
                        setNewModuleLabel("");
                        setNewModuleEn("");
                        setModal("newmodule");
                      }}
                    >
                      ＋ 新建模块（不在列表里就建一个）
                    </button>
                  </div>
                )}
                {createStep === 2 && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-[color:var(--studio-muted)]">
                      加到 <b className="text-[color:var(--studio-text)]">{target.label}</b>
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
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            setCreateStep(3);
                          }
                        }}
                        placeholder={`写一条${target.label}条目…`}
                        className="mt-1 w-full rounded-[10px] border border-[color:var(--studio-border)] bg-black/20 px-3 py-2 outline-none"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="xuan-btn justify-center"
                        onClick={() => setCreateStep(1)}
                      >
                        上一步
                      </button>
                      <button
                        type="button"
                        className="xuan-btn xuan-btn-primary flex-1 justify-center"
                        data-testid="create-next"
                        onClick={() => setCreateStep(3)}
                      >
                        下一步 · 确认
                      </button>
                    </div>
                  </div>
                )}
                {createStep === 3 && (
                  <div className="space-y-3">
                    <div
                      className="studio-glass space-y-1.5 p-3"
                      data-testid="create-summary"
                    >
                      <p>
                        <span className="text-[color:var(--studio-muted)]">目标模块 · </span>
                        {target.label}
                        <span className="opacity-60"> · {target.en}</span>
                      </p>
                      <p>
                        <span className="text-[color:var(--studio-muted)]">条目标题 · </span>
                        {newTitle.trim() || `未命名 · ${target.label}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="xuan-btn justify-center"
                        onClick={() => setCreateStep(2)}
                      >
                        返回修改
                      </button>
                      <button
                        type="button"
                        className="xuan-btn xuan-btn-primary flex-1 justify-center"
                        data-testid="create-submit"
                        onClick={submitCreate}
                      >
                        加入 {target.label}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              );
            })()}

            {modal === "newmodule" && (
              <div className="space-y-3 text-[13px]" data-testid="modal-newmodule">
                <p className="text-[11px] text-[color:var(--studio-muted)]">
                  新模块会出现在导航、工作台模块图和管理面板里，计数自动跟着变。
                </p>
                <label className="block">
                  <span className="text-[10px] text-[color:var(--studio-muted)]">
                    模块名称（必填）
                  </span>
                  <input
                    data-testid="newmodule-label"
                    value={newModuleLabel}
                    onChange={(e) => setNewModuleLabel(e.target.value)}
                    placeholder="比如：选题库"
                    className="mt-1 w-full rounded-[10px] border border-[color:var(--studio-border)] bg-black/20 px-3 py-2 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] text-[color:var(--studio-muted)]">
                    英文名（可不填）
                  </span>
                  <input
                    data-testid="newmodule-en"
                    value={newModuleEn}
                    onChange={(e) => setNewModuleEn(e.target.value)}
                    placeholder="比如：TOPICS（空着自动用 CUSTOM）"
                    className="mt-1 w-full rounded-[10px] border border-[color:var(--studio-border)] bg-black/20 px-3 py-2 outline-none"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="xuan-btn justify-center"
                    data-testid="newmodule-back"
                    onClick={() => {
                      setCreateStep(1);
                      setModal("create");
                    }}
                  >
                    返回
                  </button>
                  <button
                    type="button"
                    className="xuan-btn xuan-btn-primary flex-1 justify-center"
                    data-testid="newmodule-submit"
                    onClick={() => {
                      const label = newModuleLabel.trim();
                      if (!label) {
                        showToast("先填模块名称");
                        return;
                      }
                      const en =
                        newModuleEn.trim().toUpperCase().slice(0, 24) || "CUSTOM";
                      const mod: CustomModule = {
                        id: `custom-${Date.now()}`,
                        label,
                        en,
                      };
                      setCustomModules((prev) => {
                        const next = [...prev, mod];
                        persistCustomModules(next);
                        return next;
                      });
                      setActiveHubKey(mod.id);
                      setCreateStep(2);
                      setModal("create");
                      showToast(`模块已建 · ${label}，接下来给它加条目`);
                    }}
                  >
                    建模块
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "xuan-toast fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center rounded-full px-4 py-2 text-[12px] font-medium shadow-lg",
            toast.actionLabel ? "pointer-events-auto" : "pointer-events-none",
          )}
        >
          <span>{toast.msg}</span>
          {toast.actionLabel && (
            <button
              type="button"
              className="xuan-toast-action"
              onClick={() => {
                if (toastTimerRef.current)
                  window.clearTimeout(toastTimerRef.current);
                toast.onAction?.();
                setToast(null);
              }}
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Desktop workspace hubs (plate frame ~6.5s) with real rows. */

/** Landing plate nodes → sections (real counts). */
const LANDING_NODES: LandingNode[] = [
  { key: "top", section: "ideas", n: 0, label: "灵感池", en: "Workflow", sub: "步拉新流水线" },
  { key: "left", section: "works", n: WORK_SLOTS.length, label: "作品库", en: "Works", sub: "ep01 待发布" },
  { key: "ll", section: "drafts", n: SKILL_TOTAL_FALLBACK, label: "技能库", en: "Skills", sub: "已装 Skill" },
  { key: "right", section: "database", n: SKILL_TOTAL_FALLBACK, label: "数据库", en: "Database", sub: "Skill + 流程" },
  { key: "lr", section: "calendar", n: 0, label: "日历表", en: "Calendar", sub: `${PENDING_TICKETS.length} 条待办` },
];

const NEURAL_MODULES: {
  id: SectionId;
  n: number;
  label: string;
  en: string;
}[] = [
  { id: "workspace", n: 0, label: "工作台", en: "WORKSPACE" },
  { id: "database", n: SKILL_TOTAL_FALLBACK, label: "数据库", en: "DATABASE" },
  { id: "works", n: WORK_SLOTS.length, label: "作品库", en: "WORKS" },
  { id: "calendar", n: 0, label: "日历表", en: "CALENDAR" },
  { id: "drafts", n: SKILL_TOTAL_FALLBACK, label: "技能库", en: "SKILLS" },
  { id: "ideas", n: 0, label: "灵感池", en: "WORKFLOW" },
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
  modules = NEURAL_MODULES,
}: {
  items: BoardItem[];
  selectedId: string | null;
  onOpen: (id: SectionId) => void;
  onSelectItem: (item: BoardItem) => void;
  modules?: typeof NEURAL_MODULES;
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
            {modules.map((m) => (
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
