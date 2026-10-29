import { z } from "zod";

// متغيرات الخادم. نتحقق منها وقت الاستخدام، مو وقت الاستيراد، عشان البناء
// يشتغل بدون أسرار. لا تستورد هذا الملف في مكوّن عميل.
const schema = {
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_INSFORGE_URL: z.url(),
  NEXT_PUBLIC_INSFORGE_ANON_KEY: z.string().min(1),
  INSFORGE_API_KEY: z.string().min(1),
  BYOK_MASTER_KEY: z
    .string()
    .refine((value) => Buffer.from(value, "base64").length === 32, {
      message: "لازم يكون 32 بايت بترميز base64",
    }),
  TRIGGER_SECRET_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
} as const;

export type EnvName = keyof typeof schema;

export function readEnv<K extends EnvName>(
  name: K,
  source: Record<string, string | undefined> = process.env,
): z.output<(typeof schema)[K]> {
  const result = schema[name].safeParse(source[name]);
  if (!result.success) {
    // اسم المتغير بس، بدون قيمته.
    throw new Error(
      `متغير البيئة ${name} ناقص أو قيمته غلط. شوف .env.example`,
    );
  }
  return result.data as z.output<(typeof schema)[K]>;
}
