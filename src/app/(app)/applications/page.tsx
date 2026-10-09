import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_LABELS, STATUS_TONE } from "@/lib/apply/labels";
import { requireUser } from "@/lib/auth";
import type { Application, ApplicationStatus, Company, Job, MonthlyApplyUsage } from "@/lib/db/types";
import { formatDateTime } from "@/lib/format";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "الطلبات" };

const TABS = [
  { id: "review", label: "للمراجعة", statuses: ["draft", "preparing", "ready", "failed"] },
  { id: "active", label: "جارية", statuses: ["queued", "running", "needs_user"] },
  { id: "submitted", label: "انرسلت", statuses: ["submitted"] },
  { id: "cancelled", label: "ملغاة", statuses: ["cancelled"] },
] as const satisfies readonly { id: string; label: string; statuses: readonly ApplicationStatus[] }[];
type TabId = (typeof TABS)[number]["id"];

type Row = Pick<Application, "id" | "status" | "status_detail" | "updated_at" | "submitted_at" | "confirmation_ref"> & {
  job: Pick<Job, "title" | "location"> & { company: Pick<Company, "name"> | null };
};

export default function ApplicationsPage({ searchParams }: PageProps<"/applications">) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">الطلبات</h1>
        <p className="text-muted-foreground">جهّز الطلب من صفحة الوظائف أو الشات، راجعه هنا، وبعدها قدّم بضغطة.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ApplicationsSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ApplicationsSection({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).tab;
  const tab = TABS.find((t) => t.id === raw) ?? TABS[0];

  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const [{ data }, { data: usage }, { data: counts }] = await Promise.all([
    insforge.database
      .from("applications")
      .select("id, status, status_detail, updated_at, submitted_at, confirmation_ref, job:jobs(title, location, company:companies(name))")
      .eq("user_id", user.id)
      .in("status", [...tab.statuses])
      .order("updated_at", { ascending: false })
      .limit(200),
    insforge.database.rpc("monthly_apply_usage"),
    insforge.database.from("applications").select("status").eq("user_id", user.id),
  ]);
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.job);
  const quota = (Array.isArray(usage) ? usage[0] : usage) as MonthlyApplyUsage | undefined;
  const byStatus = new Map<string, number>();
  for (const r of (counts ?? []) as { status: string }[]) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
  const countOf = (id: TabId) =>
    (TABS.find((t) => t.id === id)?.statuses ?? []).reduce((sum, s) => sum + (byStatus.get(s) ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      {quota && (
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <div className="flex justify-between text-sm">
            <span>تقديمات هذا الشهر</span>
            <span dir="ltr">
              {quota.used} / {quota.apply_limit}
            </span>
          </div>
          <Progress value={quota.apply_limit ? Math.min(100, (quota.used / quota.apply_limit) * 100) : 100} />
        </div>
      )}

      <nav className="flex gap-1 rounded-lg bg-muted p-1 text-sm" aria-label="حالة الطلبات">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/applications?tab=${t.id}`}
            aria-current={t.id === tab.id ? "page" : undefined}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-center text-muted-foreground",
              t.id === tab.id && "bg-background font-medium text-foreground shadow-sm",
            )}
          >
            {t.label}
            {countOf(t.id) > 0 && <span className="ms-1 text-xs">({countOf(t.id)})</span>}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">ما فيه طلبات هنا.</p>
          {tab.id === "review" && (
            <Button asChild size="sm">
              <Link href="/jobs">اختر وظيفة</Link>
            </Button>
          )}
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/applications/${r.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-muted/50">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-medium" dir="auto">
                    {r.job.title}
                  </span>
                  <span className="text-sm text-muted-foreground" dir="auto">
                    {[r.job.company?.name, r.job.location].filter(Boolean).join(" · ")}
                  </span>
                  {r.status_detail && (
                    <span className="line-clamp-1 text-xs text-muted-foreground">{r.status_detail}</span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={STATUS_TONE[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(r.submitted_at ?? r.updated_at)}
                    {r.confirmation_ref ? ` · ${r.confirmation_ref}` : ""}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
