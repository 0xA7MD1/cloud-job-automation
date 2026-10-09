import type { Page } from "playwright-core";
import type { SupportedAts } from "@/lib/jobs/ats";
import type { AtsAdapter, FillPlan, FillReport, Outcome } from "./adapters/common";
import { ashbyAdapter } from "./adapters/ashby";
import { greenhouseAdapter } from "./adapters/greenhouse";
import { leverAdapter } from "./adapters/lever";

// تسلسل التقديم داخل المتصفح (الخطوة 8). يعتمد على دوال تمرّرها المهمة
// (حفظ الحالة، تسجيل محاولة الإرسال، انتظار المستخدم) عشان يبقى قابل للاختبار.

export type SubmitStep = "open" | "fill" | "upload" | "review" | "submit" | "confirm" | "evidence" | "needs_user" | "done";

const ADAPTERS: Partial<Record<SupportedAts, AtsAdapter>> = {
  greenhouse: greenhouseAdapter,
  lever: leverAdapter,
  ashby: ashbyAdapter,
};

export function adapterFor(ats: SupportedAts): AtsAdapter | null {
  return ADAPTERS[ats] ?? null;
}

export interface SubmissionHooks {
  step(step: SubmitStep): void;
  /**
   * يسجّل submit_attempted قبل أي ضغطة «إرسال» (قاعدة 7). false = انسجّل قبل:
   * ما نرسل مرة ثانية.
   */
  markSubmitAttempted(reason: "auto" | "handed_to_user"): Promise<boolean>;
  /**
   * يوقف وينتظر المستخدم داخل نفس الجلسة (قاعدة 3) لين تتحقق check أو تنتهي المهلة.
   * يرجّع آخر نتيجة.
   */
  waitForUser(reason: string, check: () => Promise<Outcome>): Promise<Outcome>;
}

export type SubmissionResult =
  | { status: "submitted"; confirmationRef: string | null; text: string; fill: FillReport }
  | { status: "failed"; error: string; attempted: boolean; fill: FillReport | null };

const CONFIRM_TIMEOUT_MS = 45_000;

async function waitForOutcome(page: Page, adapter: AtsAdapter, timeoutMs: number): Promise<Outcome> {
  const until = Date.now() + timeoutMs;
  let last: Outcome = { kind: "pending" };
  // أول ثانيتين: الصفحة لسا ما تغيّرت بعد الضغط
  await page.waitForTimeout(2_000);
  while (Date.now() < until) {
    last = await adapter.outcome(page);
    if (last.kind === "submitted" || last.kind === "captcha" || last.kind === "verification") return last;
    // أخطاء التحقق تطلع فورًا: نعطيها 6 ثواني بس عشان ما نخلط مع رسائل تختفي
    if (last.kind === "invalid" && Date.now() > until - timeoutMs + 6_000) return last;
    await page.waitForTimeout(1_500);
  }
  return last;
}

function requiredSkipped(fill: FillReport): string[] {
  return fill.skipped.filter((s) => s.required).map((s) => s.label || s.key);
}

export async function runSubmission(
  page: Page,
  adapter: AtsAdapter,
  plan: FillPlan,
  hooks: SubmissionHooks,
): Promise<SubmissionResult> {
  hooks.step("open");
  const opened = await adapter.open(page, plan.form.applyUrl);
  if (!opened) {
    const closed = (await adapter.outcome(page)).kind === "closed";
    return {
      status: "failed",
      error: closed ? "الوظيفة انقفلت أو صفحة التقديم مو موجودة." : "صفحة التقديم ما فتحت. جرّب مرة ثانية.",
      attempted: false,
      fill: null,
    };
  }

  hooks.step("fill");
  const fill = await adapter.fill(page, plan);

  hooks.step("review");
  const missing = requiredSkipped(fill);
  let outcome: Outcome;

  if (missing.length > 0) {
    // ناقص شي ما نعرفه: المستخدم يكمّله ويضغط «إرسال» بنفسه، ونحن نراقب صفحة التأكيد
    if (!(await hooks.markSubmitAttempted("handed_to_user"))) {
      return { status: "failed", error: "انسجّلت محاولة إرسال قبل: ما نعيد الإرسال. تحقق من بريدك.", attempted: true, fill };
    }
    hooks.step("needs_user");
    outcome = await hooks.waitForUser(
      `كمّل الحقول الناقصة واضغط «إرسال» بنفسك: ${missing.slice(0, 5).join("، ")}`,
      () => adapter.outcome(page),
    );
  } else {
    if (!(await hooks.markSubmitAttempted("auto"))) {
      return { status: "failed", error: "انسجّلت محاولة إرسال قبل: ما نعيد الإرسال. تحقق من بريدك.", attempted: true, fill };
    }
    hooks.step("submit");
    await adapter.submit(page);
    hooks.step("confirm");
    outcome = await waitForOutcome(page, adapter, CONFIRM_TIMEOUT_MS);

    if (outcome.kind !== "submitted") {
      const reason =
        outcome.kind === "captcha"
          ? "الموقع طلب تحقق (كابتشا): حلّه، والإرسال يكمل لحاله أو اضغط «إرسال»."
          : outcome.kind === "verification"
            ? "الموقع أرسل رمز تحقق لبريدك: أدخله واضغط «إرسال»."
            : outcome.kind === "invalid"
              ? `الموقع رفض بعض الحقول: ${outcome.messages.join("، ") || "صحّحها"} ثم اضغط «إرسال».`
              : "ما ظهرت صفحة تأكيد: شيك الصفحة وكمّل الإرسال لو لزم.";
      hooks.step("needs_user");
      outcome = await hooks.waitForUser(reason, () => adapter.outcome(page));
    }
  }

  if (outcome.kind === "submitted") {
    hooks.step("evidence");
    return { status: "submitted", confirmationRef: outcome.confirmationRef, text: outcome.text, fill };
  }
  return {
    status: "failed",
    error:
      "انتهت مهلة الانتظار وما ظهرت صفحة تأكيد. ممكن الطلب انرسل: شيك بريدك قبل ما تعيد التقديم.",
    attempted: true,
    fill,
  };
}
