# Studio 交接（给其他 AI）

你在继续 Tang 的个人网站 **studio** 页。目标是让 `/studio` 尽量贴近抖音玄子板块的观感。线上地址是 **https://kb-zeta-one.vercel.app/studio**。没有 Tang 同意，不要改这个别名或域名。

英文版同一份说明：`docs/studio-handoff-prompt.md`。

## 仓库与线上

- 克隆：https://github.com/tang995719-blip/kb
- 线上 studio：https://kb-zeta-one.vercel.app/studio
- Vercel 项目名：`kb`
- 应用根目录就是本仓库（Next.js App Router + Tailwind）。克隆后：`npm install`，再 `npm run dev`。

## 本仓库路径

- Studio 页：`src/app/(app)/studio/page.tsx`
- 神经主体落地页：`src/components/studio/neural-landing.tsx`
- 工作台（桌面 + 手机）：`src/components/studio/neural-workspace.tsx`
- 样式：`src/app/globals.css`（token `--pl-*`、`.lp-*`、`.ws-*`、`.studio-login-*`）
- 登录：`src/middleware.ts`、`src/app/api/auth/{login,logout,me}/route.ts`、`src/app/login/page.tsx`
- 环境变量模板（只有名字，没有密码）：`.env.example`

## 用户流程

1. **登录门**（银黑玻璃）→ 用户名 + 密码
2. **神经主体**（板块开场：光球 + 5 个水母枢纽）
3. **工作台**（桌面板块 / 手机竖屏）→ 分区药丸（作品库 / 创作池 / 灵感池 / 日历表 / 数据库）
4. 红灯或光球点击 → 回到**主体**。**退出** → 登出到登录门。

## 登录（仓库里没有密码）

- 登录必须从环境变量读取 `SITE_AUTH_USER` 和 `SITE_AUTH_PASS`。
- 仅当 `SITE_AUTH_*` 没设置时，登录接口才会再读已经支持的别名：`NEXT_PUBLIC_STUDIO_USER` / `NEXT_PUBLIC_STUDIO_PASS`。优先用 `SITE_AUTH_*`。不要把密码放进 `NEXT_PUBLIC_*`（这些值可能暴露给浏览器）。
- 环境变量缺失时，`/api/auth/login` **失败关闭**（HTTP 503，`登录未配置`）。用户名或密码不对返回 HTTP 401。没有内置默认密码。
- 密码只存在于 Vercel 项目 `kb` 的环境变量和 Tang 的记忆里。不要把密码写进源码、注释、`.env.example`、文档或提交。
- 会话：httpOnly cookie `site_session`，以及 `localStorage.studio_session`。中间件也会拦住未登录访问，除非 `SITE_AUTH_OFF=1`（这个开关只跳过中间件墙；登录接口仍然要求环境变量）。

## 设计 token

- 深色：`#0D0E0E` / `#161717` / 文字 `#ECECE9` / 强调 `#E6CF98`
- 主题：银黑 / 暖灰 / 新拟物（`theme-silver|warm|neu`）。落地页和工作台都跟 `--pl-*`。浅色主题把板块素材放在深色新拟物凹槽里。

## 交互（不要弄坏）

| 控件 | 行为 |
|--------|----------|
| 登录 | 进入主体之前必须登录；凭证错误要显示错误 |
| 落地页进入 / 枢纽卡片 | → 工作台（或对应分区） |
| 桌面/手机 **光球**（`data-testid=ws-orb-back`） | → 神经主体 |
| 枢纽 / 卡片第一次点 | 选中枢纽；第二次点 → 打开分区 |
| 列表行点击 | 切到对应分区并高亮（`studio-row-on`）+ toast；工作流行打开**步骤详情** |
| 底部 **步骤 N · 标题** 药丸（`step-pill`） | 打开步骤详情 |
| 看板 **可派发 / 打开步骤** | 打开该工作流的步骤详情 |
| 红灯 | → 主体（不是登出） |
| 黄灯 / 绿灯 | 最小化 / 全屏（CSS 兜底） |
| **退出** | 登出 → 登录门 |
| 窗口标题 | 默认 `涛的个人工作台`；点击或 ✎ 编辑；存在 `localStorage.studio_window_title` |

## 内容来源（用 Tang 的真实数据，不要用玄子演示标题）

- `studio/page.tsx` 里的 `SKILLS`、`WORKFLOW_STEPS`（8 步，含 `next` / `notes`）、`PENDING_TICKETS`、`WORK_SLOTS`、`WS_HUBS`、`LANDING_NODES`。

## 部署

- Vercel 项目名：`kb`
- 生产别名保持 **https://kb-zeta-one.vercel.app**（studio 在 `/studio`）
- 在该项目的环境变量里设置 `SITE_AUTH_USER` 和 `SITE_AUTH_PASS`。不要提交它们。
- 没有 Tang 同意，不要改现有的 vercel.app 别名。

## 中国访问

- Tang 在中国大陆**经常打不开** `*.vercel.app`。
- 目前项目域名：`kb-zeta-one.vercel.app` 和 `kb-wending1.vercel.app`。还没有自定义域名，也没有国内 CDN。
- 这个 Next 应用有 API 路由和中间件，不能直接当成静态 GitHub Pages，除非另做 worker / 后端。
- **下一步要 Tang 确认，不要自行买域名：**
  1. 绑定 Tang 已经拥有、国内能访问的自定义域名（Vercel 项目域名）；大陆可能需要 ICP。
  2. 或用 Tang 的 Cloudflare 账号做 Pages / 反向代理，镜像同一套部署。
  3. 可选：如果团队能开通，再用 Vercel 北京/上海 marketplace CDN。
- 不要改现有的 vercel.app 别名。

## 验收

要覆盖：登录（缺环境变量、错误凭证、正确凭证）、落地页、光球回主体、选枢纽、列表行进分区、步骤药丸/详情、看板按钮、红绿灯、改标题、登出。桌面 1440×900，手机 390×844。

## 已知差距

- 桌面落地页统计条比板块 f525 短；光球光晕比板块弱一点。
- 暖灰 / 新拟物的微光偏淡；视差只在桌面。
- 20 行以上的列表偏挤；国内可访问地址还没有。
- 步骤动作还是本地占位（toast / 跳转），没有接飞书或 Muse API。

## 本地预览

```bash
git clone https://github.com/tang995719-blip/kb
cd kb
npm install
# 在 shell 里导出 SITE_AUTH_USER 和 SITE_AUTH_PASS。不要提交。
npm run dev
```

`SITE_AUTH_OFF=1` 只跳过中间件重定向。Studio 页仍有自己的登录门，并且会调用 `/api/auth/login`。

继续朝板块打磨。保持登录门、神经主体、工作台这三段行为不变。

## 行为备注

- `+新建任务` 会在**当前选中的枢纽**下追加一行（创作池 / 灵感池 / 作品库 / 数据库 / 日历表），并用 `localStorage` 键 `studio_hub_rows_v1` 记住。
- 生产环境由 Vercel 项目 `kb` 提供，地址是 https://kb-zeta-one.vercel.app/studio。
