# 个人知识库网站 · S2 骨架

本地-only Next.js App Router 骨架（按 `/workspace/personal-site/方案.md` §2 / §3 / §5 / §9）。

**未部署** · **未创建 GitHub/Vercel** · 本目录即应用根。

## 启动

```bash
cd /workspace/personal-site/web
npm install
npm run dev
```

浏览器打开 http://localhost:3000 → 会跳到 `/login`。

### 本地演示登录

- 输入**任意非空密码**即可登录（bcrypt / `SITE_PASSWORD_HASH` 尚未接）。
- 登录后写入 HttpOnly Cookie：`site_session`（任意非空值即视为已登录）。
- 手动设 Cookie（可选）：开发者工具 → Application → Cookies → 新增 `site_session=local-demo`，Path=`/`。
- 清 Cookie 后访问任意页会再跳 `/login`。

## 路由

| 路径 | 说明 |
|------|------|
| `/login` | 密码表单 UI |
| `/` | Dashboard：Notes Indexed / Last Sync / Open Tickets / Recent Commits |
| `/kb` | 知识库占位 |
| `/workflows` | 工作流占位 |
| `/tickets` | 工单占位 |
| `/tools` | 工具入口占位 |

布局：左侧 **56px 图标轨道** + **260px 分区面板**（桌面）；`⌘/Ctrl+K` 打开空命令面板（cmdk）。

## Stub vs 真实（S2）

| 已落地 | 仍为 stub / 注释 |
|--------|------------------|
| 深色主题 §9 hex | FlexSearch 全文检索 |
| 图标轨道 + 面板侧栏 | GitHub 读写 / 同步 |
| 登录页 + middleware 拦未登录 | 真 bcrypt 校验与失败锁定 |
| shadcn 风格 Button/Input/Card | 完整 shadcn 组件库按需再加 |
| lucide-react 图标 | CodeMirror 编辑器 |
| cmdk 命令面板壳 | 笔记渲染 / 双链 |
| 指标卡术语化标签 | 指标真实数据 |

## 配色（§9）

- 背景 `#0B0D12` · 卡片 `#12151C` · 描边 `rgba(255,255,255,0.08)`
- 主文字 `#E6E8EE` · 次要 `#8A93A6` · 强调 `#7C9CFF`
- 字体：Inter + Noto Sans SC · 代码 JetBrains Mono · 圆角 12px

## 相关文档

上级方案：`../方案.md`
