import "server-only";
import type { Application, ApplicationStatus, Job, MonthlyApplyUsage } from "@/lib/db/types";
import { getInsForgeAdminClient } from "@/lib/insforge/admin";
import type { SessionClient } from "@/lib/chat/tools";
import { isSupportedAts } from "@/lib/jobs/ats";
import { TriggerNotConfiguredError, cancelRun, runEnvironment, triggerPrepare, triggerSubmit } from "@/lib/trigger/server";
import { readForm } from "./form";

// بدء الطلب وتجهيزه. تستخدمه صفحة الوظائف وأداة الشات (prepareApplication).
// المستخدم ينشئ صف الطلب بجلسته (RLS)، وتغيير الحالة بعميل الأدمن مع فلتر user_id.

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** حالات يقدر يبدأ منها تجهيز جديد (بشرط ما فيه محاولة إرسال) */
const PREPARABLE: ApplicationStatus[] = ["draft", "ready", "failed", "cancelled"];

export async function isOwnerAccount(insforge: SessionClient, userId: string): Promise<boolean> {
  const { data } = await insforge.database.from("entitlements").select("plan").eq("user_id", userId).maybeSingle();
  return (data as { plan?: string } | null)?.plan === "owner";
}

export function triggerErrorMessage(error: unknown): string {
  return error instanceof TriggerNotConfiguredError
    ? "الشغل الخلفي (Trigger.dev) مو مضبوط للحين: ناقص TRIGGER_SECRET_KEY."
    : "ما قدرنا نبدأ المهمة. جرّب بعد شوي.";
}

async function queuePrepare(
  insforge: SessionClient,
  app: Pick<Application, "id" | "user_id" | "status">,
): Promise<ServiceResult<{ id: string }>> {
  const admin = getInsForgeAdminClient();
  const { data: moved } = await admin.database
    .from("applications")
    .update({ status: "preparing", error: null, status_detail: null })
    .eq("id", app.id)
    .eq("user_id", app.user_id)
    .in("status", PREPARABLE)
    .is("submit_attempted_at", null)
    .select("id");
  if (!moved || (moved as unknown[]).length === 0) return { ok: true, data: { id: app.id } };

  if (app.status === "draft") {
    await admin.database.from("application_events").insert({ application_id: app.id, user_id: app.user_id, type: "created" });
  }
  try {
    const run = await triggerPrepare(await isOwnerAccount(insforge, app.user_id), app.id);
    await admin.database.from("applications").update({ trigger_run_id: run.id }).eq("id", app.id).eq("user_id", app.user_id);
    return { ok: true, data: { id: app.id } };
  } catch (error) {
    await admin.database
      .from("applications")
      // نرجّعه لحالته قبل، والمسودة تصير «فشل» عشان الخطأ يبان
      .update({ status: app.status === "draft" ? "failed" : app.status, error: triggerErrorMessage(error) })
      .eq("id", app.id)
      .eq("user_id", app.user_id);
    return { ok: false, error: triggerErrorMessage(error) };
  }
}

