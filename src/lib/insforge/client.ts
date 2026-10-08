import { createBrowserClient } from "@insforge/sdk/ssr";

type BrowserClient = ReturnType<typeof createBrowserClient>;

let client: BrowserClient | undefined;

/**
 * عميل المتصفح بجلسة المستخدم (Client Components بس). يقرأ توكن الدخول من
 * الكوكي ويجدّده عبر /api/auth/refresh. ما فيه دوال تسجيل دخول/خروج: هذي في
 * Server Actions عشان الكوكيز تبقى عند الخادم.
 * ينشأ عند أول استخدام عشان ما يتطلب env وقت البناء.
 */
export function getInsForgeBrowserClient(): BrowserClient {
  client ??= createBrowserClient();
  return client;
}
