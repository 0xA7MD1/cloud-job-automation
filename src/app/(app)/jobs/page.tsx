import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { STATUS_LABELS } from "@/lib/apply/labels";
import type { Application, Company, Job, UserJob } from "@/lib/db/types";
import { formatDateTime } from "@/lib/format";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { cn } from "@/lib/utils";
import { FollowButton, JobStatusButtons, PrepareButton } from "./_components/job-buttons";

export const metadata: Metadata = { title: "الوظائف" };

const TABS = [
  { status: "new", label: "جديدة" },
  { status: "saved", label: "محفوظة" },
  { status: "dismissed", label: "مستبعدة" },
] as const;
type Status = (typeof TABS)[number]["status"];

const SUPPORTED = new Set(["greenhouse", "lever", "ashby"]);

const WORKPLACE: Record<string, string> = { remote: "عن بعد", hybrid: "هجين", onsite: "من المكتب" };

type Row = Pick<UserJob, "status" | "created_at"> & {
  job: Pick<Job, "id" | "source" | "title" | "location" | "workplace_type" | "department" | "url" | "posted_at" | "closed_at"> & {
    company: Pick<Company, "id" | "name" | "domain"> | null;
  };
};

export default function JobsPage({ searchParams }: PageProps<"/jobs">) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">الوظائف</h1>
        <p className="text-muted-foreground">
          من لوحات التوظيف الرسمية للشركات. تنضاف هنا من الشات، ومن فحص الشركات الي تتابعها مرتين باليوم.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <JobsSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function JobsSection({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).status;
  const status: Status = TABS.some((t) => t.status === raw) ? (raw as Status) : "new";

  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const [{ data: rows }, { data: followed }, { data: apps }] = await Promise.all([
    insforge.database
      .from("user_jobs")
      .select(
        "status, created_at, job:jobs(id, source, title, location, workplace_type, department, url, posted_at, closed_at, company:companies(id, name, domain))",
      )
      .eq("user_id", user.id)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(200),
    insforge.database
      .from("user_companies")
      .select("company:companies(id, name, domain, ats, last_scanned_at)")
      .eq("user_id", user.id),
    insforge.database.from("applications").select("id, job_id, status").eq("user_id", user.id),
  ]);
  const appByJob = new Map(
    ((apps ?? []) as Pick<Application, "id" | "job_id" | "status">[]).map((a) => [a.job_id, a]),
  );

  const jobs = ((rows ?? []) as unknown as Row[]).filter((r) => r.job);
  const companies = ((followed ?? []) as unknown as { company: Pick<Company, "id" | "name" | "domain" | "ats" | "last_scanned_at"> | null }[])
    .map((r) => r.company)
    .filter((c): c is NonNullable<typeof c> => !!c);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <section className="flex flex-col gap-4">
        <nav className="flex gap-1 rounded-lg bg-muted p-1 text-sm" aria-label="حالة الوظائف">
          {TABS.map((tab) => (
            <Link
              key={tab.status}
              href={`/jobs?status=${tab.status}`}
              aria-current={tab.status === status ? "page" : undefined}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-center text-muted-foreground",
                tab.status === status && "bg-background font-medium text-foreground shadow-sm",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {jobs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {status === "new" ? "ما فيه وظائف للحين. اطلبها من الشات." : "ما فيه شي هنا."}
            </p>
            {status === "new" && (
              <Button asChild size="sm">
                <Link href="/chat">افتح الشات</Link>
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {jobs.map(({ job, status: jobStatus }) => (
              <li key={job.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 font-medium hover:underline"
                      dir="auto"
                    >
                      {job.title}
                      <ExternalLinkIcon className="size-3.5 text-muted-foreground" aria-hidden />
                    </a>
                    {job.closed_at && <Badge variant="outline">انقفلت</Badge>}
                  </div>
                  <span className="text-sm text-muted-foreground" dir="auto">
                    {[job.company?.name, job.location, job.workplace_type ? WORKPLACE[job.workplace_type] : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {job.posted_at && <span className="text-xs text-muted-foreground">نُشرت {formatDateTime(job.posted_at)}</span>}
                </div>
                {appByJob.has(job.id) ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/applications/${appByJob.get(job.id)!.id}`}>
                      الطلب: {STATUS_LABELS[appByJob.get(job.id)!.status]}
                    </Link>
                  </Button>
                ) : (
                  !job.closed_at && SUPPORTED.has(job.source) && <PrepareButton jobId={job.id} />
                )}
                <JobStatusButtons jobId={job.id} status={jobStatus} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="flex flex-col gap-3">
        <h2 className="font-semibold">شركات تتابعها</h2>
        {companies.length === 0 ? (
          <p className="text-sm text-muted-foreground">تابع شركة من نتائج الشات عشان نفحص وظائفها تلقائيًا.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {companies.map((company) => (
              <li key={company.id} className="flex flex-col gap-1 rounded-lg border p-3">
                <span className="font-medium" dir="auto">
                  {company.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {company.last_scanned_at ? `آخر فحص ${formatDateTime(company.last_scanned_at)}` : "ما انفحصت للحين"}
                  {company.ats === "unknown" || company.ats === "other" || company.ats === "workday"
                    ? " · نظام توظيف غير مدعوم"
                    : ""}
                </span>
                <FollowButton companyId={company.id} following />
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
