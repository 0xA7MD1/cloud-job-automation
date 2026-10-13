# automation — Bulk auto-apply, no stops for missing answers, wider job search

## Waiting on Ahmed
- [ ] 2026-10-11 · decision · AI key for batches. Groq free = 8,000 tokens/min. One application prep ≈ 6–7k tokens → about 1 per minute; a 40-job batch takes 40+ min and can hit the daily cap.
  1. A: keep Groq free (slow, may stop mid-batch)
  2. B: Groq Dev tier (same key, same model, pay as you go): https://console.groq.com/settings/billing
  3. C: OpenRouter key with credit
  **Recommendation: B** (nothing to change in the app).
- [ ] 2026-10-11 · decision · Steel captcha solving ($10 one-time deposit at Steel). Without it, a captcha in an unattended batch waits 10 min for you, then that job stops. **Recommendation: deposit**, then tick "فعّلت حل الكابتشا" on `/settings/keys`.
- [ ] 2026-10-11 · decision · Workable auto-apply adapter. Many Saudi companies hire on Workable (Foodics 26 open jobs, Mozn 17). We now list their jobs, but applying is manual ("قدّم من موقعهم"). **Recommendation: build it next** (same pattern as the Ashby/Lever adapters).
- [ ] 2026-10-11 · steps · Google Places key (only for "companies near me"):
  1. https://console.cloud.google.com → new project → enable billing (1,000 searches/month free, 20 companies each)
  2. APIs & Services → enable "Places API (New)"
  3. Credentials → Create API key → restrict it to "Places API (New)"
  4. `/settings/keys` → "شركات قريبة" → paste
- [ ] 2026-10-11 · check · Real batch test (after `pnpm seed:demo:clean` + real profile, see `apply-test.md`). Run `pnpm dev` + `pnpm trigger:dev`, then:
  1. `/chat` → "frontend engineer jobs, remote" (role search) or a company name
  2. `/jobs` → tick 2–3 jobs → "قدّم على المحدد" → confirm once
  3. `/applications` → "جارية" / "ينتظر جوابك"

## Handoff
**Done (uncommitted; `pnpm check` passes, 134 tests; `pnpm build` passes):**
1. AI answers (`src/lib/apply/ai.ts`): 4 question kinds; open questions always answered; optional "share X" left empty. 2nd pass `answerMissing` for required fields still empty. Live-tested on Replit form `ce0f7062`: 0 required missing (was 1).
2. Prepare: `needs_input` ("ينتظر جوابك") when a required answer is missing, never "ready". AI 429 → waits 30s/60s/120s in-run (`wait.for`; retries are off in dev).
3. Migrations (applied to InsForge): `20261010120000_needs-input-auto-submit.sql` (status + `applications.auto_submit`, server-only), `20261010130000_google-places-key.sql` (provider `google_places`).
4. `src/lib/apply/queue.ts`: `blockingMissing`, `claimForSubmit`, `queueAutoSubmit`. No browser while answers are missing. Unattended (auto) runs never hand a missing field to the user: stop before the click, no attempt. Captcha / email code after the click still wait.
5. Bulk apply: `/jobs` checkboxes + "حدّد الكل" + sticky bar (`jobs/_components/bulk-apply.tsx`) → `startBatch` (service.ts): max 50, quota check, one confirm. Saving answers (`refreshReadiness`) flips `needs_input` → `ready` and auto-queues batch members. Per-user concurrency (`concurrencyKey = user_id`): prepare 2, submit 3.
6. Search:
   1. `searchJobs` chat tool: role search across all Greenhouse / Lever / Ashby boards (Exa/Tavily `includeDomains`), up to 12 boards × 5 jobs. Live: 25 links → 25 companies.
   2. `searchOfficialJobs` falls back to the company's own careers page (`src/lib/jobs/discover.ts` + `careers.ts`): static fetch → Steel render if JS → AI extracts jobs → follows one "view openings" link. Workable links → public feed (`workable.ts`). Live: Foodics 26 jobs (2.6s), Mozn via Workable, Elm → "no clear jobs" (it lists categories only).
   3. `searchNearbyCompanies` chat tool: Google Places text search (`src/lib/search/places.ts`, stores `place_id` only) → `discover-company` Trigger task per company (`trigger/discover.ts`) → jobs linked to the user.
7. UI: `/applications` tab "ينتظر جوابك"; dashboard counts it; careers-page jobs show "قدّم من موقعهم" + email button; chat cards for the new tools; `/settings/keys` section "شركات قريبة".
8. `AGENTS.md`: stack rows (official jobs, nearby companies → first version), rules 3 / 8 / 10, structure line.

**Remaining (in order):**
1. Workable adapter (if approved).
2. Signed-in browser check of `/jobs` bulk bar, `/applications` new tab, chat cards (agent can't sign in).
3. Scheduled re-scan of careers-page companies (now only ATS boards are re-scanned twice a day; careers pages only on demand).
4. Commit when Ahmed asks.

**Need to know:**
1. Root cause of "Steel stopped, no captcha": required "What excites you about Replit?" had no answer (old prompt: "only facts, else empty") → old `runSubmission` handed the submit to the user.
2. Both Replit apps went out with the demo profile ("Faisal Al-Harbi (Demo)") + Ahmed's real email. Cleanup command is open in `apply-test.md`.
3. App `c3b0c106` stuck in `preparing` since 2026-10-10 15:10 UTC because `pnpm trigger:dev` was not running; it continues once the worker runs.
4. Local-Chrome batch: prepares run on the owner's PC too (`prepareOnOwnerPc`) so the submit they trigger lands in the same env. A local batch prepare that started in the cloud won't auto-submit (guard in `trigger/applications.ts`).
5. Careers-page jobs: `source = careers_page`; external id = sha256(company|link) or `workable:<code>`; `raw.applyEmail` when the page asks for CVs by email. Never auto-applied.
6. Careers reading uses the user's Steel key for JS pages (`steel.scrape`) and their AI key; both cost on the user's accounts.
7. `storeCompanyJobs` de-duplicates by external id (Workable repeats a job per location; upsert rejects duplicates).
8. Files also carrying other sessions' uncommitted edits: `service.ts`, `trigger/server.ts`, `applications/actions.ts`, `applications/[id]/page.tsx`, `submit-panel.tsx`, `tool-parts.tsx`, `job-tools.ts`, `prompt.ts`, `api/chat/route.ts` (only `maxDuration` 120 → 300), `AGENTS.md`.
