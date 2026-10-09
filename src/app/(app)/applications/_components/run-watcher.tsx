"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { Loader2Icon } from "lucide-react";
import { STEP_LABELS } from "@/lib/apply/labels";

interface Props {
  runId: string | null;
  accessToken: string | null;
  /** نص احتياطي لو ما فيه اتصال حي */
  fallback: string;
}

/**
 * يتابع مهمة شغّالة. مع توكن: Trigger.dev Realtime (الخطوة الحالية مباشرة).
 * بدونه (أو لو تعدّينا حد الاتصالات الحية): يحدّث الصفحة من القاعدة كل 4 ثواني.
 */
export function RunWatcher({ runId, accessToken, fallback }: Props) {
  const router = useRouter();
  const live = !!(runId && accessToken);
  const { run, error } = useRealtimeRun(runId ?? undefined, {
    accessToken: accessToken ?? undefined,
    enabled: live,
    onComplete: () => router.refresh(),
  });
  const lastStep = useRef<string | null>(null);

  const step = typeof run?.metadata?.step === "string" ? run.metadata.step : null;

  // الحالة الدائمة في القاعدة: نحدّث الصفحة لما تتغير الخطوة أو لو ما فيه اتصال حي
  useEffect(() => {
    if (step && step !== lastStep.current) {
      lastStep.current = step;
      router.refresh();
    }
  }, [step, router]);

  useEffect(() => {
    if (live && !error) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [live, error, router]);

  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
      <Loader2Icon className="size-4 animate-spin" aria-hidden />
      {(step && STEP_LABELS[step]) || fallback}
    </p>
  );
}
