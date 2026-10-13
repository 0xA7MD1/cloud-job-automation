import { getUserModel } from "@/lib/ai/model";
import type { Application, Profile } from "@/lib/db/types";
import { isSupportedAts } from "@/lib/jobs/ats";
import { answerMissing, draftApplication, detectLanguage, type DraftInput } from "./ai";
import { autoAnswer } from "./answers";
import { extractCvText } from "./cv-text";
import { coverLetterDocx, coverLetterFileName, coverLetterPdf } from "./documents";
import { missingRequired, readStoredAnswers, type ApplicationForm, type FormField, type StoredAnswers } from "./form";
import { fetchApplicationForm } from "./forms";
import {
  downloadFile,
  loadApplicant,
  loadOwnedFile,
  removeGeneratedFile,
  storeGeneratedFile,
  updateApplication,
  type ApplicationBundle,
} from "./store";

// تجهيز الطلب كامل قبل أي متصفح (قاعدة 1): الأسئلة، الإجابات، الخطاب وملفاته، والمسودات.

export type PrepareStep = "questions" | "cv" | "answers" | "ai" | "documents" | "done";

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function contactLines(profile: Profile | null, email: string): string[] {
  const place = [profile?.city, profile?.country].filter(Boolean).join(", ");
  const first = [email, profile?.phone, place].filter(Boolean).join("  ·  ");
  const links = [profile?.linkedin_url, profile?.github_url, profile?.portfolio_url].filter(Boolean).join("  ·  ");
  return [first, links].filter(Boolean);
}

/** يولّد PDF وWord من نص الخطاب ويحفظهم، ويحذف النسخ المولّدة القديمة. */
export async function renderCoverLetterFiles(
  bundle: ApplicationBundle,
  text: string,
  applicant?: Awaited<ReturnType<typeof loadApplicant>>,
): Promise<{ pdfId: string; docxId: string }> {
  const { app, job } = bundle;
  const who = applicant ?? (await loadApplicant(app.user_id));
  const company = job.company?.name ?? "";
  const input = {
    body: text,
    fullName: who.profile?.full_name?.trim() || who.email,
    contact: contactLines(who.profile, who.email),
    company,
    jobTitle: job.title,
    date: new Date(),
    language: detectLanguage(text),
  };
  const [pdf, docx] = await Promise.all([coverLetterPdf(input), coverLetterDocx(input)]);
  const pdfId = await storeGeneratedFile(app.user_id, "document", coverLetterFileName(company, job.title, "pdf"), PDF, pdf);
  const docxId = await storeGeneratedFile(app.user_id, "document", coverLetterFileName(company, job.title, "docx"), DOCX, docx);

  // القديم ينحذف بعد ما ينحفظ الجديد. خطاب رفعه المستخدم بنفسه ما ينلمس (removeGeneratedFile)
  await Promise.all([
    removeGeneratedFile(app.user_id, app.cover_letter_file_id),
    removeGeneratedFile(app.user_id, app.cover_letter_docx_file_id),
  ]);
  return { pdfId, docxId };
}

export interface PrepareResult {
  /** ready = كل المطلوب له إجابة، needs_input = ينتظر إجابات المستخدم */
  status: "ready" | "needs_input";
  fields: number;
  autoAnswered: number;
  aiAnswered: number;
  missing: number;
  usedAi: boolean;
  formComplete: boolean;
}

