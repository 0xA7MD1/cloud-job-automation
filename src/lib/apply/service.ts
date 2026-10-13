import "server-only";
import type { BrowserProviderId } from "@/lib/browser";
import type { Application, ApplicationStatus, Job, MonthlyApplyUsage } from "@/lib/db/types";
import { getInsForgeAdminClient } from "@/lib/insforge/admin";
import type { SessionClient } from "@/lib/chat/tools";
import { isSupportedAts } from "@/lib/jobs/ats";
import { TriggerNotConfiguredError, cancelRun, ownerPcAvailable, triggerPrepare, triggerSubmit } from "@/lib/trigger/server";
import { readForm } from "./form";
import {
  MAX_BATCH,
  SUBMITTABLE,
  blockingMissing,
  claimForSubmit,
  missingDetail,
  queueAutoSubmit,
  releaseClaim,
} from "./queue";

// بدء الطلب وتجهيزه. تستخدمه صفحة الوظائف وأداة الشات (prepareApplication).
// المستخدم ينشئ صف الطلب بجلسته (RLS)، وتغيير الحالة بعميل الأدمن مع فلتر user_id.

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** حالات يقدر يبدأ منها تجهيز جديد (بشرط ما فيه محاولة إرسال) */
const PREPARABLE: ApplicationStatus[] = ["draft", "needs_input", "ready", "failed", "cancelled"];

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
  app: Pick<Application, "id" | "user_id" | "status">,
  ownerPc = false,
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
    const run = await triggerPrepare(app.id, app.user_id, ownerPc);
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
  return queuePrepare(app);
}

/** «أعد التجهيز»: يجيب الأسئلة ويكتب الإجابات والخطاب من جديد (إجاباتك المعدّلة تبقى) */
export async function reprepareApplication(
  insforge: SessionClient,
  userId: string,
  applicationId: string,
): Promise<ServiceResult<{ id: string }>> {
  const { data } = await insforge.database
    .from("applications")
    .select("id, user_id, status, submit_attempted_at, auto_submit, browser_provider")
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  const app = data as Pick<
    Application,
    "id" | "user_id" | "status" | "submit_attempted_at" | "auto_submit" | "browser_provider"
  > | null;
  if (!app) return { ok: false, error: "الطلب مو موجود." };
  if (app.submit_attempted_at) return { ok: false, error: "انضغط «إرسال» في هذا الطلب: ما نعيد تجهيزه." };
  if (!PREPARABLE.includes(app.status)) return { ok: false, error: "الطلب شغّال الحين." };
  return queuePrepare(app, prepareOnOwnerPc(await isOwnerAccount(insforge, userId), app));
}

export interface BrowserChoice {
  owner: boolean;
  /** المتصفحات المتاحة لهذا المستخدم. الأول هو الافتراضي */
  providers: BrowserProviderId[];
  /** ليش Steel مو متاح (null لو متاح) */
  steelMissing: string | null;
}

/** وين نقدر نفتح المتصفح: المالك Chrome على جهازه، وأي مستخدم Steel بمفتاحه */
export async function browserChoiceFor(insforge: SessionClient, userId: string): Promise<BrowserChoice> {
  const owner = await isOwnerAccount(insforge, userId);
  const providers: BrowserProviderId[] = owner && ownerPcAvailable() ? ["local"] : [];
  const { data } = await insforge.database
    .from("provider_keys")
    .select("status")
    .eq("user_id", userId)
    .eq("provider", "steel")
    .maybeSingle();
  const status = (data as { status?: string } | null)?.status;
  const steelReady = !!status && status !== "invalid";
  if (steelReady) providers.push("steel");
  return {
    owner,
    providers,
    steelMissing: steelReady ? null : "أضف مفتاح Steel من «المفاتيح» عشان نفتح متصفح سحابي ونقدّم عنك.",
  };
}

/**
 * التجهيز على جهاز المالك؟ بس في دفعة تلقائية بـChrome المحلي: الإرسال يطلقه التجهيز نفسه،
 * فلازم يكون في نفس البيئة. غيرها على البيئة العادية (browser_provider يبقى من آخر إرسال).
 */
function prepareOnOwnerPc(owner: boolean, app: Partial<Pick<Application, "browser_provider" | "auto_submit">>): boolean {
  return owner && !!app.auto_submit && app.browser_provider === "local";
}

