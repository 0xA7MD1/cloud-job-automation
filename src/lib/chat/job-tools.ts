import { tool } from "ai";
import { z } from "zod";
import { startApplication, triggerErrorMessage } from "@/lib/apply/service";
import { SEARCH_PROVIDERS } from "@/lib/byok/providers";
import { getFirstProviderSecret, getProviderSecret } from "@/lib/byok/store";
import type { Company, Job, JobSource } from "@/lib/db/types";
import { getInsForgeAdminClient } from "@/lib/insforge/admin";
import { AtsFetchError, atsBoardUrl, isSupportedAts, type SupportedAts } from "@/lib/jobs/ats";
import { discoverCompanyJobs, type DiscoverResult } from "@/lib/jobs/discover";
import { filterJobs } from "@/lib/jobs/filter";
import {
  COMPANY_COLUMNS,
  ensureCompanyAts,
  isFresh,
  loadOpenJobs,
  syncCompanyJobs,
  type CompanyRef,
  type ReadyCompany,
  type SyncedJob,
} from "@/lib/jobs/sync";
import { parseJobUrl } from "@/lib/jobs/url";
import { readPreferences, type Preferences } from "@/lib/profile";
import { searchErrorMessage, type CompanySearchProvider } from "@/lib/search/companies";
import { normalizeDomain } from "@/lib/search/domain";
import { searchAtsJobLinks } from "@/lib/search/jobs";
import { PlacesError, searchPlaces } from "@/lib/search/places";
import { triggerDiscover } from "@/lib/trigger/server";
import type { ChatToolContext, ToolFailure } from "./tools";

export interface JobResult {
  jobId: string;
  title: string;
  company: string | null;
  location: string | null;
  workplaceType: Job["workplace_type"];
  department: string | null;
  url: string;
  postedAt: string | null;
  source: JobSource;
  /** على Greenhouse / Lever / Ashby: نقدّم عليها تلقائيًا. غيرها التقديم من موقعهم */
  autoApply: boolean;
}

const ATS_NAMES = { greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby" } as const;

/** اسم مؤقت من النطاق (acme.com ⇒ Acme). الفحص يبدّله باسم الموقع نفسه */
const nameFromDomain = (domain: string) => {
  const root = domain.split(".")[0] ?? domain;
  return root.charAt(0).toUpperCase() + root.slice(1);
};

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

  const { data: created } = await admin.database
    .from("companies")
    .upsert(
      { name: nameFromDomain(domain), domain, website_url: `https://${domain}`, source: "manual" },
      { onConflict: "domain" },
    )
    .select(COMPANY_COLUMNS)
    .single();
  return (created as CompanyRef | null) ?? null;
}

/** شركة من لوحة توظيفها (رابط وظيفة مباشر). الرابط ما يقول موقعها، فالجديدة تنحفظ بدون نطاق. */
async function resolveBoardCompany(
  ats: SupportedAts,
  slug: string,
): Promise<{ company: ReadyCompany; created: boolean } | null> {
  const admin = getInsForgeAdminClient();
  const find = async () => {
    const { data } = await admin.database.from("companies").select(COMPANY_COLUMNS).eq("ats", ats).eq("ats_slug", slug).maybeSingle();
    return data ? ({ ...(data as CompanyRef), ats, ats_slug: slug } satisfies ReadyCompany) : null;
  };
  const existing = await find();
  if (existing) return { company: existing, created: false };

  const name = slug.replace(/[-_.]+/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase());
  // سباق مع طلب ثاني: الفريد (ats, ats_slug) يمنع التكرار، ونقرأ الصف الي انحفظ
  await admin.database
    .from("companies")
    .insert([{ name, ats, ats_slug: slug, careers_url: atsBoardUrl(ats, slug), source: "ats" }]);
  const company = await find();
  return company ? { company, created: true } : null;
}

