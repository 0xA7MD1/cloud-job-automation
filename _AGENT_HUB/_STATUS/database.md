# database
آخر تحديث: 2026-10-29

## الحين
- Keep-alive: `/api/cron/keepalive` reads one row from `companies`, and Vercel Cron calls it every 5 days (`0 6 */5 * *` in `vercel.json`). InsForge was up on 2026-10-29. It does nothing until `CRON_SECRET` is set in Vercel and PR #2 is merged into `main`.

## يحتاجك
- Command · Add `CRON_SECRET` (a long random string) in Vercel → Settings → Environment Variables → Production. Without it the route returns 500 and never touches the database.
- Command · Merge https://github.com/0xA7MD1/cloud-job-automation/pull/2 into `main` after adding `CRON_SECRET`. Vercel runs crons only on the production deployment.
- Decision · Run it every 5 days or daily? InsForge pauses after a week without activity, so 5 days leaves little margin. **My pick: daily** (`0 6 * * *`), which costs nothing extra.