/** التشغيل الحالي للطلب على جهاز المالك؟ الإرسال بـChrome المحلي، وتجهيز دفعته التلقائية */
export function runsOnOwnerPc(
  owner: boolean,
  app: Pick<Application, "status" | "browser_provider"> & Partial<Pick<Application, "auto_submit">>,
): boolean {
  if (app.status === "preparing") return prepareOnOwnerPc(owner, app);
  return owner && app.browser_provider === "local";
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
  requested?: BrowserProviderId,
): Promise<ServiceResult<{ id: string }>> {
  const { data } = await insforge.database
    .from("applications")
    .select("id, user_id, status, form, answers, cv_file_id, cover_letter_file_id, submit_attempted_at")
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  const app = data as Pick<
    Application,
    "id" | "user_id" | "status" | "form" | "answers" | "cv_file_id" | "cover_letter_file_id" | "submit_attempted_at"
  > | null;
  if (!app) return { ok: false, error: "الطلب مو موجود." };
  if (app.submit_attempted_at) return { ok: false, error: "انضغط «إرسال» في هذا الطلب قبل: ما نعيد الإرسال." };
  if (!SUBMITTABLE.includes(app.status)) return { ok: false, error: "الطلب مو جاهز للإرسال." };
  if (!readForm(app.form)) return { ok: false, error: "جهّز الطلب أول." };
  if (!app.cv_file_id) return { ok: false, error: "اختر سيرة ذاتية للطلب." };
  // ما نفتح متصفح ونوقف ننتظرك على سؤال: جاوبه هنا أول
  const missing = blockingMissing(app);
  if (missing.length > 0) return { ok: false, error: `${missingDetail(missing)}. جاوبها وبعدين قدّم.` };

  const usage = await monthlyUsage(insforge);
  if (usage && usage.used >= usage.apply_limit) {
    return { ok: false, error: `وصلت حد هذا الشهر (${usage.apply_limit} تقديم). يتجدد أول الشهر.` };
  }
  const browser = await browserChoiceFor(insforge, userId);
  const provider = requested ?? browser.providers[0];
  if (!provider || !browser.providers.includes(provider)) {
    return {
      ok: false,
      error: provider === "local" ? "Chrome على الجهاز لحساب المالك بس." : (browser.steelMissing ?? "Steel مو متاح."),
    };
  }

  if (!(await claimForSubmit(app, provider))) return { ok: false, error: "الطلب تغيّر: حدّث الصفحة." };

  try {
    // Steel ما يحتاج جهاز المالك: يمشي على البيئة العادية مثل أي مستخدم
    const run = await triggerSubmit(browser.owner && provider === "local", app.id, userId, crypto.randomUUID());
    await getInsForgeAdminClient()
      .database.from("applications")
      .update({ trigger_run_id: run.id })
      .eq("id", app.id)
      .eq("user_id", userId);
    return { ok: true, data: { id: app.id } };
  } catch (error) {
    await releaseClaim(app, triggerErrorMessage(error));
    return { ok: false, error: triggerErrorMessage(error) };
  }
}

export interface BatchSummary {
  /** طلبات بدأ تجهيزها، وتنرسل لحالها لما تكمل إجاباتها */
  preparing: number;
  /** جاهزة من قبل: بدأ إرسالها مباشرة */
  submitting: number;
  /** تنتظر جوابك على سؤال مطلوب، وتنرسل لحالها بعده */
  waiting: number;
  /** ما دخلت الدفعة (انرسلت قبل، شغّالة، مقفلة...) */
  skipped: number;
}

type BatchApp = Pick<
  Application,
  | "id"
  | "user_id"
  | "job_id"
  | "status"
  | "submit_attempted_at"
  | "form"
  | "answers"
  | "cv_file_id"
  | "cover_letter_file_id"
  | "auto_submit"
  | "browser_provider"
>;

/** ينفّذ دوال async بحد أقصى بنفس الوقت (تشغيلات Trigger.dev وطلبات القاعدة) */
async function inChunks<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

/**
 * «قدّم على المحدد»: دفعة وظائف بتأكيد واحد من الواجهة (قاعدة 8). كل طلب يتجهّز، والي تكمل
 * إجاباته ينرسل لحاله، والي ينقصه جواب ينتظرك وينرسل أول ما تجاوب.
 */
