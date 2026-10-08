import { NextResponse, type NextRequest } from "next/server";
import { createAuthActions } from "@insforge/sdk/ssr";
import { OAUTH_NEXT_COOKIE, OAUTH_VERIFIER_COOKIE } from "@/lib/auth-cookies";
import { safeRedirectPath } from "@/lib/safe-redirect";

// رجوع Google/Microsoft: نبدّل الرمز بجلسة عند الخادم عشان توكن التجديد
// ينحفظ في كوكي httpOnly.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("insforge_code");
  const verifier = request.cookies.get(OAUTH_VERIFIER_COOKIE)?.value;
  const next = safeRedirectPath(request.cookies.get(OAUTH_NEXT_COOKIE)?.value);

  const fail = () => {
    const response = NextResponse.redirect(new URL("/sign-in?error=oauth", request.url));
    response.cookies.delete(OAUTH_VERIFIER_COOKIE);
    response.cookies.delete(OAUTH_NEXT_COOKIE);
    return response;
  };

  if (!code || !verifier) return fail();

  const response = NextResponse.redirect(new URL(next, request.url));
  const auth = createAuthActions({
    requestCookies: request.cookies,
    responseCookies: response.cookies,
  });
  const { error } = await auth.exchangeOAuthCode(code, verifier);
  if (error) return fail();

  response.cookies.delete(OAUTH_VERIFIER_COOKIE);
  response.cookies.delete(OAUTH_NEXT_COOKIE);
  return response;
}
