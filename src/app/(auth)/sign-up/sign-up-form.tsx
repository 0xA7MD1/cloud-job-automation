"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OAuthButtons } from "../_components/oauth-buttons";
import { VerifyEmailForm } from "../_components/verify-email-form";
import { signUpAction, type AuthFormState } from "../actions";

export function SignUpForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signUpAction, {});

  if (state.verifyEmail) return <VerifyEmailForm email={state.verifyEmail} next="/dashboard" />;

  return (
    <div className="flex flex-col gap-6">
      <form action={action}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="name">الاسم</FieldLabel>
            <Input id="name" name="name" autoComplete="name" maxLength={100} required />
          </Field>
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
            <FieldLabel htmlFor="password">كلمة المرور</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              dir="ltr"
              required
              aria-invalid={!!state.error}
            />
            <FieldDescription>8 أحرف أو أكثر.</FieldDescription>
            <FieldError>{state.error}</FieldError>
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? "جاري إنشاء الحساب…" : "إنشاء حساب"}
          </Button>
        </FieldGroup>
      </form>
      <FieldSeparator>أو</FieldSeparator>
      <OAuthButtons next="/dashboard" />
      <p className="text-center text-sm text-muted-foreground">
        عندك حساب؟{" "}
        <Link href="/sign-in" className="text-foreground underline-offset-4 hover:underline">
          سجّل دخول
        </Link>
      </p>
    </div>
  );
}