export async function startBatch(
  insforge: SessionClient,
  userId: string,
  jobIds: string[],
  requested?: BrowserProviderId,
): Promise<ServiceResult<BatchSummary>> {
  const ids = [...new Set(jobIds)];
  if (ids.length === 0) return { ok: false, error: "اختر وظيفة وحدة على الأقل." };
  if (ids.length > MAX_BATCH) return { ok: false, error: `الحد ${MAX_BATCH} وظيفة بالدفعة الوحدة.` };

  const browser = await browserChoiceFor(insforge, userId);
  const provider = requested ?? browser.providers[0];
  if (!provider || !browser.providers.includes(provider)) {
    return {
      ok: false,
      error: provider === "local" ? "Chrome على الجهاز لحساب المالك بس." : (browser.steelMissing ?? "Steel مو متاح."),
    };
  }
  const usage = await monthlyUsage(insforge);
  const left = usage ? Math.max(0, usage.apply_limit - usage.used) : 0;
  if (ids.length > left) {
    return { ok: false, error: left === 0 ? "وصلت حد التقديم هذا الشهر." : `باقي لك ${left} تقديم هذا الشهر: اختر ${left} أو أقل.` };
  }

  const { data: profile } = await insforge.database
    .from("profiles")
    .select("default_cv_file_id")
    .eq("user_id", userId)
    .maybeSingle();
  const cvId = (profile as { default_cv_file_id: string | null } | null)?.default_cv_file_id ?? null;
  if (!cvId) return { ok: false, error: "اختر سيرتك الافتراضية من «ملفي» أول (ارفعها من «ملفاتي»)." };

  const { data: jobRows } = await insforge.database.from("jobs").select("id, source, closed_at").in("id", ids);
  const jobs = ((jobRows ?? []) as Pick<Job, "id" | "source" | "closed_at">[]).filter(
    (j) => isSupportedAts(j.source) && !j.closed_at,
  );
  const summary: BatchSummary = { preparing: 0, submitting: 0, waiting: 0, skipped: ids.length - jobs.length };
  if (jobs.length === 0) return { ok: false, error: "ولا وظيفة من المحدد نقدر نقدّم عليها تلقائيًا (Greenhouse / Lever / Ashby، ومفتوحة)." };

  // INSERT بس: الطلب الموجود يبقى كما هو
  await insforge.database.from("applications").upsert(
    jobs.map((j) => ({ user_id: userId, job_id: j.id, cv_file_id: cvId })),
    { onConflict: "user_id,job_id", ignoreDuplicates: true },
  );
  const { data: appRows } = await insforge.database
    .from("applications")
    .select("id, user_id, job_id, status, submit_attempted_at, form, answers, cv_file_id, cover_letter_file_id, auto_submit, browser_provider")
    .eq("user_id", userId)
    .in("job_id", jobs.map((j) => j.id));
  const apps = (appRows ?? []) as BatchApp[];
  summary.skipped += jobs.length - apps.length;

  const admin = getInsForgeAdminClient();
  const ownerPc = browser.owner && provider === "local";
  let triggerFailed: string | null = null;

  await inChunks(apps, 8, async (app) => {
    const joinable = !app.submit_attempted_at && (SUBMITTABLE.includes(app.status) || app.status === "draft" || app.status === "preparing");
    if (!joinable) {
      summary.skipped++;
      return;
    }
    // ينضم للدفعة: ينرسل لحاله بهذا المتصفح أول ما يجهز
    const { data: joined } = await admin.database
      .from("applications")
      .update({ auto_submit: true, browser_provider: provider })
      .eq("id", app.id)
      .eq("user_id", userId)
      .is("submit_attempted_at", null)
      .select("id");
    if (!joined || (joined as unknown[]).length === 0) {
      summary.skipped++;
      return;
    }
    const member: BatchApp = { ...app, auto_submit: true, browser_provider: provider };

    if (app.status === "preparing") {
      // تجهيزه شغّال من قبل على البيئة العادية: يخلص ويتقدّم لحاله (Steel)، أو ينتظر ضغطتك (Chrome المحلي)
      summary.preparing++;
      return;
    }
    if (app.status === "needs_input") {
      summary.waiting++;
      return;
    }
    if (app.status === "ready" && blockingMissing(member).length === 0) {
      const queued = await queueAutoSubmit(member, () => triggerSubmit(ownerPc, app.id, userId, crypto.randomUUID()));
      if (queued === "queued") summary.submitting++;
      else summary.skipped++;
      return;
    }
    const started = await queuePrepare(member, ownerPc);
    if (started.ok) summary.preparing++;
    else {
      summary.skipped++;
      triggerFailed = started.error;
    }
  });

  if (summary.preparing + summary.submitting + summary.waiting === 0) {
    return { ok: false, error: triggerFailed ?? "ولا طلب دخل الدفعة: كلها انرسلت أو شغّالة من قبل." };
  }
  return { ok: true, data: summary };
}

/**
 * بعد ما يعدّل المستخدم إجاباته أو سيرته: «ينتظر جوابك» ⇄ «جاهز للتقديم». ولو الطلب من دفعة
 * تلقائية وكملت إجاباته، يبدأ إرساله مباشرة.
 */