/** يحفظ نتيجة وظائف كبحث (قاعدة 9) ويضيفها لصفحة الوظائف بدون تكرار. يرجّع searchId. */
async function saveJobSearch(
  ctx: ChatToolContext,
  search: { provider: string; query: string; params: Record<string, unknown>; jobs: JobResult[]; resultCount: number },
): Promise<string | null> {
  const { data: saved } = await ctx.insforge.database
    .from("searches")
    .insert({
      user_id: ctx.userId,
      chat_id: ctx.chatId,
      kind: "jobs",
      provider: search.provider,
      query: search.query,
      params: search.params,
      results: search.jobs,
      result_count: search.resultCount,
    })
    .select("id")
    .single();
  const searchId = (saved as { id: string } | null)?.id;
  if (!searchId) return null;

  if (search.jobs.length > 0) {
    await ctx.insforge.database.from("user_jobs").upsert(
      search.jobs.map((job) => ({ user_id: ctx.userId, job_id: job.jobId, search_id: searchId })),
      { onConflict: "user_id,job_id", ignoreDuplicates: true },
    );
  }
  return searchId;
}

function toJobResult(job: SyncedJob, company: string | null): JobResult {
  return {
    jobId: job.id,
    title: job.title,
    company,
    location: job.location,
    workplaceType: job.workplaceType,
    department: job.department,
    url: job.url,
    postedAt: job.postedAt,
    source: job.source,
    autoApply: isSupportedAts(job.source),
  };
}

async function loadPreferences(ctx: ChatToolContext): Promise<Preferences> {
  const { data } = await ctx.insforge.database.from("profiles").select("preferences").eq("user_id", ctx.userId).maybeSingle();
  return readPreferences((data as { preferences?: unknown } | null)?.preferences);
}

/** ينفّذ fn على العناصر بحد أقصى بنفس الوقت، والنتائج بنفس الترتيب */
async function mapLimited<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

/** يدمج قوائم بالتناوب (أول وظيفة من كل شركة، ثم الثانية...) عشان ما تطغى شركة وحدة */
function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i]!);
  return out;
}

const NO_JOBS_SOURCE: Record<Extract<DiscoverResult, { kind: "none" }>["reason"], (name: string) => string> = {
  no_domain: (name) => `ما نعرف موقع ${name} الرسمي: اعطني نطاقه (مثل acme.com).`,
  no_careers_page: (name) => `${name} ما تستخدم Greenhouse أو Lever أو Ashby، وما لقيت صفحة توظيف في موقعها.`,
  unreadable: (name) =>
    `ما لقيت وظائف واضحة في صفحة توظيف ${name}، أو الصفحة ما انقرت (لو تنرسم بجافاسكربت، مفتاح Steel يخلينا نفتحها).`,
  no_ai: (name) => `${name} ما تستخدم Greenhouse أو Lever أو Ashby. أضف مفتاح ذكاء من «المفاتيح» عشان نقرأ صفحة توظيفها.`,
  ai_error: (name) => `الذكاء ما قدر يقرأ صفحة توظيف ${name}. جرّب بعد شوي.`,
};

function placesErrorMessage(error: unknown): string {
  const status = error instanceof PlacesError ? error.status : null;
  if (status === 400 || status === 401 || status === 403) {
    return "Google رفض البحث: تأكد إن «Places API (New)» مفعّل في مشروعك وإن الفوترة مضبوطة، وإن المفتاح صحيح.";
  }
  if (status === 429) return "وصلت حد Google Places. جرّب بعد شوي.";
  return "خرائط Google ما ردت. جرّب بعد شوي.";
}

/** لوحات نجيبها بالبحث الواحد بالمسمى (كل لوحة طلب لواجهتها) */
const MAX_BOARDS = 12;
const PER_BOARD = 5;

