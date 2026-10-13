import { logger, metadata, queue, task, wait } from "@trigger.dev/sdk";
import { PrepareError, prepareApplication, renderCoverLetterFiles } from "@/lib/apply/prepare";
import { queueAutoSubmit } from "@/lib/apply/queue";
import { loadApplication, updateApplication } from "@/lib/apply/store";
import { submitApplicationTask } from "./submit";

// تجهيز الطلب (الخطوة 7). المدخلات معرّف الطلب بس: السيرة والمفاتيح تنقرأ هنا وما تطلع في المخرجات.

// دفعة 40 طلب = 40 تجهيز بمفتاح ذكاء واحد: اثنين بنفس الوقت لكل مستخدم (concurrencyKey = user_id)
// عشان ما نصدم حد المزود المجاني بالدقيقة
const prepareQueue = queue({ name: "prepare-application", concurrencyLimit: 2 });

/** انتظار حد مزود الذكاء: 30ث، دقيقة، دقيقتين، ثم نكمل بدونه */
const RATE_LIMIT_WAITS = [30, 60, 120];

export const prepareApplicationTask = task({
  id: "prepare-application",
  queue: prepareQueue,
  maxDuration: 900,
  retry: { maxAttempts: 2 },
  run: async ({ applicationId }: { applicationId: string }, { ctx }) => {
    const bundle = await loadApplication(applicationId);
    if (!bundle) return { skipped: "not found" };
    if (bundle.app.submit_attempted_at) return { skipped: "already submitted" };
    if (bundle.app.status !== "preparing") return { skipped: `status is ${bundle.app.status}` };

    try {
      const result = await prepareApplication(bundle, (step) => metadata.set("step", step), {
        waitForRateLimit: async (attempt) => {
          const seconds = RATE_LIMIT_WAITS[attempt - 1];
          if (!seconds) return false;
          metadata.set("step", "ai_wait");
          await wait.for({ seconds });
          metadata.set("step", "ai");
          return true;
        },
      });
      if (result.status !== "ready" || !bundle.app.auto_submit) return result;
      // Chrome المحلي يشتغل على جهاز المالك بس: تجهيز بدأ على السحابة ينتظر ضغطته
      if (bundle.app.browser_provider === "local" && ctx.environment.type !== "DEVELOPMENT") return result;

      // من دفعة أكّدها المستخدم: يتقدّم لحاله (نفس البيئة: جهاز المالك أو السحابة)
      const fresh = await loadApplication(applicationId);
      const queued = fresh
        ? await queueAutoSubmit(fresh.app, () =>
            submitApplicationTask.trigger(
              { applicationId },
              {
                idempotencyKey: `submit-${applicationId}-auto-${ctx.run.id}`,
                concurrencyKey: fresh.app.user_id,
                tags: [`application_${applicationId}`],
              },
            ),
          )
        : "changed";
      return { ...result, autoSubmit: queued };
    } catch (error) {
      if (error instanceof PrepareError) {
        await updateApplication(
          bundle.app,
          { status: "failed", error: error.message, status_detail: null },
          { type: "failed", data: { stage: "prepare" } },
        );
        return { failed: error.message };
      }
      throw error;
    }
  },
  onFailure: async ({ payload, error }) => {
    logger.error("prepare failed", { applicationId: payload.applicationId, message: (error as Error)?.message });
    const bundle = await loadApplication(payload.applicationId);
    if (bundle?.app.status !== "preparing") return;
    await updateApplication(
      bundle.app,
      { status: "failed", error: "صار خطأ وقت التجهيز. جرّب «أعد التجهيز».", status_detail: null },
      { type: "failed", data: { stage: "prepare" } },
    );
  },
});

// تعديلين ورا بعض على نفس الطلب: واحد بعد الثاني (التشغيل يرسل concurrencyKey = معرّف الطلب)
const coverLetterQueue = queue({ name: "cover-letter", concurrencyLimit: 1 });

/** بعد ما يعدّل المستخدم نص الخطاب: نولّد PDF/Word من جديد */
export const renderCoverLetterTask = task({
  id: "render-cover-letter",
  queue: coverLetterQueue,
  maxDuration: 120,
  retry: { maxAttempts: 2 },
  run: async ({ applicationId }: { applicationId: string }) => {
    const bundle = await loadApplication(applicationId);
    if (!bundle) return { skipped: "not found" };
    const text = bundle.app.cover_letter_text?.trim();
    if (!text || bundle.app.submit_attempted_at) return { skipped: "nothing to render" };

    const files = await renderCoverLetterFiles(bundle, text);
    await updateApplication(bundle.app, { cover_letter_file_id: files.pdfId, cover_letter_docx_file_id: files.docxId });
    return { rendered: true };
  },
});