/** ينشئ الطلب (لو ما كان موجود) ويبدأ تجهيزه. يرجّع معرّف الطلب. */
export async function startApplication(
  insforge: SessionClient,
  userId: string,
  jobId: string,
): Promise<ServiceResult<{ id: string }>> {
  const { data: job } = await insforge.database.from("jobs").select("id, source, closed_at").eq("id", jobId).maybeSingle();
  const j = job as Pick<Job, "id" | "source" | "closed_at"> | null;
  if (!j) return { ok: false, error: "الوظيفة مو موجودة." };
  if (!isSupportedAts(j.source)) return { ok: false, error: "نقدر نقدّم تلقائيًا على Greenhouse وLever وAshby بس." };
  if (j.closed_at) return { ok: false, error: "الوظيفة انقفلت." };

  const { data: profile } = await insforge.database
    .from("profiles")
    .select("default_cv_file_id")
    .eq("user_id", userId)
    .maybeSingle();
  const cvId = (profile as { default_cv_file_id: string | null } | null)?.default_cv_file_id ?? null;
  if (!cvId) return { ok: false, error: "اختر سيرتك الافتراضية من «ملفي» أول (ارفعها من «ملفاتي»)." };

  // INSERT بس (ignoreDuplicates): ما يحتاج صلاحية UPDATE، ولو الطلب موجود يبقى كما هو
  await insforge.database
    .from("applications")
    .upsert({ user_id: userId, job_id: jobId, cv_file_id: cvId }, { onConflict: "user_id,job_id", ignoreDuplicates: true });
  const { data: existing } = await insforge.database
    .from("applications")
    .select("id, user_id, status, submit_attempted_at")
    .eq("user_id", userId)
    .eq("job_id", jobId)
    .maybeSingle();
  const app = existing as Pick<Application, "id" | "user_id" | "status" | "submit_attempted_at"> | null;
  if (!app) return { ok: false, error: "ما قدرنا ننشئ الطلب." };

  // طلب جاهز أو شغّال: نفتحه بس، بدون تجهيز جديد
  if (app.status !== "draft" && app.status !== "failed") return { ok: true, data: { id: app.id } };
  if (app.submit_attempted_at) return { ok: true, data: { id: app.id } };
  return queuePrepare(insforge, app);
}

/** «أعد التجهيز»: يجيب الأسئلة ويكتب الإجابات والخطاب من جديد (إجاباتك المعدّلة تبقى) */
export async function reprepareApplication(
  insforge: SessionClient,
  userId: string,
  applicationId: string,
): Promise<ServiceResult<{ id: string }>> {
  const { data } = await insforge.database
    .from("applications")
    .select("id, user_id, status, submit_attempted_at")
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  const app = data as Pick<Application, "id" | "user_id" | "status" | "submit_attempted_at"> | null;
  if (!app) return { ok: false, error: "الطلب مو موجود." };
  if (app.submit_attempted_at) return { ok: false, error: "انضغط «إرسال» في هذا الطلب: ما نعيد تجهيزه." };
  if (!PREPARABLE.includes(app.status)) return { ok: false, error: "الطلب شغّال الحين." };
  return queuePrepare(insforge, app);
}

/** وين يشتغل متصفح هذا المستخدم: جهاز المالك (محلي) أو Steel بمفتاحه */
export async function browserProviderFor(
  insforge: SessionClient,
  userId: string,
): Promise<{ provider: "local" | "steel"; owner: boolean } | { provider: null; owner: boolean; error: string }> {
  const owner = await isOwnerAccount(insforge, userId);
  if (owner && runEnvironment(true) === "owner-dev") return { provider: "local", owner };
  const { data } = await insforge.database
    .from("provider_keys")
    .select("status")
    .eq("user_id", userId)
    .eq("provider", "steel")
    .maybeSingle();
  const status = (data as { status?: string } | null)?.status;
  if (!status || status === "invalid") {
    return { provider: null, owner, error: "أضف مفتاح Steel من «المفاتيح» عشان نفتح متصفح ونقدّم عنك." };
  }
  return { provider: "steel", owner };
}

export async function monthlyUsage(insforge: SessionClient): Promise<MonthlyApplyUsage | null> {
  const { data } = await insforge.database.rpc("monthly_apply_usage");
  return ((Array.isArray(data) ? data[0] : data) as MonthlyApplyUsage | undefined) ?? null;
}

/**
 * «قدّم الحين» من صفحة المراجعة بعد تأكيد المستخدم. يتحقق من الحصة والملفات
 * والمزود، ثم يحط الطلب بالطابور ويشغّل مهمة الإرسال.
 */
