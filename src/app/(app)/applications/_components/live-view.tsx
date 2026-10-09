"use client";

import { useState, useTransition } from "react";
import { ExternalLinkIcon, MonitorPlayIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * البث الحي التفاعلي لجلسة Steel (لصاحب الطلب بس). الرابط ينجاب وقت الضغط من
 * مسار موثّق ويبقى في ذاكرة الصفحة: ما ينحفظ ولا ينطبع.
 */
export function LiveView({ applicationId, reason }: { applicationId: string; reason: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const open = () =>
    startTransition(async () => {
      const response = await fetch(`/api/applications/${applicationId}/live`, { cache: "no-store" }).catch(() => null);
      const body = response?.ok ? ((await response.json()) as { url?: string }) : null;
      if (!body?.url) {
        toast.error("الجلسة خلصت أو ما بدأت. حدّث الصفحة.");
        return;
      }
      setUrl(body.url);
    });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex flex-col gap-1">
        <span className="font-medium">ينتظر تدخلك</span>
        {reason && <span className="text-sm text-muted-foreground">{reason}</span>}
        <span className="text-xs text-muted-foreground">
          عندك حتى 10 دقائق. بعدها نسكّر المتصفح، وما نعيد الإرسال تلقائيًا.
        </span>
      </div>
      {!url ? (
        <Button className="self-start" onClick={open} disabled={pending}>
          <MonitorPlayIcon data-icon="inline-start" aria-hidden />
          {pending ? "نفتح..." : "افتح المتصفح المباشر"}
        </Button>
      ) : (
        <>
          <iframe
            src={url}
            title="المتصفح المباشر"
            className="h-[640px] w-full rounded-md border bg-background"
            allow="clipboard-read; clipboard-write"
            referrerPolicy="no-referrer"
          />
          <Button asChild variant="outline" size="sm" className="self-start">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon data-icon="inline-start" aria-hidden />
              افتحه في نافذة مستقلة
            </a>
          </Button>
        </>
      )}
    </div>
  );
}
