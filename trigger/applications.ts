import { logger, metadata, queue, task } from "@trigger.dev/sdk";
import { PrepareError, prepareApplication, renderCoverLetterFiles } from "@/lib/apply/prepare";
import { loadApplication, updateApplication } from "@/lib/apply/store";

// تجهيز الطلب (الخطوة 7). المدخلات معرّف الطلب بس: السيرة والمفاتيح تنقرأ هنا وما تطلع في المخرجات.

export const prepareApplicationTask = task({
  id: "prepare-application",
  maxDuration: 300,
  retry: { maxAttempts: 2 },
  run: async ({ applicationId }: { applicationId: string }) => {
    const bundle = await loadApplication(applicationId);
    if (!bundle) return { skipped: "not found" };
    if (bundle.app.submit_attempted_at) return { skipped: "already submitted" };
    if (bundle.app.status !== "preparing") return { skipped: `status is ${bundle.app.status}` };

    try {
      return await prepareApplication(bundle, (step) => metadata.set("step", step));
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
