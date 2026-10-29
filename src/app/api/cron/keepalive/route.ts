import type { NextRequest } from "next/server";
import { readEnv } from "@/lib/env";
import { getInsForgeAdminClient } from "@/lib/insforge/admin";

/**
 * Keeps the InsForge free project from pausing.
 *
 * InsForge pauses a free project after a week without activity. Vercel Cron
 * calls this every 5 days (`vercel.json`), so the database never sits idle
 * that long, even before the Trigger.dev schedule is deployed.
 *
 * It reads a real table rather than a health endpoint, so the database itself
 * does work. Reading the Authorization header keeps the route dynamic under
 * Cache Components, so it is never prerendered.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` when that variable is set.
 */
export async function GET(request: NextRequest) {
  const secret = readEnv("CRON_SECRET");
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await getInsForgeAdminClient().database.from("companies").select("id").limit(1);
  if (error) {
    console.error("[keepalive] database read failed", error.message);
    return Response.json({ ok: false }, { status: 503 });
  }
  return Response.json({ ok: true, rows: data?.length ?? 0, at: new Date().toISOString() });
}
