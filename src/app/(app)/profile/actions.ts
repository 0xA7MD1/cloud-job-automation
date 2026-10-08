"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { STANDARD_QUESTIONS, answersSchema, preferencesSchema, splitList } from "@/lib/profile";

export interface ProfileFormState {
  ok?: boolean;
  error?: string;
  savedAt?: number;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), { error: "الروابط لازم تبدأ بـhttps://" })
  .transform((v) => (v === "" ? null : v));

const profileSchema = z.object({
  full_name: optionalText(200),
  phone: optionalText(40),
  city: optionalText(120),
  country: optionalText(120),
  headline: optionalText(300),
  summary: optionalText(5000),
  years_experience: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 60), { error: "سنوات الخبرة رقم من 0 إلى 60." }),
  linkedin_url: optionalUrl,
  github_url: optionalUrl,
  portfolio_url: optionalUrl,
  default_cv_file_id: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || z.uuid().safeParse(v).success),
});

const str = (formData: FormData, key: string) => String(formData.get(key) ?? "");

export async function saveProfileAction(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const profile = profileSchema.safeParse(
    Object.fromEntries(Object.keys(profileSchema.shape).map((key) => [key, str(formData, key)])),
  );
  if (!profile.success) return { error: profile.error.issues[0]?.message ?? "تأكد من البيانات." };

  const questions = formData.getAll("custom_question").map(String);
  const replies = formData.getAll("custom_answer").map(String);
  const answers = answersSchema.safeParse({
    ...Object.fromEntries(STANDARD_QUESTIONS.map((q) => [q.key, str(formData, q.key)])),
    decline_voluntary_disclosures: formData.get("decline_voluntary_disclosures") === "on",
    custom: questions
      .map((question, i) => ({ question: question.trim(), answer: (replies[i] ?? "").trim() }))
      .filter((row) => row.question),
  });
  if (!answers.success) return { error: "بنك الإجابات فيه قيمة طويلة مرة أو ناقصة." };

  const preferences = preferencesSchema.safeParse({
    target_roles: splitList(formData.get("target_roles")),
    locations: splitList(formData.get("locations")),
    workplace: str(formData, "workplace") || "any",
    exclude_keywords: splitList(formData.get("exclude_keywords")),
  });
  if (!preferences.success) return { error: "التفضيلات فيها عناصر كثيرة أو طويلة." };

  const user = await requireUser();
  const insforge = await createInsForgeServerClient();

  // السيرة الافتراضية لازم تكون من ملفات المستخدم نفسه (المفتاح الخارجي يتأكد إنها موجودة بس)
  if (profile.data.default_cv_file_id) {
    const { data: cv } = await insforge.database
      .from("files")
      .select("id")
      .eq("id", profile.data.default_cv_file_id)
      .eq("user_id", user.id)
      .eq("kind", "cv")
      .maybeSingle();
    if (!cv) return { error: "السيرة المختارة مو موجودة." };
  }

  const { error } = await insforge.database.from("profiles").upsert(
    {
      user_id: user.id,
      ...profile.data,
      answers: answers.data,
      preferences: preferences.data,
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: "ما قدرنا نحفظ الملف الشخصي." };
  return { ok: true, savedAt: Date.now() };
}
