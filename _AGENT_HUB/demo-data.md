# demo-data — Fake data to try the site

## Waiting on Ahmed
- [ ] 2026-10-09 · check · Open the site in your own browser (already signed in) and walk the pages:
  1. `/dashboard` (quota 3/500, 1 waiting, 4 to review, 1 sent)
  2. `/jobs` (3 tabs + 3 followed companies)
  3. `/applications` → open each one (8 apps, one per status)
  4. `/chat` (2 chats)
  5. `/files` (CV, 5 cover letters, 1 confirmation image)
  6. `/profile`
- [ ] 2026-10-09 · command · Before any REAL application, delete the fake data (the fake profile would fill real forms):

```bash
pnpm seed:demo:clean
```

## Handoff
**Done:**
1. `scripts/seed-demo.mjs` + `pnpm seed:demo` / `pnpm seed:demo:clean`. Re-running resets the data.
2. Seeded into `mrsftls@gmail.com`: 6 companies, 15 jobs, 8 applications (ready ×2, needs_user, submitted, failed ×2, cancelled, draft), 30 events, 7 files, 2 chats, fake profile.
3. Checked: every app passes `readForm` / `missingRequired`, all 7 files download, quota = 3/500.
4. Fixed in `src/lib/apply/documents.ts`: name overlapped the email line in every cover letter PDF.

**Remaining:**
1. Nothing seen in the browser yet (browser pane isn't signed in; Google sign-in is Ahmed's).
2. Arabic cover letter PDF: text layer garbled + `٪` missing → separate task chip "Fix Arabic cover letter PDF text layer".
3. Not committed (another agent has uncommitted work in `package.json` and other files).

**Need to know:**
1. Safety: companies use `.example` domains, apply URLs use `example.com` → pressing submit on fake data fails at "open", nothing is sent.
2. Fake rows use fixed IDs `de7e00xx-...`; cleanup deletes only those (+ apps created later on fake jobs).
3. Fake profile name ends with `(Demo)`. Seed never overwrites a real profile; cleanup deletes only the `(Demo)` one.
4. Prepare/submit on fake jobs = safe way to test the Trigger.dev pipeline (it should fail cleanly).
5. Chat replies need real keys (Groq + Tavily) in `/settings/keys`; old fake chats display without keys.
