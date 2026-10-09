import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { AlertCircleIcon, ExternalLinkIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { missingRequired, readForm, readStoredAnswers } from "@/lib/apply/form";
import { ACTIVE_STATUSES, STATUS_LABELS, STATUS_TONE } from "@/lib/apply/labels";
import { browserProviderFor, monthlyUsage } from "@/lib/apply/service";
import { requireUser } from "@/lib/auth";
import type { Application, Company, FileRow, Job } from "@/lib/db/types";
import { formatDateTime } from "@/lib/format";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { createRunReadToken } from "@/lib/trigger/server";
import { AnswersForm } from "../_components/answers-form";
import { CoverLetterEditor, CvPicker, DownloadButton, OutreachDrafts, ReprepareButton } from "../_components/application-parts";
import { RunWatcher } from "../_components/run-watcher";
import { SubmitPanel } from "../_components/submit-panel";

export const metadata: Metadata = { title: "مراجعة الطلب" };

type Row = Application & {
  job: Pick<Job, "id" | "title" | "location" | "url" | "closed_at"> & { company: Pick<Company, "name" | "domain"> | null };
};

const EDITABLE: Application["status"][] = ["draft", "ready", "failed", "cancelled"];

export default function ApplicationPage({ params }: PageProps<"/applications/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-64" />
        </div>
      }
    >
      <ApplicationView params={params} />
    </Suspense>
  );
}

