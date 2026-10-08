import { z } from "zod";

// شكل profiles.answers و profiles.preferences. نفس المخطط يقرأه تجهيز الطلب
// (الخطوة 7) عشان يعبّي أسئلة النماذج المتكررة بدون ما يسأل الذكاء كل مرة.

const text = (max: number) => z.string().trim().max(max).optional().default("");
const yesNo = z.enum(["", "yes", "no"]).optional().default("");

/** أسئلة تتكرر في أغلب نماذج Greenhouse / Lever / Ashby */
export const STANDARD_QUESTIONS = [
  { key: "work_authorization", label: "يحق لك العمل في بلد الوظيفة؟ (اكتب البلدان)", type: "text" },
  { key: "requires_sponsorship", label: "تحتاج كفالة/تأشيرة عمل؟", type: "yesno" },
  { key: "willing_to_relocate", label: "مستعد تنتقل لمدينة ثانية؟", type: "yesno" },
  { key: "notice_period", label: "مدة الإشعار عند جهتك الحالية", type: "text" },
  { key: "earliest_start_date", label: "أقرب تاريخ تقدر تبدأ فيه", type: "text" },
  { key: "expected_salary", label: "الراتب المتوقع (مع العملة)", type: "text" },
  { key: "languages", label: "اللغات ومستواك فيها", type: "text" },
  { key: "how_did_you_hear", label: "كيف عرفت عن الوظيفة؟", type: "text" },
] as const;

export type StandardQuestionKey = (typeof STANDARD_QUESTIONS)[number]["key"];

export const answersSchema = z.object({
  work_authorization: text(300),
  requires_sponsorship: yesNo,
  willing_to_relocate: yesNo,
  notice_period: text(100),
  earliest_start_date: text(100),
  expected_salary: text(100),
  languages: text(300),
  how_did_you_hear: text(200),
  /** أسئلة الهوية الطوعية (الجنس، العرق...) نرفض الإجابة عليها دائمًا إلا لو المستخدم غيّر هذا */
  decline_voluntary_disclosures: z.boolean().optional().default(true),
  /** أسئلة وأجوبة إضافية يكتبها المستخدم */
  custom: z
    .array(z.object({ question: z.string().trim().min(1).max(500), answer: z.string().trim().max(2000) }))
    .max(50)
    .optional()
    .default([]),
});
export type Answers = z.infer<typeof answersSchema>;

export const WORKPLACE_OPTIONS = [
  { value: "any", label: "أي نوع" },
  { value: "remote", label: "عن بعد" },
  { value: "hybrid", label: "هجين" },
  { value: "onsite", label: "من المكتب" },
] as const;

const list = (maxItems: number) =>
  z.array(z.string().trim().min(1).max(100)).max(maxItems).optional().default([]);

export const preferencesSchema = z.object({
  target_roles: list(20),
  locations: list(20),
  workplace: z.enum(["any", "remote", "hybrid", "onsite"]).optional().default("any"),
  /** كلمات لو ظهرت في عنوان الوظيفة نستبعدها (مثل: Senior, Intern) */
  exclude_keywords: list(30),
});
export type Preferences = z.infer<typeof preferencesSchema>;

export function readAnswers(value: unknown): Answers {
  const parsed = answersSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : answersSchema.parse({});
}

export function readPreferences(value: unknown): Preferences {
  const parsed = preferencesSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : preferencesSchema.parse({});
}

/** "a, b،c\nd" ⇒ ["a","b","c","d"] (فواصل عربية وإنجليزية وأسطر) */
export function splitList(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(/[,،\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
