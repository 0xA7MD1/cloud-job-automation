"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, CtaIcon } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { resetPasswordAction, type AuthFormState } from "../actions";

export function ResetPasswordForm() {
  const params = useSearchParams();
  // طريقة الرابط: InsForge يرجّع token في الرابط. طريقة الرمز: ما فيه token.
  const token = params.get("token") ?? "";
  const linkBroken = params.get("insforge_type") === "reset_password" && params.get("insforge_status") === "error";
  const [state, action, pending] = useActionState<AuthFormState, FormData>(resetPasswordAction, {});

  if (linkBroken) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          الرابط غلط أو انتهت صلاحيته.{" "}
          <Link href="/forgot-password" className="underline">
            اطلب رابط جديد
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <FieldGroup>
        {!token && (
          <>
            <Field>
              <FieldLabel htmlFor="email">البريد</FieldLabel>
              <Input id="email" name="email" type="email" autoComplete="email" dir="ltr" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="code">الرمز</FieldLabel>
              <Input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                dir="ltr"
                required
              />
              <FieldDescription>الرمز الي وصلك بالبريد (6 أرقام).</FieldDescription>
            </Field>
          </>
        )}
        <Field data-invalid={!!state.error}>
          <FieldLabel htmlFor="password">كلمة المرور الجديدة</FieldLabel>
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
          <FieldError>{state.error}</FieldError>
        </Field>
        <Button type="submit" variant="cta" size="lg" className="w-full justify-between ps-5" disabled={pending}>
          {pending ? "جاري الحفظ…" : "احفظ كلمة المرور"}
          <CtaIcon />
        </Button>
      </FieldGroup>
    </form>
  );
}
