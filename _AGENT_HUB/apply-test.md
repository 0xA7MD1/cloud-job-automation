# apply-test — Make real applications work (job links, demo data, browser choice)

## Waiting on Ahmed
- [ ] 2026-10-10 · command · Delete the fake data before any real application. Your profile is the fake "Faisal Al-Harbi (Demo)" and its CV is your default, so a real form would get the fake person.

```bash
pnpm seed:demo:clean
```

- [ ] 2026-10-10 · steps · After the cleanup:
  1. `/files` → upload your real CV
  2. `/profile` → fill your details + pick that CV as default
  3. `/chat` → paste the job link → open the application → review
  4. Pick the browser: "Chrome on your PC" or "Steel" → submit
- [x] 2026-10-10 · decision · Test Steel too? → **Both, owner picks per application** (Ahmed in chat, 2026-10-10)

## Handoff
**Done:**
1. Chat tool `addJobFromUrl` + `parseJobUrl` (`src/lib/jobs/url.ts`): Greenhouse / Lever / Ashby job links, and company links with `gh_jid` / `ashby_jid`. Live-tested on the real Replit link.
2. Owner picks the browser on the application page (`submit-panel.tsx`): local Chrome or Steel. Other users: Steel only.
3. Run routing (`runsOnOwnerPc` in `src/lib/apply/service.ts`): only owner + local Chrome submits run on Ahmed's PC. Prepare, cover letter, Steel submits → normal environment (production works with his PC off).
4. Steel smoke test with Ahmed's key: session opened, real Replit apply form loaded (34 inputs), session released. No fill, no submit.
5. `AGENTS.md`: business direction section + owner browser choice.
6. `pnpm check` passes (119 tests).

**Remaining:**
1. Application page and chat card not seen in the browser (pane not signed in).
2. No full Steel submit yet (needs Ahmed's real profile first).
3. Not committed (working tree shared with the demo-data session).

**Need to know:**
1. Old bug: the model passed the Ashby id from the URL as `jobId` → "job not found".
2. Ahmed's Steel key is saved and valid. Captcha solving is off (needs a $10 deposit at Steel) → captchas go to the live view.
3. A company added from a link has no domain. If search later finds it by domain, `ensureCompanyAts` cannot save (ats, slug) (unique). Still works, but its jobs' `company_id` flips between the 2 rows.
4. EU boards (`jobs.eu.lever.co`, `job-boards.eu.greenhouse.io`) not supported.
5. Prepare runs that started before this change ran on the owner's dev env. Locally both keys point to dev, so no effect.
