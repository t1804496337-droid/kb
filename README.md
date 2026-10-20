# kb

Tang’s personal studio site (Next.js App Router).

- Clone: https://github.com/tang995719-blip/kb
- Live studio: https://kb-zeta-one.vercel.app/studio
- Vercel project name: `kb`

## Run locally

```bash
git clone https://github.com/tang995719-blip/kb
cd kb
npm install
```

Login reads credentials from the environment only:

- `SITE_AUTH_USER`
- `SITE_AUTH_PASS`

Optional aliases already supported by `src/app/api/auth/login/route.ts`: `NEXT_PUBLIC_STUDIO_USER` and `NEXT_PUBLIC_STUDIO_PASS`. Prefer `SITE_AUTH_*`, because `NEXT_PUBLIC_*` values can be exposed to the browser.

If either required value is missing, `/api/auth/login` rejects the request (fail closed). This repo has no default password. The password lives only in the Vercel env for project `kb` and in Tang’s memory. Do not write it into source, comments, `.env.example`, or docs.

Copy `.env.example` for the variable names, then export the two values in your shell or in Vercel. `SITE_AUTH_OFF=1` skips only the middleware redirect for local preview; the studio login API still requires the env credentials.

```bash
npm run dev
```

Open http://localhost:3000. A visit without a session redirects to `/login`. `/studio` is the neural studio: login gate, then neural landing, then workspace.

## Routes

| Path | What |
|------|------|
| `/login` | Site login |
| `/studio` | Studio: login gate, neural landing, workspace |
| `/` | Dashboard shell |
| `/kb` | Knowledge base |
| `/workflows` | Workflows |
| `/tickets` | Tickets |
| `/tools` | Tools |

## For other agents

Clone https://github.com/tang995719-blip/kb, then read `docs/studio-handoff-prompt.md` before editing the studio. Chinese handoff: `docs/studio-给其他AI交接.md`. Also read `AGENTS.md`. Keep the login gate, neural landing, and workspace behavior. Never commit the studio password.
