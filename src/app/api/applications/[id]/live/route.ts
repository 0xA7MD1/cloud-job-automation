import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { liveSessionId, steelLiveViewUrl } from "@/lib/browser";
import { getProviderSecret } from "@/lib/byok/store";
import type { Application } from "@/lib/db/types";
import { createInsForgeServerClient } from "@/lib/insforge/server";

// رابط البث الحي لجلسة Steel (قاعدة 4): بدون توثيق عند Steel، فيوصل لصاحب
// الطلب بس من هنا، وما ينحفظ في القاعدة ولا ينكتب في أي سجل.

const NO_STORE = { "Cache-Control": "no-store, private" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "not found" }, { status: 404, headers: NO_STORE });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });

  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database
    .from("applications")
    .select("id, status, browser_provider, trigger_run_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  const app = data as Pick<Application, "id" | "status" | "browser_provider" | "trigger_run_id"> | null;
  if (!app || app.browser_provider !== "steel" || !app.trigger_run_id || !["running", "needs_user"].includes(app.status)) {
    return NextResponse.json({ error: "no live session" }, { status: 404, headers: NO_STORE });
  }

  const steel = await getProviderSecret(user.id, "steel");
  if (!steel) return NextResponse.json({ error: "no live session" }, { status: 404, headers: NO_STORE });

  const url = await steelLiveViewUrl(steel.apiKey, liveSessionId(app.id, app.trigger_run_id));
  if (!url) return NextResponse.json({ error: "no live session" }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ url }, { headers: NO_STORE });
}
