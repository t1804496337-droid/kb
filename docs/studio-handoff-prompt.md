# Studio /studio handoff prompt (paste into another AI)

You are continuing Tang’s personal site **studio** page. Goal: 1:1 Douyin Xuan子 plate look-and-feel for `/studio`, live at **https://kb-zeta-one.vercel.app/studio** (do **not** change this alias / domain without Tang’s OK).

Chinese handoff for the same instructions: `docs/studio-给其他AI交接.md`. Clone https://github.com/t1804496337-droid/kb.

## Repo & live site

- Clone: https://github.com/t1804496337-droid/kb
- This repository is public.
- Live studio: https://kb-zeta-one.vercel.app/studio
- Vercel project name: `kb`
- App root is this repository (Next.js App Router + Tailwind). After clone: `npm install`, then `npm run dev`.

## Paths in this repo

- Studio page: `src/app/(app)/studio/page.tsx`
- Landing: `src/components/studio/neural-landing.tsx`
- Workspace (desktop+mobile): `src/components/studio/neural-workspace.tsx`
- Styles: `src/app/globals.css` (tokens `--pl-*`, `.lp-*`, `.ws-*`, `.studio-login-*`)
- Auth: `src/middleware.ts`, `src/app/api/auth/{login,logout,me}/route.ts`, `src/app/login/page.tsx`
- Env template (names only): `.env.example`

## Architecture (user flow)

1. **Login gate** (glass silver-black) → username + password
2. **Neural landing** (plate splash: orb + 5 jellyfish hubs)
3. **Workspace** (desktop plate / mobile portrait) → section pills (作品库 / 创作池 / 灵感池 / 日历表 / 数据库)
4. Red traffic light / orb click → back to **landing** (主体). **退出** → logout to login gate.

## Auth (no secrets in this repo)

- Login requires `SITE_AUTH_USER` and `SITE_AUTH_PASS` from the environment.
- Optional aliases already read by the login route, only when `SITE_AUTH_*` is unset: `NEXT_PUBLIC_STUDIO_USER` / `NEXT_PUBLIC_STUDIO_PASS`. Prefer `SITE_AUTH_*`. Do not put the password in `NEXT_PUBLIC_*` (those values can be exposed to the browser).
- If the env pair is missing, `/api/auth/login` **fails closed** (HTTP 503, `登录未配置`). Wrong credentials return HTTP 401. There is no built-in default password.
- The password lives only in the Vercel env for project `kb` and in Tang’s memory. Do **not** write it into source, comments, `.env.example`, docs, or commits.
- Session: httpOnly cookie `site_session` + `localStorage.studio_session`. Middleware also gates the site unless `SITE_AUTH_OFF=1` (that flag skips only the middleware wall; the login API still requires the env credentials).

## Design tokens

- Dark: `#0D0E0E` / `#161717` / text `#ECECE9` / accent `#E6CF98`
- Themes: 银黑 / 暖灰 / 新拟物 (`theme-silver|warm|neu`) — landing + workspace follow via `--pl-*` (light themes put plate assets in dark neumorphic wells).

## Interaction rules (do not break)

| Control | Behavior |
|--------|----------|
| Login | Required before landing; wrong creds show error |
| Landing enter / hub card | → workspace (or section) |
| Desktop/mobile **orb** (`data-testid=ws-orb-back`) | → neural landing (主体) |
| Hub / card first tap | select hub; second tap → open section |
| List row click | navigate to matching section + highlight (`studio-row-on`) + toast; workflow rows open **step detail** |
| Footer **步骤 N · title** pill (`step-pill`) | opens step detail modal |
| Board **可派发 / 打开步骤** CTA | opens step detail for workflow |
| Red traffic light | → landing (not logout) |
| Yellow / green | minimize / fullscreen (CSS fallback) |
| **退出** | logout → login |
| Window title | default `涛的个人工作台`; click / ✎ to edit; persist `localStorage.studio_window_title` |

## Content sources (real Tang data — never Xuan demo titles)

- `SKILLS`, `WORKFLOW_STEPS` (8 steps + `next`/`notes`), `PENDING_TICKETS`, `WORK_SLOTS`, `WS_HUBS`, `LANDING_NODES` in `studio/page.tsx`.

## Deploy

- Vercel project name: `kb`
- Production alias stays **https://kb-zeta-one.vercel.app** (studio at `/studio`)
- Set `SITE_AUTH_USER` and `SITE_AUTH_PASS` in that project’s environment. Never commit them.
- Do **not** change the existing vercel.app alias without Tang’s OK.

## China access (important)

- Tang in China **cannot open** `*.vercel.app` reliably.
- Project domains today: `kb-zeta-one.vercel.app` and `kb-wending1.vercel.app` — no custom domain and no CN CDN yet.
- This Next app uses API routes + middleware, so it is not a static GitHub Pages candidate without a separate worker/backend.
- **Recommended next steps (need Tang confirm, do not buy domains):**
  1. Bind a China-reachable custom domain Tang already owns (Vercel project domains); mainland ICP may be required.
  2. Or connect Cloudflare (Pages / proxy) with Tang’s account and mirror the same deployment.
  3. Optional: Vercel Beijing/Shanghai marketplace CDN if Tang’s team can enable it.
- Do **not** change the existing vercel.app alias.

## QA

Cover: login (missing env, bad credentials, good credentials), landing, orb→landing, hub select, list row→section, step pill/detail, board CTA, traffic lights, title edit, logout. Check desktop 1440×900 and mobile 390×844.

## Known gaps

- Desktop landing stats bar shorter than plate f525; orb glow slightly weaker than plate.
- Warm/neu shimmer faint; parallax desktop-only.
- Dense 20+ row list is tight; China URL not yet available.
- Step actions are local stubs (toast / navigate) — no real Feishu/Muse API yet.

## Local preview

```bash
git clone https://github.com/t1804496337-droid/kb
cd kb
npm install
# Export SITE_AUTH_USER and SITE_AUTH_PASS in the shell. Do not commit them.
npm run dev
```

`SITE_AUTH_OFF=1` skips the middleware redirect only. The studio page still shows its own login gate, and that gate calls `/api/auth/login`.

Continue polishing toward the plate. Keep the login gate, neural landing, and workspace intact.

## Studio behavior notes

- `+新建任务` appends a row under the **currently selected hub** (创作池/灵感池/作品库/数据库/日历表) and persists via `localStorage` key `studio_hub_rows_v1`.
- Production is served from Vercel project `kb` at https://kb-zeta-one.vercel.app/studio.
