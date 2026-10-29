# database
آخر تحديث: 2026-10-29

## الحين
- Keep-alive: `/api/cron/keepalive` reads one row from `companies`, and Vercel Cron calls it every 5 days (`0 6 */5 * *` in `vercel.json`). InsForge was up on 2026-10-29. It does nothing until `CRON_SECRET` is set in Vercel and the commit reaches the production branch.

## يحتاجك
- Command · Add `CRON_SECRET` (a long random string) in Vercel → Settings → Environment Variables → Production. Without it the route returns 500 and never touches the database.
- Command · Vercel runs crons only on the production deployment, so `git push origin dev` and merge into the production branch before this protects anything.
- Decision · Run it every 5 days or daily? InsForge pauses after a week without activity, so 5 days leaves little margin. **My pick: daily** (`0 6 * * *`), which costs nothing extra.
