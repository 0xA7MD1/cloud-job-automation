import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FileCheck2Icon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SegmentedNav } from "@/components/segmented-nav";
import { Badge } from "@/components/ui/badge";
import { Button, CtaIcon } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_LABELS, STATUS_TONE } from "@/lib/apply/labels";
import { requireUser } from "@/lib/auth";
import type { Application, ApplicationStatus, Company, Job, MonthlyApplyUsage } from "@/lib/db/types";
import { formatDateTime } from "@/lib/format";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export const metadata: Metadata = { title: "الطلبات" };

const TABS = [
  { id: "review", label: "للمراجعة", statuses: ["draft", "preparing", "ready", "failed"] },
  { id: "input", label: "ينتظر جوابك", statuses: ["needs_input"] },
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
      <PageHeader
        title="الطلبات"
        description="جهّز طلب أو حدّد وظائف كثيرة من صفحة الوظائف وقدّم عليها دفعة وحدة. الي ينقصه جوابك يستناك هنا."
      >
        <Button asChild variant="cta">
          <Link href="/jobs">
            اختر وظيفة
            <CtaIcon />
          </Link>
        </Button>
      </PageHeader>
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
        <div className="flex flex-col gap-2 rounded-2xl border border-hairline bg-card/50 p-4">
          <div className="flex justify-between text-sm">
            <span>تقديمات هذا الشهر</span>
            <span dir="ltr">
              {quota.used} / {quota.apply_limit}
            </span>
          </div>
          <Progress value={quota.apply_limit ? Math.min(100, (quota.used / quota.apply_limit) * 100) : 100} />
        </div>
      )}

      <SegmentedNav
        label="حالة الطلبات"
        items={TABS.map((t) => ({
          href: `/applications?tab=${t.id}`,
          active: t.id === tab.id,
          label: (
            <>
              {t.label}
              {countOf(t.id) > 0 && <span className="ms-1 text-xs tabular-nums">({countOf(t.id)})</span>}
            </>
          ),
        }))}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={FileCheck2Icon}
          action={
            tab.id === "review" && (
              <Button asChild variant="glass" size="sm">
                <Link href="/jobs">اختر وظيفة</Link>
              </Button>
            )
          }
        >
          ما فيه طلبات هنا.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-card/50">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/applications/${r.id}`} className="flex flex-wrap items-center gap-3 p-4 outline-none transition-colors hover:bg-foreground/5 focus-visible:bg-foreground/5">
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
