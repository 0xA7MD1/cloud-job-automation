"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, CtaIcon } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestPasswordResetAction, type AuthFormState } from "../actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(requestPasswordResetAction, {});

  if (state.message) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
        <p className="text-sm text-muted-foreground">
          وصلك رمز بدل الرابط؟{" "}
          <Link href="/reset-password" className="text-foreground underline-offset-4 hover:underline">
            اكتب الرمز هنا
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={action}>
      <FieldGroup>
        <Field data-invalid={!!state.error}>
          <FieldLabel htmlFor="email">البريد</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" dir="ltr" required />
          <FieldError>{state.error}</FieldError>
        </Field>
        <Button type="submit" variant="cta" size="lg" className="w-full justify-between ps-5" disabled={pending}>
          {pending ? "جاري الإرسال…" : "أرسل رابط التغيير"}
          <CtaIcon />
        </Button>
        <Link href="/sign-in" className="text-center text-sm text-muted-foreground hover:underline">
          رجوع لتسجيل الدخول
        </Link>
      </FieldGroup>
    </form>
  );
}
