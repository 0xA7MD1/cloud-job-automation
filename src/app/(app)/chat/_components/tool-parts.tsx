"use client";

import Link from "next/link";
import {
  BellIcon,
  BriefcaseBusinessIcon,
  BuildingIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HistoryIcon,
  ListChecksIcon,
  Loader2Icon,
  MailIcon,
  MapPinIcon,
  SearchIcon,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { JobResult } from "@/lib/chat/job-tools";
import type { ChatUIMessage } from "@/lib/chat/types";
import { formatDateTime } from "@/lib/format";
import { FollowButton, JobStatusButtons, PrepareButton } from "../../jobs/_components/job-buttons";

type Part = ChatUIMessage["parts"][number];

const WORKPLACE: Record<string, string> = { remote: "عن بعد", hybrid: "هجين", onsite: "من المكتب" };

const ATS_LABEL: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workday: "Workday",
  other: "نظام آخر",
};

function Pending({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2Icon className="size-4 animate-spin" aria-hidden />
      {label}
    </p>
  );
}

function Failure({ text }: { text: string }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  );
}

function JobRow({ job, showCompany = false }: { job: JobResult; showCompany?: boolean }) {
  // نتائج قديمة قبل autoApply كانت كلها من لوحات رسمية
  const auto = job.autoApply !== false;
  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <a href={job.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium hover:underline" dir="auto">
          {job.title}
        </a>
        <span className="text-xs text-muted-foreground" dir="auto">
          {[showCompany ? job.company : null, job.location, job.workplaceType ? WORKPLACE[job.workplaceType] : null, job.department]
            .filter(Boolean)
            .join(" · ")}
          {job.postedAt && ` · ${formatDateTime(job.postedAt)}`}
        </span>
      </div>
      {auto ? (
        <PrepareButton jobId={job.jobId} />
      ) : (
        <Button asChild variant="outline" size="sm">
          <a href={job.url} target="_blank" rel="noopener noreferrer nofollow">
            قدّم من موقعهم
            <ExternalLinkIcon data-icon="inline-end" aria-hidden />
          </a>
        </Button>
      )}
      <JobStatusButtons jobId={job.jobId} status="new" />
    </li>
  );
}

/** «حدّد وقدّم على الكل» يصير في صفحة الوظائف: تأكيد واحد من الواجهة (قاعدة 8) */
function BulkHint({ count }: { count: number }) {
  if (count < 2) return null;
  return (
    <Button asChild variant="outline" size="sm" className="self-start">
      <Link href="/jobs">
        <ListChecksIcon data-icon="inline-start" aria-hidden />
        قدّم عليها كلها من صفحة الوظائف
      </Link>
    </Button>
  );
}

