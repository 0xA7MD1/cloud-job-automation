import { tool } from "ai";
import { z } from "zod";
import type { Job } from "@/lib/db/types";
import { getInsForgeAdminClient } from "@/lib/insforge/admin";
import { AtsFetchError, atsBoardUrl } from "@/lib/jobs/ats";
import { filterJobs } from "@/lib/jobs/filter";
import { COMPANY_COLUMNS, ensureCompanyAts, isFresh, loadOpenJobs, syncCompanyJobs, type CompanyRef } from "@/lib/jobs/sync";
import { readPreferences } from "@/lib/profile";
import { normalizeDomain } from "@/lib/search/domain";
import type { ChatToolContext, ToolFailure } from "./tools";

export interface JobResult {
  jobId: string;
  title: string;
  location: string | null;
  workplaceType: Job["workplace_type"];
  department: string | null;
  url: string;
  postedAt: string | null;
}

const ATS_NAMES = { greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby" } as const;

async function resolveCompany(input: { companyId?: string; domain?: string }): Promise<CompanyRef | null> {
  const admin = getInsForgeAdminClient();
  if (input.companyId) {
    const { data } = await admin.database.from("companies").select(COMPANY_COLUMNS).eq("id", input.companyId).maybeSingle();
    return (data as CompanyRef | null) ?? null;
  }
  const domain = input.domain ? normalizeDomain(input.domain) : null;
  if (!domain) return null;

  const { data: existing } = await admin.database.from("companies").select(COMPANY_COLUMNS).eq("domain", domain).maybeSingle();
  if (existing) return existing as CompanyRef;

  const root = domain.split(".")[0] ?? domain;
  const { data: created } = await admin.database
    .from("companies")
    .upsert(
      { name: root.charAt(0).toUpperCase() + root.slice(1), domain, website_url: `https://${domain}`, source: "manual" },
      { onConflict: "domain" },
    )
    .select(COMPANY_COLUMNS)
    .single();
  return (created as CompanyRef | null) ?? null;
}

export function createJobTools(ctx: ChatToolContext) {
  return {
    searchOfficialJobs: tool({
      description:
        "Get OPEN jobs from a company's official careers board (Greenhouse, Lever or Ashby), optionally filtered by title keywords and location. " +
        "Pass companyId from searchCompanies results, or the company's website domain. Results are saved with a searchId and added to the user's Jobs page.",
      inputSchema: z.object({
        companyId: z.uuid().optional(),
        domain: z.string().max(200).optional().describe("Company website domain, e.g. stripe.com"),
        keywords: z.array(z.string().min(2).max(60)).max(10).optional().describe("Title keywords, English works best"),
        location: z.string().max(100).optional().describe("City, country or 'Remote'"),
        limit: z.number().int().min(1).max(20).optional().default(10),
      }),
      execute: async (input): Promise<
        | {
            ok: true;
            searchId: string;
            company: { id: string; name: string; domain: string | null; ats: string; boardUrl: string };
            totalOpen: number;
            matched: number;
            jobs: JobResult[];
          }
        | (ToolFailure & { careersUrl?: string | null })
      > => {
        if (!input.companyId && !input.domain) {
          return { ok: false, error: "حدد الشركة: ابحث عنها أول أو اعطني نطاق موقعها." };
        }
        const company = await resolveCompany(input);
        if (!company) return { ok: false, error: "ما لقيت الشركة. تأكد من النطاق." };

        const ready = await ensureCompanyAts(company);
        if (!ready.ok) {
          const careersUrl = ready.company.careers_url;
          if (ready.reason === "unsupported") {
            return { ok: false, error: `${company.name} تستخدم نظام توظيف ما ندعمه للحين.`, careersUrl };
          }
          return { ok: false, error: `ما لقيت لوحة وظائف رسمية لـ${company.name} على Greenhouse أو Lever أو Ashby.`, careersUrl };
        }

        let synced;
        try {
          synced = isFresh(ready.company)
            ? { jobs: await loadOpenJobs(ready.company), newJobIds: new Set<string>(), boardGone: false }
            : await syncCompanyJobs(ready.company);
        } catch (error) {
          return {
            ok: false,
            error: error instanceof AtsFetchError ? `${ATS_NAMES[error.ats]} ما رد. جرّب بعد شوي.` : "صار خطأ وقت جلب الوظائف.",
          };
        }
        if (synced.boardGone) return { ok: false, error: `لوحة وظائف ${company.name} ما عادت موجودة.` };

        const { data: profile } = await ctx.insforge.database
          .from("profiles")
          .select("preferences")
          .eq("user_id", ctx.userId)
          .maybeSingle();
        const prefs = readPreferences(profile?.preferences);

        const matched = filterJobs(synced.jobs, {
          keywords: input.keywords,
          location: input.location,
          exclude: prefs.exclude_keywords,
        });
        const top: JobResult[] = matched.slice(0, input.limit).map((job) => ({
          jobId: job.id,
          title: job.title,
          location: job.location,
          workplaceType: job.workplaceType,
          department: job.department,
          url: job.url,
          postedAt: job.postedAt,
        }));

        const { data: saved } = await ctx.insforge.database
          .from("searches")
          .insert({
            user_id: ctx.userId,
            chat_id: ctx.chatId,
            kind: "jobs",
            provider: ready.company.ats,
            query: `${company.name}${input.keywords?.length ? `: ${input.keywords.join(", ")}` : ""}`,
            params: { companyId: company.id, keywords: input.keywords ?? [], location: input.location ?? null },
            results: top,
            result_count: matched.length,
          })
          .select("id")
          .single();
        const searchId = (saved as { id: string } | null)?.id;
        if (!searchId) return { ok: false, error: "انحفظ البحث بشكل ناقص. جرّب مرة ثانية." };

        // تنضاف لصفحة الوظائف (بدون تكرار)
        if (top.length > 0) {
          await ctx.insforge.database.from("user_jobs").upsert(
            top.map((job) => ({ user_id: ctx.userId, job_id: job.jobId, search_id: searchId })),
            { onConflict: "user_id,job_id", ignoreDuplicates: true },
          );
        }

        return {
          ok: true,
          searchId,
          company: {
            id: company.id,
            name: company.name,
            domain: company.domain,
            ats: ATS_NAMES[ready.company.ats],
            boardUrl: atsBoardUrl(ready.company.ats, ready.company.ats_slug),
          },
          totalOpen: synced.jobs.length,
          matched: matched.length,
          jobs: top,
        };
      },
    }),

    followCompany: tool({
      description:
        "Follow a company so new matching jobs are checked automatically twice a day and added to the user's Jobs page. Only call when the user asks to follow/track a company.",
      inputSchema: z.object({
        companyId: z.uuid(),
        keywords: z.array(z.string().min(2).max(60)).max(20).optional().describe("Title keywords to watch for"),
      }),
      execute: async ({ companyId, keywords }) => {
        const { error } = await ctx.insforge.database
          .from("user_companies")
          .upsert({ user_id: ctx.userId, company_id: companyId, keywords: keywords ?? [] }, { onConflict: "user_id,company_id" });
        return error ? { ok: false as const, error: "ما قدرنا نتابع الشركة." } : { ok: true as const, companyId };
      },
    }),
  };
}
