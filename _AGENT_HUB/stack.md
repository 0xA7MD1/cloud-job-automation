# stack — Job-apply bot

**Status:** runs locally. InsForge + Trigger.dev connected. Your account (`mrsftls@gmail.com`) is **owner** → applications use Chrome on your PC, free.

---

## Waiting on Ahmed

### 1. First real test
Keep both running: the app (`pnpm dev`) and the worker tab (`pnpm trigger:dev`). Open `http://localhost:3000`:
1. `/files` → upload your CV.
2. `/profile` → pick it as default CV + fill details, answer bank, target roles.
3. `/settings/keys` → add a free Groq key + a free Tavily key.
4. `/chat` → type `fintech companies in Riyadh` → open one company's official jobs.
5. `/jobs` → press prepare on one job.
6. `/applications` → open it → review answers + cover letter (PDF / Word).
7. Pick a job you really want → submit → confirm → watch the Chrome window.
8. If it stops (captcha / email code / missing field): finish it in that window. It continues by itself.

### 2. Microsoft sign-in (optional — Google already works)
- [ ] InsForge dashboard → Authentication → Microsoft → paste an Azure app client ID + secret.

### 3. Go online (later)
- [ ] Vercel → Environment Variables:
  - `NEXT_PUBLIC_APP_URL` (your Vercel URL)
  - `NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY`, `INSFORGE_API_KEY` (same as `.env.local`)
  - `BYOK_MASTER_KEY` (same as `.env.local`)
  - `TRIGGER_SECRET_KEY` (the **prod** key `tr_prod_...`)
  - `TRIGGER_OWNER_SECRET_KEY` (the **dev** key `tr_dev_...`)
- [ ] Trigger.dev dashboard → Production env vars: `NEXT_PUBLIC_INSFORGE_URL`, `INSFORGE_API_KEY`, `BYOK_MASTER_KEY`
- [ ] Deploy the background tasks:

```bash
pnpm trigger:deploy
```

- [ ] Tell the agent your Vercel domain → it adds the 3 redirect URLs to `insforge.toml` and applies them.

---

## Open decision
- [ ] **Backup browser** (for sites that block Steel): Browser Use or Browserbase?
  - **Recommendation: Browser Use** (Browserbase needs $20/month per user for captcha + stealth).
  - Not urgent.

## Closed decisions
- [x] InsForge setup, schema, bucket, redirect URLs, `.env.local` → done by agent (2026-10-09)
- [x] Trigger.dev MCP install prompt → skipped (install later: `npx trigger.dev@latest install-mcp`) (2026-10-09)
- [x] Free 500/month for owner → local Chrome via `pnpm trigger:dev` (2026-10-09)
- [x] Services split only when worth it: InsForge (DB/auth/files) + Trigger.dev (background) (2026-10-09)
- [x] Files in InsForge Storage, not R2 (2026-10-09)
- [x] Cloud browser for users: Steel (2026-10-09)
- [x] Hub file in English, short points only (2026-10-09)

---

## Notes for the next agent
- **Done:** steps 1–9 + live setup. InsForge project `cloud job automation` (`eu-central-1`), linked via `.insforge/project.json` (gitignored). 4 migrations applied, bucket `user-files` (private), redirect URLs for localhost. Trigger.dev project `intlaq` (`proj_jekceuvuczxgxkpwgqya`), worker `20261009.1` registered. `pnpm check` passes (100 tests).
- **Verified live:** Google sign-in → dashboard and all app pages render (Ahmed's own session). Admin key reads tables; anon key is refused.
- **Not verified:** chat/search with real AI keys, prepare, a real submission.
- **Another session** is adding `scripts/seed-demo.mjs` (+ `seed:demo` scripts in `package.json`): fake data in the same InsForge project. Not part of this task's commits.
- **Traps:**
  - Fresh InsForge projects ship `storage.objects` with RLS **off** and full grants to `authenticated`. Storage migration enables it; never drop that line.
  - `migrations/` must hold only `.sql` files, or `db migrations up --all` refuses to run. Schema test lives in `src/lib/db/schema.test.ts`.
  - InsForge SDK calls `Date.now()` in `auth.getCurrentUser()` → `getCurrentUser` awaits `connection()` first (`partialPrefetching` is on). Same fix for any new session read outside it.
  - `trigger dev --skip-mcp-install` is broken in 4.7.3 (reads `skipMCPInstall`, parser gives `skipMcpInstall`). The prompt is already marked seen on this PC.
  - ESLint ignores `.trigger/**` (worker bundles).
  - Next 16 `cacheComponents`: `cookies()` / `params` / `searchParams` / `usePathname()` only inside `<Suspense>`. Run `pnpm build` after any new page (stop `pnpm dev` first).
  - Greenhouse hydrates late and wipes typed values → adapters call `settle()` and re-check every field.
  - Never retry a submit. `submit_attempted_at` is set atomically before the click (quota counts it).
  - Steel live URL: only via `/api/applications/[id]/live`, never stored or logged.
  - Ashby questions come from an undocumented GraphQL → falls back to basic fields if it changes.
  - Every `fetch` has a timeout; unread bodies → `discardBody()`.
  - Do not run `python` on this machine (Windows Store stub hangs).
  - Adapter changes: test on a real form with fake data, `skipFiles: true`, no `submit()`.