export function ToolPartView({ part, onAsk, busy }: { part: Part; onAsk: (text: string) => void; busy: boolean }) {
  switch (part.type) {
    case "tool-searchCompanies": {
      if (part.state === "input-streaming" || part.state === "input-available") {
        return <Pending label={`يبحث عن شركات: ${part.input?.query ?? ""}…`} />;
      }
      if (part.state === "output-error") return <Failure text="فشل البحث عن الشركات." />;
      if (part.state !== "output-available") return null;
      const output = part.output;
      if (!output.ok) return <Failure text={output.error} />;
      if (output.companies.length === 0) {
        return <p className="text-sm text-muted-foreground">ما لقيت شركات بهذا البحث.</p>;
      }
      return (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <SearchIcon className="size-3.5" aria-hidden />
            {output.companies.length} شركة · المصدر {output.provider === "tavily" ? "Tavily" : "Exa"} · انحفظ البحث
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {output.companies.map((company) => (
              <li key={company.companyId} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <BuildingIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate font-medium" dir="auto">
                      {company.name}
                    </span>
                  </div>
                  {company.ats !== "unknown" && <Badge variant="secondary">{ATS_LABEL[company.ats]}</Badge>}
                </div>
                <a
                  href={company.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  dir="ltr"
                >
                  {company.domain}
                  <ExternalLinkIcon className="size-3" aria-hidden />
                </a>
                {company.snippet && (
                  <p className="line-clamp-2 text-xs text-muted-foreground" dir="auto">
                    {company.snippet}
                  </p>
                )}
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => onAsk(`اعرض الوظائف الرسمية في ${company.name} (companyId: ${company.companyId})`)}
                  >
                    وظائفهم الرسمية
                  </Button>
                  <FollowButton companyId={company.companyId} following={false} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    case "tool-searchOfficialJobs": {
      if (part.state === "input-streaming" || part.state === "input-available") {
        return <Pending label="يجيب الوظائف من لوحة الشركة الرسمية…" />;
      }
      if (part.state === "output-error") return <Failure text="فشل جلب الوظائف." />;
      if (part.state !== "output-available") return null;
      const output = part.output;
      if (!output.ok) {
        return (
          <Alert>
            <AlertDescription>
              {output.error}
              {"careersUrl" in output && output.careersUrl && (
                <>
                  {" "}
                  <a href={output.careersUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline">
                    صفحة التوظيف
                  </a>
                </>
              )}
            </AlertDescription>
          </Alert>
        );
      }
      return (
        <div className="flex flex-col gap-2">
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <BriefcaseBusinessIcon className="size-3.5" aria-hidden />
            {output.company.name} · {output.matched} مطابقة من {output.totalOpen} مفتوحة ·
            <a href={output.company.boardUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline">
              {output.autoApply === false ? "صفحة التوظيف في موقعهم" : `لوحة ${output.company.ats} الرسمية`}
            </a>
          </p>
          {output.autoApply === false && (
            <p className="text-xs text-muted-foreground">
              الشركة ما تستخدم لوحة نقدر نقدّم عليها تلقائيًا: التقديم من موقعهم
              {output.applyEmail ? " أو بالبريد." : "."}
            </p>
          )}
          {output.jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">ما فيه وظائف مطابقة الحين. تقدر تتابع الشركة ونبلغك بالجديد.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {output.jobs.map((job) => (
                <JobRow key={job.jobId} job={job} />
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            {output.applyEmail && (
              <Button asChild variant="outline" size="sm">
                <a href={`mailto:${output.applyEmail}`}>
                  <MailIcon data-icon="inline-start" aria-hidden />
                  <span dir="ltr">{output.applyEmail}</span>
                </a>
              </Button>
            )}
            {output.autoApply !== false && <BulkHint count={output.jobs.length} />}
            <FollowButton companyId={output.company.id} following={false} />
          </div>
        </div>
      );
    }

    case "tool-searchJobs": {
      if (part.state === "input-streaming" || part.state === "input-available") {
        return <Pending label={`يبحث عن «${part.input?.titles?.join("، ") ?? ""}» في لوحات Greenhouse وLever وAshby…`} />;
      }
      if (part.state === "output-error") return <Failure text="فشل البحث عن الوظائف." />;
      if (part.state !== "output-available") return null;
      const output = part.output;
      if (!output.ok) return <Failure text={output.error} />;
      return (
        <div className="flex flex-col gap-2">
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <SearchIcon className="size-3.5" aria-hidden />
            {output.total} وظيفة من {output.boards} شركة · كلها تقديم تلقائي · المصدر{" "}
            {output.provider === "tavily" ? "Tavily" : "Exa"} · انضافت لصفحة الوظائف
          </p>
          {output.jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">ما لقيت وظائف مفتوحة بهذا المسمى. جرّب مسمى أعم أو بدون مدينة.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {output.jobs.map((job) => (
                <JobRow key={job.jobId} job={job} showCompany />
              ))}
            </ul>
          )}
          <BulkHint count={output.jobs.length} />
        </div>
      );
    }

    case "tool-searchNearbyCompanies": {
      if (part.state === "input-streaming" || part.state === "input-available") {
        return <Pending label={`يبحث في خرائط Google: ${part.input?.query ?? ""} · ${part.input?.area ?? ""}…`} />;
      }
      if (part.state === "output-error") return <Failure text="فشل البحث عن الشركات القريبة." />;
      if (part.state !== "output-available") return null;
      const output = part.output;
      if (!output.ok) return <Failure text={output.error} />;
      return (
        <div className="flex flex-col gap-2">
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <MapPinIcon className="size-3.5" aria-hidden />
            {output.companies.length} شركة لها موقع رسمي
            {output.withoutWebsite > 0 && ` · ${output.withoutWebsite} بدون موقع (ما نقدر نفحص وظائفها)`}
          </p>
          {output.companies.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {output.companies.map((company) => (
                <li key={company.companyId} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                  <a
                    href={`https://${company.domain}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex min-w-0 items-center gap-1 text-sm hover:underline"
                    dir="ltr"
                  >
                    <span className="truncate">{company.domain}</span>
                    <ExternalLinkIcon className="size-3 shrink-0" aria-hidden />
                  </a>
                  {company.ats !== "unknown" && <Badge variant="secondary">{ATS_LABEL[company.ats]}</Badge>}
                </li>
              ))}
            </ul>
          )}
          {output.note ? (
            <Alert>
              <AlertDescription>{output.note}</AlertDescription>
            </Alert>
          ) : (
            output.checking && (
              <p className="text-sm text-muted-foreground">
                نفحص لوحة توظيف كل شركة أو صفحة الوظائف في موقعها بالخلفية. الي نلقاه ينضاف لصفحة الوظائف خلال دقايق.
              </p>
            )
          )}
          {output.checking && (
            <Button asChild variant="outline" size="sm" className="self-start">
              <Link href="/jobs">
                <BriefcaseBusinessIcon data-icon="inline-start" aria-hidden />
                صفحة الوظائف
              </Link>
            </Button>
          )}
        </div>
      );
    }

    case "tool-addJobFromUrl": {
      if (part.state === "input-streaming" || part.state === "input-available") {
        return <Pending label="يجيب الوظيفة من لوحة الشركة الرسمية…" />;
      }
      if (part.state === "output-error") return <Failure text="فشل جلب الوظيفة من الرابط." />;
      if (part.state !== "output-available") return null;
      const output = part.output;
      if (!output.ok) return <Failure text={output.error} />;
      return (
        <div className="flex flex-col gap-2">
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <BriefcaseBusinessIcon className="size-3.5" aria-hidden />
            {output.company.name} ·
            <a href={output.company.boardUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline">
              لوحة {output.company.ats} الرسمية
            </a>
            · انضافت لصفحة الوظائف
          </p>
          <ul className="rounded-lg border">
            <JobRow job={output.job} />
          </ul>
        </div>
      );
    }

    case "tool-prepareApplication":
      if (part.state !== "output-available") return <Pending label="يبدأ تجهيز الطلب…" />;
      if (!part.output.ok) return <Failure text={part.output.error} />;
      return (
        <Button asChild variant="outline" size="sm" className="self-start">
          <Link href={part.output.url}>
            <FileTextIcon data-icon="inline-start" aria-hidden />
            افتح الطلب وراجعه
          </Link>
        </Button>
      );

    case "tool-followCompany":
      return (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <BellIcon className="size-3.5" aria-hidden />
          {part.state !== "output-available" ? "يتابع الشركة…" : part.output.ok ? "صرت تتابع الشركة." : part.output.error}
        </p>
      );

    case "tool-listRecentSearches":
    case "tool-getSearchResults":
      return (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <HistoryIcon className="size-3.5" aria-hidden />
          {part.state === "output-available" ? "رجع للبحوث المحفوظة" : "يراجع البحوث المحفوظة…"}
        </p>
      );

    default:
      return null;
  }
}
