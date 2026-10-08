import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "حساب جديد" };

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>حساب جديد</CardTitle>
        <CardDescription>مجاني. مفاتيح المزودين تضيفها بعد الدخول.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm />
      </CardContent>
    </Card>
  );
}
