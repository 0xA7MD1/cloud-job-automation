import { createAdminClient } from "@insforge/sdk";
import { readEnv } from "@/lib/env";

type AdminClient = ReturnType<typeof createAdminClient>;

let client: AdminClient | undefined;

/**
 * عميل الأدمن: يتجاوز RLS وسياسات الملفات.
 *
 * - خادم بس: مهام Trigger.dev، ومسارات Vercel الي تكتب الجداول المشتركة
 *   (companies, jobs) أو تقرأ المفتاح المشفّر.
 * - على جداول المستخدم: فلتر user_id صريح في كل استعلام، دائمًا.
 *
 * ما يستورد "server-only" لأن مهام Trigger.dev تشتغل برّا Next، فنمنع
 * المتصفح بفحص وقت التشغيل.
 */
export function getInsForgeAdminClient(): AdminClient {
  if (typeof window !== "undefined") {
    throw new Error("عميل الأدمن ممنوع في المتصفح");
  }
  client ??= createAdminClient({
    baseUrl: readEnv("NEXT_PUBLIC_INSFORGE_URL"),
    apiKey: readEnv("INSFORGE_API_KEY"),
  });
  return client;
}
