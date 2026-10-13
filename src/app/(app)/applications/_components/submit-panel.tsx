"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SendIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cancelApplicationAction, confirmSubmittedAction, submitApplicationAction } from "../actions";

type Provider = "local" | "steel";

interface Props {
  applicationId: string;
  canSubmit: boolean;
  canCancel: boolean;
  /** المتصفحات المتاحة، الأول الافتراضي */
  providers: Provider[];
  steelMissing: string | null;
  /** أسئلة مطلوبة بدون إجابة: ما نبدأ التقديم وهي ناقصة */
  missing: number;
  quota: { used: number; limit: number } | null;
}

const PROVIDER_LABEL: Record<Provider, string> = { local: "Chrome على جهازك", steel: "Steel (سحابي)" };

const PROVIDER_TEXT: Record<Provider, string> = {
  local: "متصفح Chrome على جهازك (لازم `pnpm trigger:dev` شغّال). تقدر تتدخل في النافذة نفسها.",
  steel: "متصفح سحابي عند Steel بمفتاحك. لو احتجناك نوقف ونعرض لك البث المباشر.",
};

/** «قدّم الحين»: تأكيد صريح من المستخدم قبل أي إرسال (قاعدة 8) */
export function SubmitPanel({ applicationId, canSubmit, canCancel, providers, steelMissing, missing, quota }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<Provider | undefined>(providers[0]);
  const provider = choice && providers.includes(choice) ? choice : providers[0];
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
          {provider ? PROVIDER_TEXT[provider] : steelMissing}
          {left !== null && ` · باقي لك ${left} تقديم هذا الشهر.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {providers.length > 1 && (
          <div role="radiogroup" aria-label="المتصفح" className="flex flex-wrap gap-2">
            {providers.map((p) => (
              <Button
                key={p}
                type="button"
                size="sm"
                role="radio"
                aria-checked={provider === p}
                variant={provider === p ? "default" : "outline"}
                disabled={pending}
                onClick={() => setChoice(p)}
              >
                {PROVIDER_LABEL[p]}
              </Button>
            ))}
          </div>
        )}
        {provider === "local" && steelMissing && (
          <p className="text-xs text-muted-foreground">تبي تجرب Steel بدل جهازك؟ {steelMissing}</p>
        )}
        {missing > 0 && (
          <p className="text-sm text-destructive">
            {missing === 1 ? "فيه سؤال مطلوب بدون إجابة" : `فيه ${missing} أسئلة مطلوبة بدون إجابة`}: جاوبها تحت واحفظ، وبعدين قدّم.
          </p>
        )}
        {!confirming ? (
          <Button
            className="self-start"
            disabled={!provider || left === 0 || missing > 0 || pending}
            onClick={() => setConfirming(true)}
          >
            <SendIcon data-icon="inline-start" aria-hidden />
            قدّم الحين
          </Button>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
            <p className="text-sm">
              بنفتح صفحة التقديم الرسمية، نعبّي إجاباتك ونرفع سيرتك وخطابك، ونضغط «إرسال» باسمك. ما نعيد الإرسال تلقائيًا لو صار
              خطأ. نوقف وننتظرك بس لو الموقع طلب كابتشا أو رمز من بريدك.
            </p>
            <div className="flex gap-2">
              <Button
                disabled={pending || !provider}
                onClick={() => run(() => submitApplicationAction(applicationId, provider), "بدأ التقديم.")}
              >
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

/** محاولة إرسال بدون تأكيد: ما نعيد الإرسال، المستخدم يتحقق ويأكد بنفسه */
export function UnconfirmedAttempt({ applicationId, applyUrl }: { applicationId: string; applyUrl: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle>انضغط «إرسال» وما تأكدنا</CardTitle>
        <CardDescription>
          ما نعيد الإرسال تلقائيًا عشان ما يوصل طلبك مرتين. شيك بريدك: لو وصلك تأكيد من الشركة، أكّده هنا. ولو ما وصل، قدّم
          بنفسك من صفحة التقديم.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await confirmSubmittedAction(applicationId);
              if (!result.ok) toast.error(result.error);
              else toast.success("انسجّل كمُرسل.");
              router.refresh();
            })
          }
        >
          وصلني تأكيد، انرسل
        </Button>
        {applyUrl && (
          <Button asChild variant="outline">
            <a href={applyUrl} target="_blank" rel="noopener noreferrer nofollow">
              افتح صفحة التقديم
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