export async function submitApplication(
  insforge: SessionClient,
  userId: string,
  applicationId: string,
): Promise<ServiceResult<{ id: string }>> {
  const { data } = await insforge.database
    .from("applications")
    .select("id, user_id, status, form, cv_file_id, submit_attempted_at")
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  const app = data as Pick<Application, "id" | "user_id" | "status" | "form" | "cv_file_id" | "submit_attempted_at"> | null;
  if (!app) return { ok: false, error: "الطلب مو موجود." };
  if (app.submit_attempted_at) return { ok: false, error: "انضغط «إرسال» في هذا الطلب قبل: ما نعيد الإرسال." };
  if (!["ready", "failed", "cancelled"].includes(app.status)) return { ok: false, error: "الطلب مو جاهز للإرسال." };
  if (!readForm(app.form)) return { ok: false, error: "جهّز الطلب أول." };
  if (!app.cv_file_id) return { ok: false, error: "اختر سيرة ذاتية للطلب." };

  const usage = await monthlyUsage(insforge);
  if (usage && usage.used >= usage.apply_limit) {
    return { ok: false, error: `وصلت حد هذا الشهر (${usage.apply_limit} تقديم). يتجدد أول الشهر.` };
  }
  const browser = await browserProviderFor(insforge, userId);
  if (!browser.provider) return { ok: false, error: browser.error };

  const admin = getInsForgeAdminClient();
  const { data: moved } = await admin.database
    .from("applications")
    .update({ status: "queued", browser_provider: browser.provider, error: null, status_detail: null })
    .eq("id", app.id)
    .eq("user_id", userId)
    .in("status", ["ready", "failed", "cancelled"])
    .is("submit_attempted_at", null)
    .select("id");
  if (!moved || (moved as unknown[]).length === 0) return { ok: false, error: "الطلب تغيّر: حدّث الصفحة." };
  await admin.database
    .from("application_events")
    .insert({ application_id: app.id, user_id: userId, type: "queued", data: { provider: browser.provider } });

  try {
    const run = await triggerSubmit(browser.owner, app.id, crypto.randomUUID());
    await admin.database.from("applications").update({ trigger_run_id: run.id }).eq("id", app.id).eq("user_id", userId);
    return { ok: true, data: { id: app.id } };
  } catch (error) {
    await admin.database
      .from("applications")
      .update({ status: "ready", error: triggerErrorMessage(error) })
      .eq("id", app.id)
      .eq("user_id", userId);
    return { ok: false, error: triggerErrorMessage(error) };
  }
}

/** يلغي طلب بالطابور أو شغّال. لو انضغط «إرسال» قبل الإلغاء ننبّه إن ممكن انرسل. */
export async function cancelApplication(
  insforge: SessionClient,
  userId: string,
  applicationId: string,
): Promise<ServiceResult<undefined>> {
  const { data } = await insforge.database
    .from("applications")
    .select("id, status, trigger_run_id, submit_attempted_at")
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  const app = data as Pick<Application, "id" | "status" | "trigger_run_id" | "submit_attempted_at"> | null;
  if (!app) return { ok: false, error: "الطلب مو موجود." };
  if (!["preparing", "queued", "running", "needs_user"].includes(app.status)) return { ok: false, error: "ما فيه شي شغّال نلغيه." };

  if (app.trigger_run_id) {
    try {
      await cancelRun(await isOwnerAccount(insforge, userId), app.trigger_run_id);
    } catch {
      // التشغيل خلص أو مو موجود: نكمل ونحدّث الحالة
    }
  }
  const admin = getInsForgeAdminClient();
  await admin.database
    .from("applications")
    .update({
      status: "cancelled",
      status_detail: app.submit_attempted_at ? "انلغى بعد محاولة الإرسال: ممكن الطلب انرسل، شيك بريدك." : null,
    })
    .eq("id", app.id)
    .eq("user_id", userId);
  await admin.database.from("application_events").insert({ application_id: app.id, user_id: userId, type: "cancelled" });
  return { ok: true, data: undefined };
}
