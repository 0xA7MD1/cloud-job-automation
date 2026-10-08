"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAuthActions } from "@insforge/sdk/ssr";
import { authErrorMessage, needsEmailVerification } from "@/lib/auth-errors";
import { OAUTH_COOKIE_OPTIONS, OAUTH_NEXT_COOKIE, OAUTH_VERIFIER_COOKIE } from "@/lib/auth-cookies";
import { readEnv } from "@/lib/env";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { safeRedirectPath } from "@/lib/safe-redirect";

export interface AuthFormState {
  error?: string;
  message?: string;
  /** البريد الي ينتظر رمز التحقق */
  verifyEmail?: string;
  email?: string;
}

const email = z.email({ error: "اكتب بريد صحيح." }).max(254).transform((v) => v.trim().toLowerCase());
const password = z
  .string()
  .min(8, { error: "كلمة المرور 8 أحرف على الأقل." })
  .max(128, { error: "كلمة المرور طويلة مرة." });
const code = z.string().trim().regex(/^\d{6}$/, { error: "الرمز 6 أرقام." });

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "تأكد من البيانات.";
}

function appUrl(path: string): string {
  return new URL(path, readEnv("NEXT_PUBLIC_APP_URL")).toString();
}

// ---------------------------------------------------------------------------
// دخول بالبريد
// ---------------------------------------------------------------------------
export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({ email, password: z.string().min(1, { error: "اكتب كلمة المرور." }) })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: firstIssue(parsed.error), email: String(formData.get("email") ?? "") };

  const auth = createAuthActions({ cookies: await cookies() });
  const { error } = await auth.signInWithPassword(parsed.data);
  if (error) {
    if (needsEmailVerification(error)) return { verifyEmail: parsed.data.email };
    return { error: authErrorMessage(error), email: parsed.data.email };
  }

  redirect(safeRedirectPath(formData.get("next")));
}

// ---------------------------------------------------------------------------
// تسجيل جديد
// ---------------------------------------------------------------------------
export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({
      name: z.string().trim().min(1, { error: "اكتب اسمك." }).max(100),
      email,
      password,
    })
    .safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
  if (!parsed.success) return { error: firstIssue(parsed.error), email: String(formData.get("email") ?? "") };

  const auth = createAuthActions({ cookies: await cookies() });
  const { data, error } = await auth.signUp({
    ...parsed.data,
    // لو التحقق بالرابط: يرجع لصفحة الدخول. لازم يكون في قائمة الروابط المسموحة في InsForge.
    redirectTo: appUrl("/sign-in"),
  });
  if (error) return { error: authErrorMessage(error), email: parsed.data.email };
  if (data?.requireEmailVerification) return { verifyEmail: parsed.data.email };

  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// تأكيد البريد برمز من 6 أرقام
// ---------------------------------------------------------------------------
export async function verifyEmailAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({ email, otp: code })
    .safeParse({ email: formData.get("email"), otp: formData.get("code") });
  const pendingEmail = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: firstIssue(parsed.error), verifyEmail: pendingEmail };

  const auth = createAuthActions({ cookies: await cookies() });
  const { error } = await auth.verifyEmail(parsed.data);
  if (error) return { error: authErrorMessage(error), verifyEmail: parsed.data.email };

  redirect(safeRedirectPath(formData.get("next")));
}

export async function resendVerificationAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "اكتب بريد صحيح." };

  const insforge = await createInsForgeServerClient();
  await insforge.auth.resendVerificationEmail({ email: parsed.data, redirectTo: appUrl("/sign-in") });
  // نفس الرد سواء الحساب موجود أو لا
  return { message: "لو الحساب موجود وما تأكّد، وصلك رمز جديد.", verifyEmail: parsed.data };
}

// ---------------------------------------------------------------------------
// Google / Microsoft (PKCE: الرمز يتبدّل عند الخادم في /api/auth/callback)
// ---------------------------------------------------------------------------
const oauthProvider = z.enum(["google", "microsoft"]);

export async function oauthAction(formData: FormData): Promise<void> {
  const provider = oauthProvider.safeParse(formData.get("provider"));
  if (!provider.success) redirect("/sign-in?error=oauth");

  const cookieStore = await cookies();
  const auth = createAuthActions({ cookies: cookieStore });
  const { data, error } = await auth.signInWithOAuth(provider.data, {
    redirectTo: appUrl("/api/auth/callback"),
    skipBrowserRedirect: true,
  });
  if (error || !data.url || !data.codeVerifier) redirect("/sign-in?error=oauth");

  cookieStore.set(OAUTH_VERIFIER_COOKIE, data.codeVerifier, OAUTH_COOKIE_OPTIONS);
  cookieStore.set(OAUTH_NEXT_COOKIE, safeRedirectPath(formData.get("next")), OAUTH_COOKIE_OPTIONS);
  redirect(data.url);
}

// ---------------------------------------------------------------------------
// خروج
// ---------------------------------------------------------------------------
export async function signOutAction(): Promise<void> {
  const auth = createAuthActions({ cookies: await cookies() });
  await auth.signOut();
  redirect("/");
}

// ---------------------------------------------------------------------------
// نسيت كلمة المرور
// ---------------------------------------------------------------------------
export async function requestPasswordResetAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "اكتب بريد صحيح." };

  const insforge = await createInsForgeServerClient();
  await insforge.auth.sendResetPasswordEmail({ email: parsed.data, redirectTo: appUrl("/reset-password") });
  // نفس الرد دائمًا عشان ما نكشف وش الحسابات الموجودة
  return {
    message: "لو فيه حساب بهذا البريد، وصلك بريد فيه رابط أو رمز لتغيير كلمة المرور.",
    email: parsed.data,
  };
}

/**
 * تغيير كلمة المرور. طريقتين حسب إعداد InsForge:
 * - رابط: الصفحة تستلم token من الرابط مباشرة.
 * - رمز: المستخدم يكتب بريده والرمز، ونبدّله بـtoken أول.
 */
export async function resetPasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const newPassword = password.safeParse(formData.get("password"));
  if (!newPassword.success) return { error: firstIssue(newPassword.error) };

  const insforge = await createInsForgeServerClient();
  let token = String(formData.get("token") ?? "").trim();

  if (!token) {
    const parsed = z
      .object({ email, code })
      .safeParse({ email: formData.get("email"), code: formData.get("code") });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const { data, error } = await insforge.auth.exchangeResetPasswordToken(parsed.data);
    if (error || !data?.token) return { error: authErrorMessage(error) };
    token = data.token;
  }

  const { error } = await insforge.auth.resetPassword({ newPassword: newPassword.data, otp: token });
  if (error) return { error: authErrorMessage(error) };

  redirect("/sign-in?reset=1");
}
