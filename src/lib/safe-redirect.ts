const FALLBACK = "/dashboard";

/**
 * يقبل مسار داخلي بس (يبدأ بـ/ ومو //). أي شي ثاني ⇒ /dashboard.
 * يمنع استغلال ?next= للتحويل لموقع خارجي بعد تسجيل الدخول.
 */
export function safeRedirectPath(value: unknown, fallback: string = FALLBACK): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 500) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  try {
    const url = new URL(value, "http://internal.invalid");
    if (url.origin !== "http://internal.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
