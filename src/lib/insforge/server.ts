import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@insforge/sdk/ssr";

/**
 * عميل بجلسة المستخدم الحالي (Server Components / Server Actions / Route Handlers).
 * يرسل توكن الدخول، فـRLS وسياسات الملفات تشتغل عليه.
 */
export async function createInsForgeServerClient() {
  return createServerClient({ cookies: await cookies() });
}
