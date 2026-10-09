import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@insforge/sdk/ssr/middleware";

// المسارات الي تحتاج دخول. هذا فحص سريع للتحويل بس؛ كل صفحة تتحقق بنفسها
// عبر requireUser() لأن الـproxy مو حماية كافية لحاله.
const PROTECTED_PREFIXES = ["/dashboard", "/chat", "/jobs", "/applications", "/files", "/profile", "/settings"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
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

  const { pathname, search } = request.nextUrl;
  const response =
    !accessToken && isProtected(pathname)
      ? NextResponse.redirect(
          new URL(`/sign-in?next=${encodeURIComponent(pathname + search)}`, request.url),
        )
      : NextResponse.next({ request: { headers: request.headers } });

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
