"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { OAuthButtons } from "../_components/oauth-buttons";
import { VerifyEmailForm } from "../_components/verify-email-form";
import { signInAction, type AuthFormState } from "../actions";

function bannerFrom(params: URLSearchParams): { tone: "ok" | "error"; text: string } | null {
  if (params.get("reset") === "1") return { tone: "ok", text: "تغيّرت كلمة المرور. سجّل دخول بالجديدة." };
  if (params.get("error") === "oauth") return { tone: "error", text: "ما قدرنا نكمل الدخول بالحساب الخارجي. جرّب مرة ثانية." };
  if (params.get("insforge_type") === "verify_email") {
    return params.get("insforge_status") === "success"
      ? { tone: "ok", text: "تأكّد بريدك. سجّل دخول الحين." }
      : { tone: "error", text: "رابط التأكيد غلط أو انتهى. سجّل دخول وبنرسل لك رمز جديد." };
  }
  return null;
}

export function SignInForm() {
  const params = useSearchParams();
  const next = safeRedirectPath(params.get("next"));
  const banner = bannerFrom(params);
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signInAction, {});

  if (state.verifyEmail) return <VerifyEmailForm email={state.verifyEmail} next={next} />;

  return (
    <div className="flex flex-col gap-6">
      {banner && (
        <Alert variant={banner.tone === "error" ? "destructive" : "default"}>
          <AlertDescription>{banner.text}</AlertDescription>
        </Alert>
      )}
      <form action={action}>
        <input type="hidden" name="next" value={next} />
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">البريد</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              dir="ltr"
              defaultValue={state.email}
              required
            />
          </Field>
          <Field data-invalid={!!state.error}>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">كلمة المرور</FieldLabel>
              <Link href="/forgot-password" className="text-sm text-muted-foreground hover:underline">
                نسيتها؟
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              dir="ltr"
              required
              aria-invalid={!!state.error}
            />
            <FieldError>{state.error}</FieldError>
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? "جاري الدخول…" : "دخول"}
          </Button>
        </FieldGroup>
      </form>
      <FieldSeparator>أو</FieldSeparator>
      <OAuthButtons next={next} />
      <p className="text-center text-sm text-muted-foreground">
        ما عندك حساب؟{" "}
        <Link href="/sign-up" className="text-foreground underline-offset-4 hover:underline">
          سجّل الحين
        </Link>
      </p>
    </div>
  );
}