export function createJobTools(ctx: ChatToolContext) {
  return {
    searchOfficialJobs: tool({
      description:
        "Get OPEN jobs at ONE company: from its official board (Greenhouse, Lever or Ashby: auto-apply), otherwise from the careers page on its own website " +
        "(apply on their site or by email). Optionally filtered by title keywords and location. " +
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
            autoApply: boolean;
            /** صفحة التوظيف تطلب السيرة على هذا البريد */
            applyEmail: string | null;
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

        let found: DiscoverResult;
        try {
          found = await discoverCompanyJobs(company, ctx.userId);
        } catch (error) {
          return {
            ok: false,
            error: error instanceof AtsFetchError ? `${ATS_NAMES[error.ats]} ما رد. جرّب بعد شوي.` : "صار خطأ وقت جلب الوظائف.",
          };
        }
        if (found.kind === "none") return { ok: false, error: NO_JOBS_SOURCE[found.reason](company.name), careersUrl: found.careersUrl };
        if (found.kind === "ats" && found.boardGone) return { ok: false, error: `لوحة وظائف ${company.name} ما عادت موجودة.` };

        const prefs = await loadPreferences(ctx);
        const filter = { location: input.location, exclude: prefs.exclude_keywords };
        let matched = filterJobs(found.jobs, { ...filter, keywords: input.keywords });
        // صفحات الشركات المحلية بالعربي غالبًا: الكلمات الإنجليزية ما تطابق، فنعرض الكل بدل لا شي
        if (found.kind === "careers" && matched.length === 0) matched = filterJobs(found.jobs, filter);
        const name = found.company.name;
        const top = matched.slice(0, input.limit).map((job) => toJobResult(job, name));
        const autoApply = found.kind === "ats";

        const searchId = await saveJobSearch(ctx, {
          provider: found.kind === "ats" ? found.company.ats : "careers_page",
          query: `${name}${input.keywords?.length ? `: ${input.keywords.join(", ")}` : ""}`,
          params: { companyId: company.id, keywords: input.keywords ?? [], location: input.location ?? null },
          jobs: top,
          resultCount: matched.length,
        });
        if (!searchId) return { ok: false, error: "انحفظ البحث بشكل ناقص. جرّب مرة ثانية." };

        return {
          ok: true,
          searchId,
          company: {
            id: company.id,
            name,
            domain: found.company.domain,
            ats: found.kind === "ats" ? ATS_NAMES[found.company.ats] : "صفحة التوظيف",
            boardUrl: found.kind === "ats" ? atsBoardUrl(found.company.ats, found.company.ats_slug) : found.careersUrl,
          },
          autoApply,
          applyEmail: found.kind === "careers" ? found.applyEmail : null,
          totalOpen: found.jobs.length,
          matched: matched.length,
          jobs: top,
        };
      },
    }),

    addJobFromUrl: tool({
      description:
        "Add ONE job from a link the user pasted: a Greenhouse, Lever or Ashby job page, or a company careers link with gh_jid / ashby_jid. " +
        "Returns its jobId for prepareApplication. Always call this for a job link: the id inside a URL is NOT a jobId.",
      inputSchema: z.object({ url: z.string().min(10).max(2000).describe("The job link exactly as the user sent it") }),
      execute: async ({ url }): Promise<
        | {
            ok: true;
            searchId: string;
            company: { id: string; name: string; ats: string; boardUrl: string };
            job: JobResult;
          }
        | ToolFailure
      > => {
        const link = parseJobUrl(url);
        if (!link) {
          return {
            ok: false,
            error: "أرسل رابط الوظيفة نفسها من Greenhouse أو Lever أو Ashby. روابط LinkedIn ومواقع التجميع ما نقدّم عنها.",
          };
        }
        const atsName = ATS_NAMES[link.ats];

        let company: ReadyCompany;
        let created = false;
        if ("slug" in link) {
          const found = await resolveBoardCompany(link.ats, link.slug);
          if (!found) return { ok: false, error: "ما قدرنا نحفظ الشركة. جرّب مرة ثانية." };
          ({ company, created } = found);
        } else {
          const ref = await resolveCompany({ domain: link.domain });
          if (!ref) return { ok: false, error: "ما لقيت الشركة. تأكد من الرابط." };
          const ready = await ensureCompanyAts(ref);
          if (!ready.ok || ready.company.ats !== link.ats) {
            return { ok: false, error: `ما لقيت لوحة ${atsName} الرسمية لـ${ref.name}. أرسل رابط الوظيفة من صفحة التقديم نفسها.` };
          }
          company = ready.company;
        }

        let job: SyncedJob | undefined;
        try {
          if (isFresh(company)) job = (await loadOpenJobs(company)).find((j) => j.externalId === link.externalId);
          // مو بالمحفوظ: يمكن انضافت بعد آخر مزامنة
          if (!job) {
            const synced = await syncCompanyJobs(company);
            if (synced.boardGone) {
              // شركة انحفظت من هذا الرابط ولوحتها مو موجودة: ما نترك صف بلا فايدة في الجدول المشترك
              if (created) await getInsForgeAdminClient().database.from("companies").delete().eq("id", company.id);
              return { ok: false, error: `ما فيه لوحة وظائف بهذا الاسم على ${atsName}. تأكد من الرابط.` };
            }
            job = synced.jobs.find((j) => j.externalId === link.externalId);
          }
        } catch (error) {
          return { ok: false, error: error instanceof AtsFetchError ? `${atsName} ما رد. جرّب بعد شوي.` : "صار خطأ وقت جلب الوظيفة." };
        }
        if (!job) return { ok: false, error: `الوظيفة مو منشورة الحين على لوحة ${company.name} الرسمية: غالبًا انقفلت.` };

        const result = toJobResult(job, company.name);
        const searchId = await saveJobSearch(ctx, {
          provider: company.ats,
          query: url.slice(0, 500),
          params: { companyId: company.id, url: url.slice(0, 2000) },
          jobs: [result],
          resultCount: 1,
        });
        if (!searchId) return { ok: false, error: "انحفظ البحث بشكل ناقص. جرّب مرة ثانية." };

        return {
          ok: true,
          searchId,
          company: { id: company.id, name: company.name, ats: atsName, boardUrl: atsBoardUrl(company.ats, company.ats_slug) },
          job: result,
        };
      },
    }),

    searchJobs: tool({
      description:
        "Find OPEN jobs by role across ALL companies that hire through Greenhouse, Lever or Ashby (auto-apply works on every result). " +
        "Use this when the user wants jobs by title/role, not at one company. Results are saved and added to the Jobs page, " +
        "where the user can select many and apply to all of them with one confirmation.",
      inputSchema: z.object({
        titles: z.array(z.string().min(2).max(60)).min(1).max(3).describe("Job titles in English, e.g. 'frontend engineer'"),
        location: z.string().max(100).optional().describe("City, country or 'Remote'"),
        limit: z.number().int().min(1).max(40).optional().default(20),
      }),
      execute: async ({ titles, location, limit }): Promise<
        | { ok: true; searchId: string; provider: CompanySearchProvider; boards: number; total: number; jobs: JobResult[] }
        | ToolFailure
      > => {
        const secret = await getFirstProviderSecret(ctx.userId, SEARCH_PROVIDERS);
        if (!secret) return { ok: false, error: "ما فيه مفتاح بحث. أضف Tavily أو Exa من صفحة المفاتيح." };
        const provider = secret.provider as CompanySearchProvider;

        let urls: string[];
        try {
          urls = await searchAtsJobLinks(provider, secret.apiKey, { titles, location });
        } catch (error) {
          return { ok: false, error: searchErrorMessage(error) };
        }

        // روابط الوظائف ⇒ لوحات (شركة لكل لوحة) + الوظائف الي طلعت في البحث نفسه
        const boards = new Map<string, { ats: SupportedAts; slug: string; ids: Set<string> }>();
        for (const url of urls) {
          const link = parseJobUrl(url);
          if (!link || !("slug" in link)) continue;
          const key = `${link.ats}:${link.slug.toLowerCase()}`;
          const board = boards.get(key) ?? { ats: link.ats, slug: link.slug, ids: new Set<string>() };
          board.ids.add(link.externalId);
          boards.set(key, board);
        }
        const list = [...boards.values()].slice(0, MAX_BOARDS);
        const prefs = await loadPreferences(ctx);
        const filter = { location, exclude: prefs.exclude_keywords };

        const perBoard = await mapLimited(list, 4, async (board): Promise<JobResult[]> => {
          const found = await resolveBoardCompany(board.ats, board.slug);
          if (!found) return [];
          let jobs: SyncedJob[];
          try {
            if (isFresh(found.company)) jobs = await loadOpenJobs(found.company);
            else {
              const synced = await syncCompanyJobs(found.company);
              if (synced.boardGone) {
                if (found.created) await getInsForgeAdminClient().database.from("companies").delete().eq("id", found.company.id);
                return [];
              }
              jobs = synced.jobs;
            }
          } catch {
            return [];
          }
          const direct = filterJobs(jobs.filter((j) => board.ids.has(j.externalId)), filter);
          const byRole = filterJobs(jobs, { ...filter, keywords: titles });
          const unique = [...new Map([...direct, ...byRole].map((j) => [j.id, j])).values()];
          return unique.slice(0, PER_BOARD).map((job) => toJobResult(job, found.company.name));
        });

        const all = interleave(perBoard);
        const top = all.slice(0, limit);
        const searchId = await saveJobSearch(ctx, {
          provider,
          query: `${titles.join(", ")}${location ? ` · ${location}` : ""}`,
          params: { titles, location: location ?? null, boards: list.length },
          jobs: top,
          resultCount: all.length,
        });
        if (!searchId) return { ok: false, error: "انحفظ البحث بشكل ناقص. جرّب مرة ثانية." };
        return { ok: true, searchId, provider, boards: list.length, total: all.length, jobs: top };
      },
    }),

    searchNearbyCompanies: tool({
      description:
        "Find real companies near a place with Google Maps (the user's Google Places key), then check each company's official job board " +
        "or the careers page on its website IN THE BACKGROUND. Their jobs appear on the user's Jobs page within a few minutes. " +
        "Use when the user asks for companies around them or in a district/city. If they say 'near me' without a place, use the city from their profile.",
      inputSchema: z.object({
        query: z.string().min(2).max(120).describe("Kind of company in English, e.g. 'software company', 'bank', 'hospital'"),
        area: z.string().min(2).max(120).describe("District and city, e.g. 'Al Olaya, Riyadh'"),
        keywords: z.array(z.string().min(2).max(60)).max(10).optional().describe("Only if the user asked for specific roles"),
        limit: z.number().int().min(1).max(20).optional().default(20),
      }),
      execute: async ({ query, area, keywords, limit }): Promise<
        | {
            ok: true;
            searchId: string | null;
            companies: { companyId: string; name: string; domain: string; ats: Company["ats"] }[];
            /** أماكن بدون موقع رسمي (ما نقدر نفحص وظائفها) */
            withoutWebsite: number;
            /** بدأ الفحص بالخلفية */
            checking: boolean;
            note: string | null;
          }
        | ToolFailure
      > => {
        const secret = await getProviderSecret(ctx.userId, "google_places");
        if (!secret) {
          return { ok: false, error: "أضف مفتاح Google Places من «المفاتيح» عشان نلقى الشركات حولك (فيه 1000 بحث مجاني شهريًا)." };
        }
        let found;
        try {
          found = await searchPlaces(secret.apiKey, { query, area, limit });
        } catch (error) {
          return { ok: false, error: placesErrorMessage(error) };
        }
        if (found.hits.length === 0) {
          return { ok: true, searchId: null, companies: [], withoutWebsite: found.withoutWebsite, checking: false, note: null };
        }

        // الشركات مشتركة بين المستخدمين: نضيف الجديد بس. من Google نحفظ place_id وبس (شروطهم)
        const admin = getInsForgeAdminClient();
        const domains = found.hits.map((h) => h.domain);
        const [{ data: byDomain }, { data: byPlace }] = await Promise.all([
          admin.database.from("companies").select("id, domain, place_id").in("domain", domains),
          admin.database.from("companies").select("place_id").in("place_id", found.hits.map((h) => h.placeId)),
        ]);
        const existing = new Map(
          ((byDomain ?? []) as Pick<Company, "id" | "domain" | "place_id">[]).map((r) => [r.domain, r]),
        );
        const usedPlaces = new Set(((byPlace ?? []) as Pick<Company, "place_id">[]).map((r) => r.place_id));
        const fresh = found.hits.filter((h) => !existing.has(h.domain));
        if (fresh.length > 0) {
          await admin.database.from("companies").upsert(
            fresh.map((h) => ({
              name: nameFromDomain(h.domain),
              domain: h.domain,
              website_url: `https://${h.domain}`,
              source: "places",
              place_id: usedPlaces.has(h.placeId) ? null : h.placeId,
            })),
            { onConflict: "domain", ignoreDuplicates: true },
          );
        }
        await Promise.all(
          found.hits.map(async (h) => {
            const row = existing.get(h.domain);
            if (!row || row.place_id || usedPlaces.has(h.placeId)) return;
            await admin.database.from("companies").update({ place_id: h.placeId }).eq("id", row.id).is("place_id", null);
          }),
        );
        const { data: rows } = await admin.database.from("companies").select("id, name, domain, ats").in("domain", domains);
        const byDomainRow = new Map(
          ((rows ?? []) as Pick<Company, "id" | "name" | "domain" | "ats">[]).map((r) => [r.domain, r]),
        );
        const companies = found.hits.flatMap((h) => {
          const row = byDomainRow.get(h.domain);
          return row ? [{ companyId: row.id, name: row.name, domain: h.domain, ats: row.ats }] : [];
        });

        const { data: saved } = await ctx.insforge.database
          .from("searches")
          .insert({
            user_id: ctx.userId,
            chat_id: ctx.chatId,
            kind: "companies",
            provider: "places",
            query: `${query} · ${area}`,
            params: { area, keywords: keywords ?? [] },
            results: companies,
            result_count: companies.length,
          })
          .select("id")
          .single();
        const searchId = (saved as { id: string } | null)?.id ?? null;

        try {
          await triggerDiscover(
            companies.map((c) => c.companyId),
            { userId: ctx.userId, searchId, keywords: keywords ?? [] },
          );
        } catch (error) {
          return {
            ok: true,
            searchId,
            companies,
            withoutWebsite: found.withoutWebsite,
            checking: false,
            note: `لقينا الشركات، لكن فحص وظائفها ما بدأ: ${triggerErrorMessage(error)}`,
          };
        }
        return { ok: true, searchId, companies, withoutWebsite: found.withoutWebsite, checking: true, note: null };
      },
    }),

    prepareApplication: tool({
      description:
        "Start preparing an application for a job: fetch the form questions, fill answers from the profile, draft a cover letter. " +
        "Use jobId from searchOfficialJobs or addJobFromUrl. This does NOT submit: the user reviews and confirms on the application page.",
      inputSchema: z.object({ jobId: z.uuid() }),
      execute: async ({ jobId }): Promise<{ ok: true; applicationId: string; url: string } | ToolFailure> => {
        const result = await startApplication(ctx.insforge, ctx.userId, jobId);
        if (!result.ok) return { ok: false, error: result.error };
        return { ok: true, applicationId: result.data.id, url: `/applications/${result.data.id}` };
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
