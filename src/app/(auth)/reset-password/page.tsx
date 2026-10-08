import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSkeleton } from "../_components/form-skeleton";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "كلمة مرور جديدة" };

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>كلمة مرور جديدة</CardTitle>
        <CardDescription>اختر كلمة مرور ما استخدمتها قبل.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<FormSkeleton fields={3} />}>
          <ResetPasswordForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
