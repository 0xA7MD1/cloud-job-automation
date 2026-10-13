import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@insforge/sdk/ssr";
import { updateSession } from "@insforge/sdk/ssr/middleware";
import { safeRedirectPath } from "@/lib/safe-redirect";

// المسارات الي تحتاج دخول. هذا فحص سريع للتحويل بس؛ كل صفحة تتحقق بنفسها
// عبر requireUser() لأن الـproxy مو حماية كافية لحاله.
const PROTECTED_PREFIXES = ["/dashboard", "/chat", "/jobs", "/applications", "/files", "/profile", "/settings"];

// صفحات الدخول: المسجّل يتحوّل منها للتطبيق مباشرة (أزرار الصفحة الرئيسية توديه لها)
const AUTH_PAGES = ["/sign-in", "/sign-up"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * updateSession يفك الكوكي بس وما يتحقق من التوكن. نسأل InsForge قبل التحويل،
 * وإلا توكن مرفوض عنده يدوّر بين /sign-in و/dashboard (requireUser يرجّعه للدخول).
 */
async function hasValidSession(accessToken: string): Promise<boolean> {
  const { data, error } = await createServerClient({ accessToken }).auth.getCurrentUser();
  return !error && !!data.user;
}

export async function proxy(request: NextRequest) {
  // قبل ما ينضبط InsForge في .env.local: لا تكسر الصفحات العامة.
  if (!process.env.NEXT_PUBLIC_INSFORGE_URL || !process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY) {
    return NextResponse.next();
  }

  // updateSession يجدّد التوكن لو قارب ينتهي، ويكتبه في كوكيز الطلب (عشان
  // Server Components تشوفه) وفي كوكيز الرد (عشان المتصفح يحفظه).
  const cookieChanges = NextResponse.next();
  const { accessToken } = await updateSession({
    requestCookies: request.cookies,
    responseCookies: cookieChanges.cookies,
  });

  const { pathname, search, searchParams } = request.nextUrl;
  let response: NextResponse;
  if (!accessToken && isProtected(pathname)) {
    response = NextResponse.redirect(new URL(`/sign-in?next=${encodeURIComponent(pathname + search)}`, request.url));
  } else if (accessToken && AUTH_PAGES.includes(pathname) && (await hasValidSession(accessToken))) {
    response = NextResponse.redirect(new URL(safeRedirectPath(searchParams.get("next")), request.url));
  } else {
    response = NextResponse.next({ request: { headers: request.headers } });
  }

  for (const cookie of cookieChanges.cookies.getAll()) {
    response.cookies.set(cookie);
  }
  return response;
}

export const config = {
  matcher: [
    // كل شي ما عدا ملفات Next الثابتة ومسار التجديد نفسه
    "/((?!_next/static|_next/image|api/auth/refresh|icon.svg|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