export async function refreshReadiness(
  insforge: SessionClient,
  userId: string,
  applicationId: string,
): Promise<ApplicationStatus | null> {
  const admin = getInsForgeAdminClient();
  const { data } = await admin.database
    .from("applications")
    .select("id, user_id, status, form, answers, cv_file_id, cover_letter_file_id, auto_submit, browser_provider, submit_attempted_at")
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  const app = data as (BatchApp & { status: ApplicationStatus }) | null;
  if (!app || app.submit_attempted_at || (app.status !== "ready" && app.status !== "needs_input")) return null;

  const missing = blockingMissing(app);
  const next: ApplicationStatus = missing.length > 0 ? "needs_input" : "ready";
  if (next !== app.status || next === "needs_input") {
    await admin.database
      .from("applications")
      .update({ status: next, status_detail: missing.length > 0 ? missingDetail(missing) : null })
      .eq("id", app.id)
      .eq("user_id", userId)
      .in("status", ["ready", "needs_input"])
      .is("submit_attempted_at", null);
  }
  if (next !== "ready" || !app.auto_submit) return next;

  const owner = await isOwnerAccount(insforge, userId);
  const queued = await queueAutoSubmit(app, (provider) =>
    triggerSubmit(owner && provider === "local", app.id, userId, crypto.randomUUID()),
  );
  return queued === "queued" ? "queued" : "ready";
}

/** يلغي طلب بالطابور أو شغّال. لو انضغط «إرسال» قبل الإلغاء ننبّه إن ممكن انرسل. */
export async function cancelApplication(
  insforge: SessionClient,
  userId: string,
  applicationId: string,
): Promise<ServiceResult<undefined>> {
  const { data } = await insforge.database
    .from("applications")
    .select("id, status, browser_provider, trigger_run_id, submit_attempted_at, auto_submit")
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  const app = data as Pick<
    Application,
    "id" | "status" | "browser_provider" | "trigger_run_id" | "submit_attempted_at" | "auto_submit"
  > | null;
  if (!app) return { ok: false, error: "الطلب مو موجود." };
  if (!["preparing", "queued", "running", "needs_user"].includes(app.status)) return { ok: false, error: "ما فيه شي شغّال نلغيه." };

  if (app.trigger_run_id) {
    try {
      await cancelRun(runsOnOwnerPc(await isOwnerAccount(insforge, userId), app), app.trigger_run_id);
    } catch {
      // التشغيل خلص أو مو موجود: نكمل ونحدّث الحالة
    }
  }
  const admin = getInsForgeAdminClient();
  await admin.database
    .from("applications")
    .update({
      status: "cancelled",
      // الإلغاء يطلّعه من الدفعة التلقائية: ما ينرسل لحاله بعدين
      auto_submit: false,
      status_detail: app.submit_attempted_at ? "انلغى بعد محاولة الإرسال: ممكن الطلب انرسل، شيك بريدك." : null,
    })
    .eq("id", app.id)
    .eq("user_id", userId);
  await admin.database.from("application_events").insert({ application_id: app.id, user_id: userId, type: "cancelled" });
  return { ok: true, data: undefined };
}

/**
 * بعد محاولة إرسال ما انتهت بصفحة تأكيد: المستخدم شيك بريده ولقى تأكيد الشركة.
 * ما نعيد الإرسال أبدًا (قاعدة 7)، بس نسجّل كلامه. الحدث يوضح إنه تأكيد يدوي بدون دليل.
 */
export async function confirmSubmittedManually(
  insforge: SessionClient,
  userId: string,
  applicationId: string,
): Promise<ServiceResult<undefined>> {
  const { data } = await insforge.database
    .from("applications")
    .select("id, status, submit_attempted_at")
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  const app = data as Pick<Application, "id" | "status" | "submit_attempted_at"> | null;
  if (!app) return { ok: false, error: "الطلب مو موجود." };
  if (!app.submit_attempted_at || !["failed", "cancelled"].includes(app.status)) {
    return { ok: false, error: "هذا الخيار لطلب انضغط فيه «إرسال» وما ظهر تأكيد." };
  }
  const admin = getInsForgeAdminClient();
  await admin.database
    .from("applications")
    .update({ status: "submitted", submitted_at: new Date().toISOString(), error: null, status_detail: "أكّدت الإرسال بنفسك (بدون صورة تأكيد)." })
    .eq("id", app.id)
    .eq("user_id", userId);
  await admin.database
    .from("application_events")
    .insert({ application_id: app.id, user_id: userId, type: "submitted", data: { manual: true } });
  return { ok: true, data: undefined };
}
