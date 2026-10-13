import "server-only";
import { auth, runs, tasks } from "@trigger.dev/sdk";
import type { prepareApplicationTask, renderCoverLetterTask } from "../../../trigger/applications";
import type { discoverCompanyTask } from "../../../trigger/discover";
import type { submitApplicationTask } from "../../../trigger/submit";
import { readEnv } from "@/lib/env";

// تشغيل مهام Trigger.dev من التطبيق.
//
// `ownerPc = true` ⇒ المهمة تشتغل على جهاز أحمد (بيئة التطوير عبر `pnpm trigger:dev`، وتشغيلاتها
// ما تنحسب) لو TRIGGER_OWNER_SECRET_KEY موجود. هذا للإرسال بـChrome المحلي بس: الباقي (التجهيز،
// الخطاب، الإرسال عبر Steel) على TRIGGER_SECRET_KEY، فالنسخة المنشورة تشتغل وجهازه مطفي.
// استثناء: دفعة تلقائية بـChrome المحلي تتجهّز على جهازه بعد، عشان الإرسال الي يطلقه التجهيز
// يشتغل في نفس البيئة.
//
// concurrencyKey = user_id: حد التزامن في الطابور لكل مستخدم، مو مشترك بين الكل.

export class TriggerNotConfiguredError extends Error {
  constructor() {
    super("Trigger.dev is not configured");
  }
}

/** مفتاح بيئة التطوير للمالك. محليًا لو TRIGGER_SECRET_KEY نفسه مفتاح تطوير، كل شي أصلًا على جهازه. */
function ownerKey(): string | null {
  const explicit = process.env.TRIGGER_OWNER_SECRET_KEY?.trim();
  if (explicit) return explicit;
  const main = process.env.TRIGGER_SECRET_KEY?.trim();
  return main?.startsWith("tr_dev_") ? main : null;
}

/** نقدر نشغّل مهام على جهاز المالك (شرط متصفحه المحلي) */
export function ownerPcAvailable(): boolean {
  return !!ownerKey();
}

async function withRunAuth<T>(ownerPc: boolean, fn: () => Promise<T>): Promise<T> {
  try {
    readEnv("TRIGGER_SECRET_KEY");
  } catch {
    throw new TriggerNotConfiguredError();
  }
  const key = ownerPc ? ownerKey() : null;
  if (!key) return fn();
  return (await auth.withAuth({ accessToken: key }, fn)) as T;
}

export interface RunHandle {
  id: string;
}

export function triggerPrepare(applicationId: string, userId: string, ownerPc = false): Promise<RunHandle> {
  return withRunAuth(ownerPc, () =>
    tasks.trigger<typeof prepareApplicationTask>(
      "prepare-application",
      { applicationId },
      { concurrencyKey: userId, tags: [`application_${applicationId}`] },
    ),
  );
}

/** فحص شركات بالخلفية لمستخدم (شركات قريبة): تشغيل لكل شركة بطلب واحد */
export async function triggerDiscover(
  companyIds: string[],
  input: { userId: string; searchId: string | null; keywords: string[] },
): Promise<void> {
  if (companyIds.length === 0) return;
  await withRunAuth(false, () =>
    tasks.batchTrigger<typeof discoverCompanyTask>(
      "discover-company",
      companyIds.map((companyId) => ({
        payload: { companyId, ...input },
        options: {
          concurrencyKey: input.userId,
          // نفس الشركة لنفس المستخدم مرة وحدة بالساعة (بحثين ورا بعض)
          idempotencyKey: `discover-${input.userId}-${companyId}-${new Date().toISOString().slice(0, 13)}`,
        },
      })),
    ),
  );
}

export function triggerRenderCoverLetter(applicationId: string): Promise<RunHandle> {
  return withRunAuth(false, () =>
    tasks.trigger<typeof renderCoverLetterTask>(
      "render-cover-letter",
      { applicationId },
      { concurrencyKey: applicationId, tags: [`application_${applicationId}`] },
    ),
  );
}

/** الإرسال مرة وحدة لكل محاولة يطلبها المستخدم (idempotencyKey) وبدون إعادة تلقائية (القاعدة 7) */
export function triggerSubmit(ownerPc: boolean, applicationId: string, userId: string, attempt: string): Promise<RunHandle> {
  return withRunAuth(ownerPc, () =>
    tasks.trigger<typeof submitApplicationTask>(
      "submit-application",
      { applicationId },
      {
        idempotencyKey: `submit-${applicationId}-${attempt}`,
        concurrencyKey: userId,
        tags: [`application_${applicationId}`],
      },
    ),
  );
}

export async function cancelRun(ownerPc: boolean, runId: string): Promise<void> {
  await withRunAuth(ownerPc, () => runs.cancel(runId));
}

/** توكن قراءة لتشغيل واحد، للواجهة (useRealtimeRun). ساعة وحدة. */
export async function createRunReadToken(ownerPc: boolean, runId: string): Promise<string | null> {
  try {
    return await withRunAuth(ownerPc, () =>
      auth.createPublicToken({ scopes: { read: { runs: [runId] } }, expirationTime: "1h" }),
    );
  } catch {
    return null;
  }
}
