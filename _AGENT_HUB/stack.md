# stack — Job-apply bot

**Status:** all 9 build steps are done and committed.
**Missing:** your accounts and keys. Nothing has run against real services yet.

---

## Waiting on Ahmed (do in this order)

### 1. Accounts  `[blocker]`
- [ ] Create an **InsForge** project. Copy the 3 values into `.env.local`:
  - `NEXT_PUBLIC_INSFORGE_URL`
  - `NEXT_PUBLIC_INSFORGE_ANON_KEY`
  - `INSFORGE_API_KEY`
- [ ] Create a **Trigger.dev** project. Copy into `.env.local`:
  - `TRIGGER_PROJECT_REF` (starts with `proj_`)
  - `TRIGGER_SECRET_KEY` (use the **dev** key, starts with `tr_dev_`)
- [ ] Start from `.env.example`:

```bash
cp .env.example .env.local
```

### 2. Encryption key
- [ ] Run this, paste the output into `.env.local` as `BYOK_MASTER_KEY`.
- (Never paste it in chat. If lost, all saved user keys become unreadable.)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Database + storage
- [ ] Log in and link this folder:

```bash
npx @insforge/cli login
```

```bash
npx @insforge/cli link --project-id <project-id>
```

- [ ] Apply the schema (4 files in `migrations/`):

```bash
npx @insforge/cli db migrations up --all
```

- [ ] Create the private file bucket:

```bash
npx @insforge/cli storage create-bucket user-files --private
```

### 4. Sign-in providers (InsForge dashboard → Authentication)
- [ ] Turn on **Google** and **Microsoft**.
- [ ] Add these 3 redirect URLs:
  - `http://localhost:3000/api/auth/callback`
  - `http://localhost:3000/sign-in`
  - `http://localhost:3000/reset-password`

### 5. Run it on your PC (2 terminals)
- [ ] Trigger.dev login (once):

```bash
npx trigger.dev@latest login
```

- [ ] Terminal 1:

```bash
pnpm dev
```

- [ ] Terminal 2 (keep it running: your applications run here, free):

```bash
pnpm trigger:dev
```

### 6. Make your account the owner (once, after you sign up in the app)
- [ ] Replace `<your-email>` and run:

```bash
npx @insforge/cli db query "insert into public.entitlements (user_id, plan, monthly_apply_limit) select id, 'owner', 500 from auth.users where email = '<your-email>' on conflict (user_id) do update set plan = 'owner'"
```

- (Owner = your applications use Chrome on your PC. Free, no Steel.)

### 7. First test (open `http://localhost:3000`, pages in order)
1. `/sign-up` → create your account.
2. `/files` → upload your CV.
3. `/profile` → choose it as default CV + fill details, answer bank, target roles.
4. `/settings/keys` → add a free Groq key + a free Tavily key.
5. `/chat` → type `fintech companies in Riyadh` → open one company's official jobs.
6. `/jobs` → press the prepare button on one job.
7. `/applications` → open it → review answers + cover letter (PDF / Word).
8. Pick a job you really want → press submit → confirm → watch the Chrome window.
9. If it stops (captcha / email code / missing field): finish it in that window. It continues by itself.

### 8. Go online (later, when you want it on the internet)
- [ ] Tell the agent your InsForge region (it writes `vercel.json` with the same region).
- [ ] Vercel → Environment Variables:
  - `NEXT_PUBLIC_APP_URL` (your Vercel URL)
  - `NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY`, `INSFORGE_API_KEY`
  - `BYOK_MASTER_KEY` (same value as local)
  - `TRIGGER_SECRET_KEY` (the **prod** key `tr_prod_...`)
  - `TRIGGER_OWNER_SECRET_KEY` (the **dev** key `tr_dev_...` → your applications still run on your PC)
- [ ] Trigger.dev dashboard → Production env vars: `NEXT_PUBLIC_INSFORGE_URL`, `INSFORGE_API_KEY`, `BYOK_MASTER_KEY`
- [ ] Deploy the background tasks:

```bash
pnpm trigger:deploy
```

- [ ] InsForge redirect URLs: add the same 3 paths with your Vercel domain.

---

## Open decision
- [ ] **Backup browser** (for sites that block Steel): Browser Use or Browserbase?
  - **Recommendation: Browser Use** (Browserbase needs $20/month per user for captcha + stealth).
  - Not urgent. Nothing is blocked by it.

## Closed decisions
- [x] Free 500/month for owner → local Chrome via `pnpm trigger:dev` (2026-10-09)
- [x] Build steps 4–6, then 7–9 → done (2026-10-09)
- [x] Services split only when worth it: InsForge (DB/auth/files) + Trigger.dev (background) (2026-10-09)
- [x] Files in InsForge Storage, not R2 (2026-10-09)
- [x] Cloud browser for users: Steel (2026-10-09)
- [x] Hub file in English, short points only (2026-10-09)

---

## Notes for the next agent
- **Done:** steps 1–9 (commits `df5a74a` … `a2041e5`). 100 tests + `pnpm build` pass.
- **Verified live (no real submit):** form filling on real Greenhouse (Discord), Lever (Palantir), Ashby (Notion) with fake data, `skipFiles: true`, submit never clicked. Arabic PDF shaping/RTL checked visually.
- **Not verified:** anything needing InsForge / Trigger.dev / Steel / AI keys; a real submission.
- **Next:** help Ahmed through the list above, then fix what the first real run shows.
- **Traps:**
  - Next 16 `cacheComponents`: `cookies()` / `params` / `searchParams` / `usePathname()` only inside `<Suspense>`. Run `pnpm build` after any new page.
  - Greenhouse hydrates late and wipes typed values → adapters call `settle()` and re-check every field.
  - Never retry a submit. `submit_attempted_at` is set atomically before the click (quota counts it).
  - Steel live URL: only via `/api/applications/[id]/live`, never stored or logged. Session id = `liveSessionId(appId, runId)`.
  - Ashby questions come from an undocumented GraphQL → falls back to basic fields if it changes.
  - `trigger.config.ts`: `playwright-core` and `@react-pdf/renderer` are external; fonts copied by `additionalFiles`.
  - Every `fetch` has a timeout; unread bodies → `discardBody()`.
  - Do not run `python` on this machine (Windows Store stub hangs).
  - Adapter changes: test on a real form with fake data, `skipFiles: true`, no `submit()`.
