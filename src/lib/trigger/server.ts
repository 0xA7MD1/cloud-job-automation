import "server-only";
import { auth, runs, tasks } from "@trigger.dev/sdk";
import type { prepareApplicationTask, renderCoverLetterTask } from "../../../trigger/applications";
import type { submitApplicationTask } from "../../../trigger/submit";
import { readEnv } from "@/lib/env";

// تشغيل مهام Trigger.dev من التطبيق.
//
// حساب المالك (entitlements.plan = 'owner') يشتغل على بيئة التطوير لو
// TRIGGER_OWNER_SECRET_KEY موجود: المهام تنفّذ على جهاز أحمد عبر `pnpm trigger:dev`
// (المتصفح المحلي، وتشغيلات التطوير ما تنحسب). البقية على TRIGGER_SECRET_KEY.

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

/** وين تشتغل مهام هذا المستخدم */
export function runEnvironment(isOwner: boolean): "owner-dev" | "default" {
  return isOwner && ownerKey() ? "owner-dev" : "default";
}

async function withRunAuth<T>(isOwner: boolean, fn: () => Promise<T>): Promise<T> {
  try {
    readEnv("TRIGGER_SECRET_KEY");
  } catch {
    throw new TriggerNotConfiguredError();
  }
  const key = isOwner ? ownerKey() : null;
  if (!key) return fn();
  return (await auth.withAuth({ accessToken: key }, fn)) as T;
}

export interface RunHandle {
  id: string;
}

export function triggerPrepare(isOwner: boolean, applicationId: string): Promise<RunHandle> {
  return withRunAuth(isOwner, () =>
    tasks.trigger<typeof prepareApplicationTask>(
      "prepare-application",
      { applicationId },
      { tags: [`application_${applicationId}`] },
    ),
  );
}

export function triggerRenderCoverLetter(isOwner: boolean, applicationId: string): Promise<RunHandle> {
  return withRunAuth(isOwner, () =>
    tasks.trigger<typeof renderCoverLetterTask>(
      "render-cover-letter",
      { applicationId },
      { concurrencyKey: applicationId, tags: [`application_${applicationId}`] },
    ),
  );
}

/** الإرسال مرة وحدة لكل محاولة يطلبها المستخدم (idempotencyKey) وبدون إعادة تلقائية (القاعدة 7) */
export function triggerSubmit(isOwner: boolean, applicationId: string, attempt: string): Promise<RunHandle> {
  return withRunAuth(isOwner, () =>
    tasks.trigger<typeof submitApplicationTask>(
      "submit-application",
      { applicationId },
      { idempotencyKey: `submit-${applicationId}-${attempt}`, tags: [`application_${applicationId}`] },
    ),
  );
}

export async function cancelRun(isOwner: boolean, runId: string): Promise<void> {
  await withRunAuth(isOwner, () => runs.cancel(runId));
}

/** توكن قراءة لتشغيل واحد، للواجهة (useRealtimeRun). ساعة وحدة. */
export async function createRunReadToken(isOwner: boolean, runId: string): Promise<string | null> {
  try {
    return await withRunAuth(isOwner, () =>
      auth.createPublicToken({ scopes: { read: { runs: [runId] } }, expirationTime: "1h" }),
    );
  } catch {
    return null;
  }
}
