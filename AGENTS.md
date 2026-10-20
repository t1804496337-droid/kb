<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Studio repo (public handoff)

- Clone: https://github.com/t1804496337-droid/kb
- This repository is public.
- Live studio: https://kb-zeta-one.vercel.app/studio
- Vercel project name: `kb`
- Auth: set `SITE_AUTH_USER` and `SITE_AUTH_PASS` in the environment (Vercel env for production). The login route also accepts `NEXT_PUBLIC_STUDIO_USER` / `NEXT_PUBLIC_STUDIO_PASS` only when `SITE_AUTH_*` is unset. Prefer `SITE_AUTH_*`.
- If those variables are missing, login fails closed. Do not add a default password or write the real password into source, comments, `.env.example`, or docs.
- The password lives only in the Vercel env for project `kb` and in Tang’s memory.
- Product notes: `docs/studio-handoff-prompt.md` (English) and `docs/studio-给其他AI交接.md` (中文). Clone https://github.com/t1804496337-droid/kb and read the English handoff before editing.
