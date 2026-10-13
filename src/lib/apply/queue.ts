import type { BrowserProviderId } from "@/lib/browser";
import type { Application, ApplicationStatus, MonthlyApplyUsage } from "@/lib/db/types";
import { getInsForgeAdminClient } from "@/lib/insforge/admin";
import { missingRequired, readForm, readStoredAnswers, type FormField } from "./form";

// حجز الطلب للإرسال، مشترك بين «قدّم الحين» (Vercel) والتقديم التلقائي بعد التجهيز (Trigger.dev).
// بدون "server-only" لأن مهام Trigger.dev تستورده. كل الكتابة بعميل الأدمن وبفلتر user_id صريح.

/** حالات يبدأ منها إرسال (بشرط ما فيه محاولة إرسال قبل: قاعدة 7) */
export const SUBMITTABLE: ApplicationStatus[] = ["ready", "needs_input", "failed", "cancelled"];

/** دفعة واحدة: حد معقول لتأكيد واحد ولحصة المزودين المجانية */
export const MAX_BATCH = 50;

/**
 * أسئلة مطلوبة بدون إجابة يقدر المستخدم يجاوبها من صفحة الطلب. ما نفتح متصفح وهي ناقصة:
 * التقديم يوقف عندها وينتظره. ملف «ثاني» مطلوب (شهادة، أعمال) ما يوقف: ما نقدر نرفعه، فيكمّله في المتصفح.
 */
export function blockingMissing(
  app: Pick<Application, "form" | "answers" | "cv_file_id" | "cover_letter_file_id">,
): FormField[] {
  const form = readForm(app.form);
  if (!form) return [];
  return missingRequired(form, readStoredAnswers(app.answers), {
    cv: !!app.cv_file_id,
    coverLetter: !!app.cover_letter_file_id,
  }).filter((f) => !(f.type === "file" && f.file === "other"));
}

/** وصف قصير للناقص («ينتظر جوابك على …») */
export function missingDetail(missing: readonly FormField[]): string {
  const names = missing
    .slice(0, 3)
    .map((f) => f.label || f.key)
    .join("، ");
  const count = missing.length === 1 ? "سؤال مطلوب" : `${missing.length} أسئلة مطلوبة`;
  return `ينتظر جوابك على ${count}: ${names}${missing.length > 3 ? "…" : ""}`;
}

export async function quotaLeft(userId: string): Promise<number> {
  const { data } = await getInsForgeAdminClient().database.rpc("monthly_apply_usage", { p_user_id: userId });
  const usage = (Array.isArray(data) ? data[0] : data) as MonthlyApplyUsage | undefined;
  return usage ? Math.max(0, usage.apply_limit - usage.used) : 0;
}

/** يحجز الطلب للإرسال (queued). false = حالته تغيّرت أو انضغط «إرسال» قبل. */
export async function claimForSubmit(
  app: Pick<Application, "id" | "user_id">,
  provider: BrowserProviderId,
  options: { from?: ApplicationStatus[]; auto?: boolean } = {},
): Promise<boolean> {
  const admin = getInsForgeAdminClient();
  const { data: moved } = await admin.database
    .from("applications")
    .update({ status: "queued", browser_provider: provider, error: null, status_detail: null })
    .eq("id", app.id)
    .eq("user_id", app.user_id)
    .in("status", options.from ?? SUBMITTABLE)
    .is("submit_attempted_at", null)
    .select("id");
  if (!moved || (moved as unknown[]).length === 0) return false;
  await admin.database
    .from("application_events")
    .insert({ application_id: app.id, user_id: app.user_id, type: "queued", data: { provider, auto: !!options.auto } });
  return true;
}

/** تشغيل الإرسال ما بدأ: نرجّع الطلب جاهز مع السبب */
export async function releaseClaim(app: Pick<Application, "id" | "user_id">, error: string): Promise<void> {
  await getInsForgeAdminClient()
    .database.from("applications")
    .update({ status: "ready", error })
    .eq("id", app.id)
    .eq("user_id", app.user_id)
    .eq("status", "queued");
}

export type AutoQueueResult = "queued" | "not_auto" | "not_ready" | "incomplete_form" | "quota" | "changed";

/**
 * طلب من دفعة تلقائية (auto_submit) صار جاهز: نحطه بالطابور ونشغّل الإرسال بدون ضغطة ثانية
 * (المستخدم أكّد الدفعة من الواجهة: قاعدة 8). نموذج ما قرينا كل أسئلته ما ينرسل تلقائيًا.
 */
export async function queueAutoSubmit(
  app: Pick<Application, "id" | "user_id" | "auto_submit" | "browser_provider" | "form" | "answers" | "cv_file_id" | "cover_letter_file_id">,
  start: (provider: BrowserProviderId) => Promise<{ id: string }>,
): Promise<AutoQueueResult> {
  if (!app.auto_submit) return "not_auto";
  const provider: BrowserProviderId | null =
    app.browser_provider === "local" || app.browser_provider === "steel" ? app.browser_provider : null;
  if (!provider || blockingMissing(app).length > 0) return "not_ready";

  const admin = getInsForgeAdminClient();
  const note = async (detail: string) => {
    await admin.database
      .from("applications")
      .update({ status_detail: detail })
      .eq("id", app.id)
      .eq("user_id", app.user_id)
      .eq("status", "ready");
  };
  if (!readForm(app.form)?.complete) {
    await note("ما قدرنا نقرأ كل أسئلة النموذج مسبقًا، فما قدّمنا تلقائيًا: راجعه واضغط «قدّم الحين».");
    return "incomplete_form";
  }
  if ((await quotaLeft(app.user_id)) <= 0) {
    await note("وصلت حد التقديم هذا الشهر: ما قدّمنا تلقائيًا.");
    return "quota";
  }
  if (!(await claimForSubmit(app, provider, { from: ["ready"], auto: true }))) return "changed";

  try {
    const run = await start(provider);
    await admin.database.from("applications").update({ trigger_run_id: run.id }).eq("id", app.id).eq("user_id", app.user_id);
    return "queued";
  } catch {
    await releaseClaim(app, "ما قدرنا نبدأ التقديم التلقائي. اضغط «قدّم الحين».");
    return "changed";
  }
}