async function ApplicationView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database
    .from("applications")
    .select("*, job:jobs(id, title, location, url, closed_at, company:companies(name, domain))")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  const app = data as unknown as Row | null;
  if (!app) notFound();

  const fileIds = [app.cover_letter_file_id, app.cover_letter_docx_file_id, app.evidence_file_id].filter(
    (v): v is string => !!v,
  );
  const [{ data: cvFiles }, { data: docs }, browser, quota] = await Promise.all([
    insforge.database
      .from("files")
      .select("id, file_name")
      .eq("user_id", user.id)
      .eq("kind", "cv")
      .order("created_at", { ascending: false }),
    fileIds.length
      ? insforge.database.from("files").select("id, file_name, kind").in("id", fileIds)
      : Promise.resolve({ data: [] }),
    browserProviderFor(insforge, user.id),
    monthlyUsage(insforge),
  ]);
  const owner = browser.owner;
  const docName = new Map(((docs ?? []) as Pick<FileRow, "id" | "file_name">[]).map((f) => [f.id, f.file_name]));

  const active = ACTIVE_STATUSES.includes(app.status);
  const token = active && app.trigger_run_id ? await createRunReadToken(owner, app.trigger_run_id) : null;

  const form = readForm(app.form);
  const answers = readStoredAnswers(app.answers);
  const editable = EDITABLE.includes(app.status) && !app.submit_attempted_at;
  const missing = form
    ? missingRequired(form, answers, { cv: !!app.cv_file_id, coverLetter: !!app.cover_letter_file_id })
    : [];
  const outreach = app.outreach as { subject?: string; email?: string; message?: string };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/applications" className="text-sm text-muted-foreground hover:underline">
          الطلبات
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold" dir="auto">
            {app.job.title}
          </h1>
          <Badge variant={STATUS_TONE[app.status]}>{STATUS_LABELS[app.status]}</Badge>
        </div>
        <p className="flex flex-wrap items-center gap-2 text-muted-foreground" dir="auto">
          {[app.job.company?.name, app.job.location].filter(Boolean).join(" · ")}
          <a
            href={app.job.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1 text-sm hover:underline"
          >
            صفحة الوظيفة
            <ExternalLinkIcon className="size-3.5" aria-hidden />
          </a>
        </p>
      </div>

      {active && (
        <RunWatcher runId={app.trigger_run_id} accessToken={token} fallback={STATUS_LABELS[app.status]} />
      )}

      {app.error && (
        <Alert variant="destructive">
          <AlertCircleIcon aria-hidden />
          <AlertTitle>ما كمل</AlertTitle>
          <AlertDescription>{app.error}</AlertDescription>
        </Alert>
      )}
      {app.status_detail && !app.error && (
        <Alert>
          <AlertCircleIcon aria-hidden />
          <AlertDescription>{app.status_detail}</AlertDescription>
        </Alert>
      )}

      {form && (
        <Card>
          <CardHeader>
            <CardTitle>جاهزية الطلب</CardTitle>
            <CardDescription>
              {missing.length === 0
                ? "كل الحقول المطلوبة لها إجابة."
                : `${missing.length} حقل مطلوب بدون إجابة: ${missing
                    .slice(0, 4)
                    .map((f) => f.label || f.key)
                    .join("، ")}${missing.length > 4 ? "…" : ""}`}
              {app.prepared_at && ` · تجهّز ${formatDateTime(app.prepared_at)}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {editable && <ReprepareButton applicationId={app.id} />}
          </CardContent>
        </Card>
      )}

      <SubmitPanel
        applicationId={app.id}
        canSubmit={!!form && editable && app.status !== "draft"}
        canCancel={active}
        provider={browser.provider}
        providerError={"error" in browser ? browser.error : null}
        missing={missing.length}
        quota={quota ? { used: quota.used, limit: quota.apply_limit } : null}
      />

      {app.status === "needs_user" && app.browser_provider === "local" && (
        <Alert>
          <AlertCircleIcon aria-hidden />
          <AlertTitle>ينتظرك في نافذة Chrome على جهازك</AlertTitle>
          <AlertDescription>كمّل الخطوة المطلوبة في النافذة نفسها، والمهمة تكمل لحالها لما تظهر صفحة التأكيد.</AlertDescription>
        </Alert>
      )}

      {app.status === "submitted" && (
        <Alert>
          <AlertCircleIcon aria-hidden />
          <AlertTitle>انرسل الطلب{app.submitted_at ? ` · ${formatDateTime(app.submitted_at)}` : ""}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {app.confirmation_ref ? `رقم الطلب: ${app.confirmation_ref}` : "الدليل محفوظ في ملفاتك."}
            {app.evidence_file_id && <DownloadButton fileId={app.evidence_file_id} label="صورة التأكيد" />}
          </AlertDescription>
        </Alert>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">الملفات</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-lg border p-4">
            <span className="text-sm font-medium">السيرة الذاتية</span>
            <CvPicker
              applicationId={app.id}
              cvFiles={(cvFiles ?? []) as { id: string; file_name: string }[]}
              selected={app.cv_file_id}
              editable={editable}
            />
          </div>
          <div className="flex flex-col gap-2 rounded-lg border p-4">
            <span className="text-sm font-medium">خطاب التقديم</span>
            <div className="flex flex-wrap gap-2">
              {app.cover_letter_file_id && (
                <DownloadButton fileId={app.cover_letter_file_id} label={docName.get(app.cover_letter_file_id)?.endsWith(".docx") ? "Word" : "PDF"} />
              )}
              {app.cover_letter_docx_file_id && <DownloadButton fileId={app.cover_letter_docx_file_id} label="Word" />}
              {!app.cover_letter_file_id && <span className="text-sm text-muted-foreground">ما تولّد للحين.</span>}
            </div>
          </div>
        </div>
      </section>

      {form ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">أسئلة النموذج</h2>
          {!form.complete && (
            <p className="text-sm text-muted-foreground">
              ما قدرنا نقرأ كل الأسئلة مسبقًا. الباقي ينكشف وقت التقديم، ولو احتجنا جوابك نوقف وننتظرك.
            </p>
          )}
          <AnswersForm applicationId={app.id} fields={form.fields} answers={answers} editable={editable} />
        </section>
      ) : (
        !active && <p className="text-muted-foreground">الطلب ما تجهّز للحين.</p>
      )}

      {(app.cover_letter_text || editable) && form && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">نص خطاب التقديم</h2>
          <CoverLetterEditor applicationId={app.id} initial={app.cover_letter_text ?? ""} editable={editable} />
        </section>
      )}

      {(outreach.email || outreach.message) && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">مسودات تواصل</h2>
          <p className="text-sm text-muted-foreground">ترسلها أنت بنفسك. ما نرسل شي باسمك.</p>
          <OutreachDrafts subject={outreach.subject ?? ""} email={outreach.email ?? ""} message={outreach.message ?? ""} />
        </section>
      )}
    </div>
  );
}