export async function prepareApplication(
  bundle: ApplicationBundle,
  onStep: (step: PrepareStep) => void = () => {},
  options: {
    /**
     * مزود الذكاء رد 429: ننتظر ونعيد نفس الطلب (المهمة تنتظر بـwait.for). false = نكمل بدون ذكاء.
     * داخل المهمة نفسها لأن إعادة المحاولة مقفلة في بيئة التطوير.
     */
    waitForRateLimit?: (attempt: number) => Promise<boolean>;
  } = {},
): Promise<PrepareResult> {
  const withRateLimit = async <T>(fn: () => Promise<T>): Promise<T> => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (!isRateLimited(error) || !(await options.waitForRateLimit?.(attempt))) throw error;
      }
    }
  };
  const { app, job } = bundle;
  const company = job.company;
  if (!company || !isSupportedAts(job.source) || !company.ats_slug) {
    throw new PrepareError("الوظيفة مو من Greenhouse أو Lever أو Ashby: قدّم عليها من رابطها مباشرة.");
  }
  if (job.closed_at) throw new PrepareError("الوظيفة انقفلت.");

  onStep("questions");
  const form: ApplicationForm = await fetchApplicationForm(job.source, company.ats_slug, job.external_id);

  onStep("cv");
  const applicant = await loadApplicant(app.user_id);
  const cvFile = await loadOwnedFile(app.user_id, app.cv_file_id ?? applicant.profile?.default_cv_file_id ?? null);
  if (!cvFile || cvFile.kind !== "cv") throw new PrepareError("ما فيه سيرة ذاتية مختارة. ارفع سيرتك من «ملفاتي».");
  const cvText = await extractCvText(await downloadFile(cvFile), cvFile.mime_type);

  onStep("answers");
  const profile = applicant.profile;
  const ctx = {
    profile: {
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      city: profile?.city ?? null,
      country: profile?.country ?? null,
      headline: profile?.headline ?? null,
      linkedin_url: profile?.linkedin_url ?? null,
      github_url: profile?.github_url ?? null,
      portfolio_url: profile?.portfolio_url ?? null,
    },
    bank: applicant.bank,
    email: applicant.email,
  };
  const auto = autoAnswer(form.fields, ctx);
  // إجابات عدّلها المستخدم بنفسه تبقى (إعادة التجهيز ما تمسحها) وما نسأل الذكاء عنها
  const userEdited: StoredAnswers = Object.fromEntries(
    Object.entries(readStoredAnswers(app.answers)).filter(([, a]) => a.source === "user"),
  );
  const pending = auto.pending.filter((f) => !userEdited[f.key]);

  onStep("ai");
  const model = await getUserModel(app.user_id);
  let aiAnswers: StoredAnswers = {};
  let coverLetter = app.cover_letter_text?.trim() ?? "";
  let outreach: Application["outreach"] = app.outreach ?? {};
  let aiNote: string | null = null;
  if (model) {
    const input: DraftInput = {
      job: { title: job.title, company: company.name, location: job.location, description: job.description },
      candidate: {
        fullName: profile?.full_name ?? null,
        headline: profile?.headline ?? null,
        summary: profile?.summary ?? null,
        yearsExperience: profile?.years_experience ?? null,
        city: profile?.city ?? null,
        country: profile?.country ?? null,
      },
      bank: applicant.bank,
      cvText,
      fields: pending,
      language: detectLanguage(job.description ?? job.title),
    };
    let drafted = false;
    try {
      const draft = await withRateLimit(() => draftApplication(model.model, input));
      aiAnswers = draft.answers;
      coverLetter = draft.coverLetter || coverLetter;
      outreach = draft.outreach;
      drafted = true;
    } catch (error) {
      aiNote = aiErrorMessage(error);
    }
    // مطلوب ورجع فاضي: جولة ثانية على هذي بس (أسئلة مفتوحة ينساها النموذج أو يتحفّظ عليها)
    const stillEmpty = drafted ? unansweredRequired(pending, { ...auto.answers, ...aiAnswers }) : [];
    if (stillEmpty.length > 0) {
      try {
        aiAnswers = { ...aiAnswers, ...(await withRateLimit(() => answerMissing(model.model, input, stillEmpty))) };
      } catch {
        // الجولة الأولى تكفي: الناقص يبان للمستخدم في «ينتظر جوابك»
      }
    }
  } else {
    aiNote = "أضف مفتاح ذكاء من «المفاتيح» عشان نكتب خطاب التقديم ونجاوب الأسئلة الخاصة.";
  }

  const answers: StoredAnswers = { ...auto.answers, ...aiAnswers, ...userEdited };

  // Lever: «Additional information» = نص الخطاب
  const comments = form.fields.find((f) => f.key === "comments");
  if (comments && !answers.comments && coverLetter) answers.comments = { value: coverLetter, source: "ai" };

  onStep("documents");
  let files: { pdfId: string; docxId: string } | null = null;
  if (coverLetter) files = await renderCoverLetterFiles(bundle, coverLetter, applicant);

  const missing = missingRequired(form, answers, {
    cv: true,
    coverLetter: !!files || !!app.cover_letter_file_id,
  });
  const review = Object.values(answers).filter((a) => a.review).length;
  const status = missing.length > 0 ? "needs_input" : "ready";
  const detail = [
    missing.length
      ? `ينتظر جوابك على ${missing.length === 1 ? "سؤال مطلوب" : `${missing.length} أسئلة مطلوبة`}: ${missing
          .slice(0, 3)
          .map((f) => f.label || f.key)
          .join("، ")}${missing.length > 3 ? "…" : ""}`
      : null,
    review ? `${review} إجابة تحتاج مراجعتك` : null,
    form.complete ? null : "ما قدرنا نقرأ كل أسئلة النموذج: بعضها ينكشف وقت التقديم",
    aiNote,
  ]
    .filter(Boolean)
    .join(" · ");

  await updateApplication(
    app,
    {
      form,
      answers,
      cv_file_id: cvFile.id,
      cover_letter_text: coverLetter || null,
      ...(files ? { cover_letter_file_id: files.pdfId, cover_letter_docx_file_id: files.docxId } : {}),
      outreach,
      status,
      status_detail: detail || null,
      error: null,
      prepared_at: new Date().toISOString(),
    },
    {
      type: "prepared",
      data: {
        fields: form.fields.length,
        missing: missing.length,
        review,
        ai: !!model && !aiNote,
        formComplete: form.complete,
      },
    },
  );
  onStep("done");

  return {
    status,
    fields: form.fields.length,
    autoAnswered: Object.keys(auto.answers).length,
    aiAnswered: Object.keys(aiAnswers).length,
    missing: missing.length,
    usedAi: !!model && !aiNote,
    formComplete: form.complete,
  };
}

/** خطأ متوقع برسالة للمستخدم (ما يستاهل إعادة محاولة) */
export class PrepareError extends Error {}

/** رقم حالة HTTP من خطأ AI SDK (بعد إعادة المحاولة يجي داخل lastError) */
function statusOf(error: unknown): number | undefined {
  const e = error as { statusCode?: number; lastError?: { statusCode?: number } } | null;
  return e?.statusCode ?? e?.lastError?.statusCode;
}

function isRateLimited(error: unknown): boolean {
  return statusOf(error) === 429;
}

/** حقول مطلوبة (غير الملفات) بدون إجابة للحين */
function unansweredRequired(fields: readonly FormField[], answers: StoredAnswers): FormField[] {
  return missingRequired({ fields: fields.filter((f) => f.type !== "file") }, answers, { cv: true, coverLetter: true });
}

function aiErrorMessage(error: unknown): string {
  const status = statusOf(error);
  if (status === 401 || status === 403) return "مفتاح الذكاء مرفوض: حدّثه من «المفاتيح».";
  if (status === 429) return "مزود الذكاء رفض لكثرة الطلبات: أعد التجهيز بعد شوي.";
  return "الذكاء ما رد بشكل صحيح: أعد التجهيز أو جرّب نموذج ثاني.";
}
