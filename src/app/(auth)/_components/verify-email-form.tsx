"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { resendVerificationAction, verifyEmailAction, type AuthFormState } from "../actions";

export function VerifyEmailForm({ email, next }: { email: string; next: string }) {
  const [state, verify, verifying] = useActionState<AuthFormState, FormData>(verifyEmailAction, {});
  const [resent, resend, resending] = useActionState<AuthFormState, FormData>(resendVerificationAction, {});

  return (
    <form action={verify}>
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="next" value={next} />
      <FieldGroup>
        <p className="text-sm text-muted-foreground">
          أرسلنا لـ<span className="font-medium text-foreground" dir="ltr">{email}</span> رمز من 6 أرقام.
          لو وصلك رابط بدل الرمز، اضغطه وارجع سجّل دخول.
        </p>
        <Field data-invalid={!!state.error}>
          <FieldLabel htmlFor="code">رمز التحقق</FieldLabel>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            dir="ltr"
            required
            aria-invalid={!!state.error}
          />
          <FieldError>{state.error}</FieldError>
          <FieldDescription>الرمز صالح لفترة قصيرة.</FieldDescription>
        </Field>
        <Button type="submit" disabled={verifying}>
          {verifying ? "جاري التأكيد…" : "تأكيد البريد"}
        </Button>
        <Button type="submit" variant="ghost" formAction={resend} formNoValidate disabled={resending}>
          {resending ? "جاري الإرسال…" : "أرسل رمز جديد"}
        </Button>
        {(resent.message || resent.error) && (
          <Alert>
            <AlertDescription>{resent.message ?? resent.error}</AlertDescription>
          </Alert>
        )}
      </FieldGroup>
    </form>
  );
}
