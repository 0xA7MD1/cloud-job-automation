import { z } from "zod";
import type { SupportedAts } from "@/lib/jobs/ats";

// شكل موحّد لنموذج التقديم من أي نظام توظيف. ينحفظ في applications.form،
// والتجهيز (الخطوة 7) والتعبئة في المتصفح (الخطوة 8) يقرأون نفس الشكل.

export const FIELD_TYPES = [
  "text",
  "textarea",
  "email",
  "phone",
  "url",
  "number",
  "date",
  "location",
  "file",
  "select",
  "multiselect",
  "boolean",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

const optionSchema = z.object({
  label: z.string().max(1000),
  value: z.string().max(1000),
  /** خيار «أفضّل عدم الإجابة» في أسئلة الهوية الطوعية */
  decline: z.boolean().optional(),
});
export type FieldOption = z.infer<typeof optionSchema>;

export const formFieldSchema = z.object({
  /** المعرّف في نظام التوظيف (اسم الحقل أو مساره). المحوّلات تلقى العنصر به */
  key: z.string().min(1).max(300),
  label: z.string().max(3000),
  description: z.string().max(4000).optional(),
  type: z.enum(FIELD_TYPES),
  required: z.boolean(),
  options: z.array(optionSchema).max(2000).optional(),
  /** basic = بيانات التواصل والملفات، question = أسئلة الشركة، demographic = هوية طوعية (EEO) */
  group: z.enum(["basic", "question", "demographic"]),
  /** لحقول الملفات: وش نرفع فيها */
  file: z.enum(["cv", "cover_letter", "other"]).optional(),
});
export type FormField = z.infer<typeof formFieldSchema>;

export const applicationFormSchema = z.object({
  ats: z.enum(["greenhouse", "lever", "ashby"]),
  applyUrl: z.url(),
  fetchedAt: z.string(),
  /** false = ما قدرنا نجيب الأسئلة: نعرف الحقول الأساسية بس، والباقي ينكشف في المتصفح */
  complete: z.boolean(),
  fields: z.array(formFieldSchema).max(300),
});
export type ApplicationForm = z.infer<typeof applicationFormSchema> & { ats: SupportedAts };

export const answerValueSchema = z.union([
  z.string().max(12_000),
  z.array(z.string().max(1000)).max(200),
  z.boolean(),
]);
export type AnswerValue = z.infer<typeof answerValueSchema>;

/** مصدر كل إجابة يبان في صفحة المراجعة */
export const ANSWER_SOURCES = ["profile", "bank", "ai", "user", "decline"] as const;
export type AnswerSource = (typeof ANSWER_SOURCES)[number];

export const storedAnswerSchema = z.object({
  value: answerValueSchema,
  source: z.enum(ANSWER_SOURCES),
  /** الذكاء ما كان متأكد: لازم المستخدم يراجعها */
  review: z.boolean().optional(),
});
export type StoredAnswer = z.infer<typeof storedAnswerSchema>;
export type StoredAnswers = Record<string, StoredAnswer>;

export function readForm(value: unknown): ApplicationForm | null {
  const parsed = applicationFormSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function readStoredAnswers(value: unknown): StoredAnswers {
  if (!value || typeof value !== "object") return {};
  const out: StoredAnswers = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const parsed = storedAnswerSchema.safeParse(raw);
    if (parsed.success) out[key] = parsed.data;
  }
  return out;
}

export function isEmptyAnswer(value: AnswerValue | undefined | null): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "boolean") return false;
  if (Array.isArray(value)) return value.length === 0;
  return value.trim() === "";
}

/** حقول مطلوبة بدون إجابة. الملفات تنحسب من ملفات الطلب نفسه. */
export function missingRequired(
  form: Pick<ApplicationForm, "fields">,
  answers: StoredAnswers,
  files: { cv: boolean; coverLetter: boolean },
): FormField[] {
  return form.fields.filter((field) => {
    if (!field.required) return false;
    if (field.type === "file") {
      if (field.file === "cv") return !files.cv;
      if (field.file === "cover_letter") return !files.coverLetter;
      return true;
    }
    return isEmptyAnswer(answers[field.key]?.value);
  });
}

/** يطابق نص إجابة مع خيارات الحقل (حرفي، ثم بدون حالة الأحرف، ثم احتواء). */
export function matchOption(options: readonly FieldOption[] | undefined, wanted: string): FieldOption | null {
  if (!options?.length) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const target = norm(wanted);
  if (!target) return null;
  return (
    options.find((o) => o.value === wanted || o.label === wanted) ??
    options.find((o) => norm(o.label) === target) ??
    options.find((o) => norm(o.label).startsWith(`${target} `) || norm(o.label).startsWith(`${target},`)) ??
    (target.length >= 4 ? options.find((o) => norm(o.label).includes(target)) : undefined) ??
    null
  );
}

const DECLINE_RE =
  /decline|don'?t wish|do not wish|prefer not|rather not|not to (say|answer|disclose|self)|choose not|i don'?t want|not wish to/i;

/** خيار «أفضّل عدم الإجابة» لو موجود */
export function declineOption(options: readonly FieldOption[] | undefined): FieldOption | null {
  return options?.find((o) => o.decline) ?? options?.find((o) => DECLINE_RE.test(o.label)) ?? null;
}
