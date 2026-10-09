"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BellIcon, BellOffIcon, BookmarkCheckIcon, BookmarkIcon, EyeOffIcon, SendIcon, Undo2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startApplicationAction } from "../../applications/actions";
import { followCompanyAction, setJobStatusAction, unfollowCompanyAction, type JobActionResult } from "../actions";

type JobStatus = "new" | "saved" | "dismissed";

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<JobActionResult>, success?: string, onOk?: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (success) toast.success(success);
      onOk?.();
      router.refresh();
    });
  return { pending, run };
}

export function JobStatusButtons({ jobId, status: initial }: { jobId: string; status: JobStatus }) {
  const [status, setStatus] = useState<JobStatus>(initial);
  const { pending, run } = useAction();
  const set = (next: JobStatus, message: string) =>
    run(() => setJobStatusAction(jobId, next), message, () => setStatus(next));

  if (status === "dismissed") {
    return (
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => set("new", "رجعت للقائمة.")}>
        <Undo2Icon data-icon="inline-start" aria-hidden />
        رجّعها
      </Button>
    );
  }
  return (
    <div className="flex gap-1">
      {status === "saved" ? (
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => set("new", "انشالت من المحفوظة.")}>
          <BookmarkCheckIcon data-icon="inline-start" aria-hidden />
          محفوظة
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => set("saved", "انحفظت.")}>
          <BookmarkIcon data-icon="inline-start" aria-hidden />
          احفظ
        </Button>
      )}
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => set("dismissed", "انستبعدت.")} aria-label="استبعد">
        <EyeOffIcon aria-hidden />
      </Button>
    </div>
  );
}

export function FollowButton({ companyId, following: initial }: { companyId: string; following: boolean }) {
  const [following, setFollowing] = useState(initial);
  const { pending, run } = useAction();
  return following ? (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => run(() => unfollowCompanyAction(companyId), "ألغيت المتابعة.", () => setFollowing(false))}
    >
      <BellOffIcon data-icon="inline-start" aria-hidden />
      إلغاء المتابعة
    </Button>
  ) : (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        run(() => followCompanyAction(companyId), "تابعتها: نفحص وظائفها مرتين باليوم.", () => setFollowing(true))
      }
    >
      <BellIcon data-icon="inline-start" aria-hidden />
      تابع
    </Button>
  );
}

/** يبدأ تجهيز الطلب (أسئلة + إجابات + خطاب) ويفتح صفحة المراجعة */
export function PrepareButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await startApplicationAction(jobId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          router.push(`/applications/${result.data.id}`);
        })
      }
    >
      <SendIcon data-icon="inline-start" aria-hidden />
      {pending ? "نجهّز..." : "جهّز الطلب"}
    </Button>
  );
}
