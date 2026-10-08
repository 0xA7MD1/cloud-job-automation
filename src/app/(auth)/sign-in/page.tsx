import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSkeleton } from "../_components/form-skeleton";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default function SignInPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>تسجيل الدخول</CardTitle>
        <CardDescription>ادخل بحسابك عشان تكمل طلباتك.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* النموذج يقرأ ?next و?error من الرابط ⇒ داخل Suspense */}
        <Suspense fallback={<FormSkeleton />}>
          <SignInForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
