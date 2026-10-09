"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SendIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cancelApplicationAction, submitApplicationAction } from "../actions";

interface Props {
  applicationId: string;
  canSubmit: boolean;
  canCancel: boolean;
  provider: "local" | "steel" | null;
  providerError: string | null;
  missing: number;
  quota: { used: number; limit: number } | null;
}

const PROVIDER_TEXT = {
  local: "متصفح Chrome على جهازك (لازم `pnpm trigger:dev` شغّال). تقدر تتدخل في النافذة نفسها.",
  steel: "متصفح سحابي عند Steel بمفتاحك. لو احتجناك نوقف ونعرض لك البث المباشر.",
};

/** «قدّم الحين»: تأكيد صريح من المستخدم قبل أي إرسال (قاعدة 8) */
export function SubmitPanel({ applicationId, canSubmit, canCancel, provider, providerError, missing, quota }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const left = quota ? Math.max(0, quota.limit - quota.used) : null;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) toast.error(result.error ?? "صار خطأ.");
      else toast.success(success);
      setConfirming(false);
      router.refresh();
    });

  if (canCancel) {
    return (
      <Button variant="outline" disabled={pending} onClick={() => run(() => cancelApplicationAction(applicationId), "انلغى.")}>
        <XIcon data-icon="inline-start" aria-hidden />
        ألغِ
      </Button>
    );
  }
  if (!canSubmit) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>التقديم</CardTitle>
        <CardDescription>
          {provider ? PROVIDER_TEXT[provider] : providerError}
          {left !== null && ` · باقي لك ${left} تقديم هذا الشهر.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!confirming ? (
          <Button className="self-start" disabled={!provider || left === 0 || pending} onClick={() => setConfirming(true)}>
            <SendIcon data-icon="inline-start" aria-hidden />
            قدّم الحين
          </Button>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
            <p className="text-sm">
              بنفتح صفحة التقديم الرسمية، نعبّي إجاباتك ونرفع سيرتك وخطابك، ونضغط «إرسال» باسمك. ما نعيد الإرسال تلقائيًا لو صار
              خطأ.
              {missing > 0 && ` فيه ${missing} حقل مطلوب بدون إجابة: بنوقف وننتظرك تكمّله.`}
            </p>
            <div className="flex gap-2">
              <Button disabled={pending} onClick={() => run(() => submitApplicationAction(applicationId), "بدأ التقديم.")}>
                {pending ? "نبدأ..." : "أكّد وقدّم"}
              </Button>
              <Button variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
                تراجع
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
