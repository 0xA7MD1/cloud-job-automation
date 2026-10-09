import { logger, metadata, queue, task } from "@trigger.dev/sdk";
import type { FilePayload, Outcome } from "@/lib/apply/adapters/common";
import { readForm, readStoredAnswers } from "@/lib/apply/form";
import {
  downloadFile,
  loadApplicant,
  loadApplication,
  loadOwnedFile,
  markSubmitAttempted,
  storeGeneratedFile,
  updateApplication,
} from "@/lib/apply/store";
import { adapterFor, runSubmission } from "@/lib/apply/submit";
import { liveSessionId, openLocalBrowser, openSteelSession, type BrowserSession } from "@/lib/browser";
import { getProviderSecret } from "@/lib/byok/store";
import { isSupportedAts } from "@/lib/jobs/ats";

// التقديم الفعلي (الخطوة 8). قواعد AGENTS.md:
// - كل شي جاهز قبل فتح المتصفح (الإجابات، السيرة، الخطاب)
// - بدون إعادة محاولة: retry.maxAttempts = 1، وsubmit_attempted ينسجّل قبل الضغط
// - النجاح = دليل محفوظ (صورة صفحة التأكيد)
// - الانتظار للمستخدم داخل نفس الجلسة بحلقة تحقق، بدون wait.for
// - مفتاح Steel ينفك هنا وما يطلع في المدخلات أو المخرجات أو السجلات

const submitQueue = queue({ name: "submit-application", concurrencyLimit: 5 });

/** أقصى انتظار لتدخل المستخدم داخل الجلسة */
const USER_WAIT_MS = 10 * 60_000;
const POLL_MS = 3_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const submitApplicationTask = task({
  id: "submit-application",
  queue: submitQueue,
  maxDuration: 1800,
  retry: { maxAttempts: 1 },
  run: async ({ applicationId }: { applicationId: string }, { ctx, signal }) => {
    const bundle = await loadApplication(applicationId);
    if (!bundle) return { skipped: "not found" };
    const { app, job } = bundle;
    if (app.status !== "queued") return { skipped: `status is ${app.status}` };

    const fail = async (error: string, attempted: boolean) => {
      await updateApplication(
        app,
        { status: "failed", error, status_detail: null },
        { type: "failed", data: { stage: "submit", attempted } },
      );
      metadata.set("step", "done");
      return { failed: error };
    };

    if (app.submit_attempted_at) {
      return fail("انضغط «إرسال» في هذا الطلب قبل: ما نعيد الإرسال. تحقق من بريدك.", true);
    }
    const form = readForm(app.form);
    if (!form || !isSupportedAts(form.ats)) return fail("جهّز الطلب أول.", false);
    const adapter = adapterFor(form.ats);
    if (!adapter) return fail("التقديم التلقائي على هذا النظام مو جاهز للحين.", false);

    const provider = app.browser_provider === "local" ? "local" : "steel";
    await updateApplication(app, { status: "running", error: null, status_detail: null }, { type: "started", data: { provider } });
    metadata.set("step", "browser").set("provider", provider);

    // كل شي قبل المتصفح: دقائقه أغلى
    const applicant = await loadApplicant(app.user_id);
    const cvFile = await loadOwnedFile(app.user_id, app.cv_file_id);
    if (!cvFile || cvFile.kind !== "cv") return fail("السيرة الذاتية المختارة مو موجودة. اختر سيرة من صفحة الطلب.", false);
    const coverFile = await loadOwnedFile(app.user_id, app.cover_letter_file_id);
    const cv: FilePayload = { name: cvFile.file_name, mimeType: cvFile.mime_type, buffer: await downloadFile(cvFile) };
    const coverLetter: FilePayload | null = coverFile
      ? { name: coverFile.file_name, mimeType: coverFile.mime_type, buffer: await downloadFile(coverFile) }
      : null;

    let browser: BrowserSession | null = null;
    try {
      if (provider === "local") {
        if (ctx.environment.type !== "DEVELOPMENT") {
          return fail("المتصفح المحلي يشتغل على جهاز المالك بس: شغّل `pnpm trigger:dev`.", false);
        }
        browser = await openLocalBrowser();
      } else {
        const steel = await getProviderSecret(app.user_id, "steel");
        if (!steel) return fail("مفتاح Steel ناقص أو مرفوض: أضفه من «المفاتيح».", false);
        browser = await openSteelSession({
          apiKey: steel.apiKey,
          captcha: steel.settings.captchaEnabled === true,
          sessionId: liveSessionId(app.id, ctx.run.id),
        });
      }
      const session = browser;
      // إلغاء أو تجاوز المهلة: نسكّر الجلسة فورًا عشان ما تنحسب على المستخدم
      signal.addEventListener("abort", () => void session.close(), { once: true });

      const result = await runSubmission(
        session.page,
        adapter,
        {
          form,
          answers: readStoredAnswers(app.answers),
          files: { cv, coverLetter },
          profile: {
            city: applicant.profile?.city ?? null,
            country: applicant.profile?.country ?? null,
            phone: applicant.profile?.phone ?? null,
          },
        },
        {
          step: (step) => metadata.set("step", step),
          markSubmitAttempted: (reason) => markSubmitAttempted(app, { reason, provider }),
          waitForUser: async (reason, check) => {
            await updateApplication(app, { status: "needs_user", status_detail: reason }, { type: "needs_user", data: { reason } });
            metadata.set("step", "needs_user").set("needsUser", reason);
            const until = Math.min(session.deadline, Date.now() + USER_WAIT_MS);
            let last: Outcome = { kind: "pending" };
            while (Date.now() < until) {
              await sleep(POLL_MS);
              last = await check().catch(() => last);
              if (last.kind === "submitted") break;
            }
            metadata.del("needsUser");
            await updateApplication(app, { status: "running", status_detail: null });
            return last;
          },
        },
      );

      if (result.status === "failed") {
        logger.info("submission did not complete", { skipped: result.fill?.skipped.map((s) => s.key) });
        return fail(result.error, result.attempted);
      }

      // الدليل: صورة صفحة التأكيد، ولو فشلت نحفظ نصها
      metadata.set("step", "evidence");
      const base = `Evidence-${(job.company?.name ?? "company").replace(/[^\p{L}\p{N}]+/gu, "-")}`;
      let evidenceId: string;
      try {
        const png = await session.page.screenshot({ fullPage: true, type: "png", timeout: 20_000 });
        evidenceId = await storeGeneratedFile(app.user_id, "evidence", `${base}.png`, "image/png", png);
      } catch {
        evidenceId = await storeGeneratedFile(
          app.user_id,
          "evidence",
          `${base}.txt`,
          "text/plain",
          Buffer.from(`${session.page.url()}\n\n${result.text}`, "utf8"),
        );
      }
      await updateApplication(app, { evidence_file_id: evidenceId }, { type: "evidence_saved", data: { fileId: evidenceId } });
      await updateApplication(
        app,
        {
          status: "submitted",
          submitted_at: new Date().toISOString(),
          confirmation_ref: result.confirmationRef,
          status_detail: null,
          error: null,
        },
        { type: "submitted", data: { provider, confirmationRef: result.confirmationRef, filled: result.fill.filled.length } },
      );
      metadata.set("step", "done");
      return { submitted: true, confirmationRef: result.confirmationRef };
    } catch (error) {
      logger.error("submit crashed", { message: (error as Error).message });
      const fresh = await loadApplication(applicationId);
      const attempted = !!fresh?.app.submit_attempted_at;
      return fail(
        attempted
          ? "صار خطأ بعد الضغط على «إرسال». ممكن الطلب انرسل: شيك بريدك قبل ما تعيد."
          : "صار خطأ في المتصفح قبل الإرسال. تقدر تعيد المحاولة.",
        attempted,
      );
    } finally {
      await browser?.close();
    }
  },
  onFailure: async ({ payload }) => {
    // انقطاع المهمة نفسها (مهلة، إلغاء): لا نترك الطلب «شغّال»
    const bundle = await loadApplication(payload.applicationId);
    if (!bundle || !["queued", "running", "needs_user"].includes(bundle.app.status)) return;
    await updateApplication(
      bundle.app,
      {
        status: "failed",
        error: bundle.app.submit_attempted_at
          ? "توقفت المهمة بعد محاولة الإرسال. شيك بريدك قبل ما تعيد."
          : "توقفت المهمة قبل الإرسال. تقدر تعيد المحاولة.",
      },
      { type: "failed", data: { stage: "submit", attempted: !!bundle.app.submit_attempted_at } },
    );
  },
});
