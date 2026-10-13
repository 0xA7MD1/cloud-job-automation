import { getUserModel } from "@/lib/ai/model";
import { getProviderSecret } from "@/lib/byok/store";
import type { Job } from "@/lib/db/types";
import { getInsForgeAdminClient } from "@/lib/insforge/admin";
import { companyNameFromTitle } from "@/lib/search/domain";
import { isSupportedAts } from "./ats";
import { extractCareersJobs, loadPage, readCareersPage, type CareersExtraction, type CareersPage } from "./careers";
import { detectAtsInHtml } from "./detect";
import { fetchWorkableJobs, findWorkableSlug, workableBoardUrl, workableSlug } from "./workable";
import {
  ensureCompanyAts,
  isFresh,
  loadOpenJobs,
  storeCompanyJobs,
  syncCompanyJobs,
  type CompanyRef,
  type ReadyCompany,
  type SyncedJob,
} from "./sync";

// وظائف شركة من أي مكان: لوحتها على Greenhouse / Lever / Ashby (تقديم تلقائي)، وإلا صفحة
// التوظيف في موقعها (التقديم من موقعهم). يستخدمه الشات (searchOfficialJobs) والفحص بالخلفية.

export type DiscoverResult =
  | { kind: "ats"; company: ReadyCompany; jobs: SyncedJob[]; boardGone: boolean }
  | { kind: "careers"; company: CompanyRef; jobs: SyncedJob[]; careersUrl: string; applyEmail: string | null }
  | {
      kind: "none";
      company: CompanyRef;
      reason: "no_domain" | "no_careers_page" | "unreadable" | "no_ai" | "ai_error";
      careersUrl: string | null;
    };

export interface DiscoverOptions {
  /** حد مزود الذكاء (429): المهمة تنتظر وترجع true، والشات يرجع false على طول */
  waitForRateLimit?: (attempt: number) => Promise<boolean>;
}

/** وظائف صفحة التوظيف المحفوظة (لو قريناها قبل شوي ما نعيد الذكاء) */
async function loadCareersJobs(companyId: string): Promise<{ jobs: SyncedJob[]; applyEmail: string | null }> {
  const { data } = await getInsForgeAdminClient()
    .database.from("jobs")
    .select("id, external_id, title, location, workplace_type, employment_type, department, url, apply_url, posted_at, raw")
    .eq("company_id", companyId)
    .eq("source", "careers_page")
    .is("closed_at", null)
    .limit(200);
  type Row = Pick<
    Job,
    "id" | "external_id" | "title" | "location" | "workplace_type" | "employment_type" | "department" | "url" | "apply_url" | "posted_at" | "raw"
  >;
  const rows = (data ?? []) as Row[];
  const email = rows.map((r) => r.raw?.applyEmail).find((v): v is string => typeof v === "string") ?? null;
  return {
    applyEmail: email,
    jobs: rows.map((row) => ({
      id: row.id,
      source: "careers_page",
      externalId: row.external_id,
      title: row.title,
      location: row.location,
      workplaceType: row.workplace_type,
      employmentType: row.employment_type,
      department: row.department,
      description: null,
      url: row.url,
      applyUrl: row.apply_url,
      postedAt: row.posted_at,
    })),
  };
}

const isRateLimited = (error: unknown) => {
  const e = error as { statusCode?: number; lastError?: { statusCode?: number } } | null;
  return (e?.statusCode ?? e?.lastError?.statusCode) === 429;
};

/** رابط لوحة Greenhouse / Lever / Ashby لقيناه في صفحة الشركة: نحفظها ونجيب وظائفها (تقديم تلقائي) */
async function adoptBoard(company: CompanyRef, text: string): Promise<DiscoverResult | null> {
  const found = detectAtsInHtml(text);
  if (!found || !isSupportedAts(found.ats) || !found.slug) return null;
  const ready: ReadyCompany = { ...company, ats: found.ats, ats_slug: found.slug };
  const { error } = await getInsForgeAdminClient()
    .database.from("companies")
    .update({ ats: found.ats, ats_slug: found.slug })
    .eq("id", company.id);
  // نفس اللوحة محفوظة لشركة ثانية (انضافت من رابط وظيفة): نكمل بصفحة التوظيف
  if (error) return null;
  const synced = await syncCompanyJobs(ready);
  return { kind: "ats", company: ready, jobs: synced.jobs, boardGone: synced.boardGone };
}

export async function discoverCompanyJobs(
  company: CompanyRef,
  userId: string,
  options: DiscoverOptions = {},
): Promise<DiscoverResult> {
  // صفحة توظيف قريناها قبل شوي: من القاعدة بدل ما نعيد الاكتشاف والصفحة والذكاء
  if (!isSupportedAts(company.ats) && company.careers_url && isFresh(company)) {
    const saved = await loadCareersJobs(company.id);
    return { kind: "careers", company, careersUrl: company.careers_url, ...saved };
  }

  const ready = await ensureCompanyAts(company);
  if (ready.ok) {
    const synced = isFresh(ready.company)
      ? { jobs: await loadOpenJobs(ready.company), boardGone: false }
      : await syncCompanyJobs(ready.company);
    return { kind: "ats", company: ready.company, jobs: synced.jobs, boardGone: synced.boardGone };
  }

  const current = ready.company;
  if (!current.domain) return { kind: "none", company: current, reason: "no_domain", careersUrl: null };

  const steel = (await getProviderSecret(userId, "steel"))?.apiKey ?? null;
  let page = await readCareersPage({ domain: current.domain, careers_url: current.careers_url }, { steelApiKey: steel });
  if (!page) return { kind: "none", company: current, reason: "no_careers_page", careersUrl: current.careers_url };

  // اسم الشركة من موقعها نفسه (الي جت من الخرائط انحفظت باسم مؤقت من النطاق)
  const siteName = page.siteTitle ? companyNameFromTitle(page.siteTitle, current.domain) : null;
  const renamed = siteName && current.name.toLowerCase() === (current.domain.split(".")[0] ?? "").toLowerCase() ? siteName : null;
  const remember = async (careersUrl: string): Promise<CompanyRef> => {
    await getInsForgeAdminClient()
      .database.from("companies")
      .update({ careers_url: careersUrl, ...(renamed ? { name: renamed } : {}) })
      .eq("id", current.id);
    return { ...current, careers_url: careersUrl, ...(renamed ? { name: renamed } : {}) };
  };

  /** صفحة توظيفهم تودّي لـWorkable: الوظائف من واجهتهم العامة (دقيقة وبدون ذكاء ولا متصفح) */
  const fromWorkable = async (slug: string | null): Promise<DiscoverResult | null> => {
    if (!slug) return null;
    const postings = await fetchWorkableJobs(slug);
    if (!postings) return null;
    const careersUrl = workableBoardUrl(slug);
    const stored = await storeCompanyJobs(current.id, "careers_page", postings);
    return { kind: "careers", company: await remember(careersUrl), jobs: stored.jobs, careersUrl, applyEmail: null };
  };

  // صفحة انرسمت بجافاسكربت وفيها رابط لوحة رسمية (ما بان في HTML الخام وقت الاكتشاف): تقديم تلقائي
  const pageLinks = [page.url, ...page.links.map((l) => l.url)];
  const board = (await adoptBoard(current, pageLinks.join(" "))) ?? (await fromWorkable(findWorkableSlug(pageLinks)));
  if (board) return board;

  const model = await getUserModel(userId);
  if (!model) return { kind: "none", company: current, reason: "no_ai", careersUrl: page.url };

  const extract = async (target: CareersPage): Promise<CareersExtraction | null> => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await extractCareersJobs(model.model, target, { id: current.id, name: current.name });
      } catch (error) {
        if (isRateLimited(error) && (await options.waitForRateLimit?.(attempt))) continue;
        return null;
      }
    }
  };
  let extraction = await extract(page);
  if (!extraction) return { kind: "none", company: current, reason: "ai_error", careersUrl: page.url };

  // الوظائف في صفحة ثانية (زر «الشواغر» أو بوابة توظيف): نقراها مرة وحدة
  if (extraction.moreJobsUrl) {
    const portal =
      (await adoptBoard(current, extraction.moreJobsUrl)) ?? (await fromWorkable(workableSlug(extraction.moreJobsUrl)));
    if (portal) return portal;
    const next = await loadPage(extraction.moreJobsUrl, steel);
    if (next) {
      const nextPage: CareersPage = { ...next, siteTitle: page.siteTitle };
      const second = await extract(nextPage);
      if (second?.readable) {
        extraction = second;
        page = nextPage;
      }
    }
  }

  const updated = await remember(page.url);
  if (!extraction.readable) return { kind: "none", company: updated, reason: "unreadable", careersUrl: page.url };

  const email = extraction.applyEmail;
  const stored = await storeCompanyJobs(current.id, "careers_page", extraction.postings, () =>
    email ? { applyEmail: email } : null,
  );
  return { kind: "careers", company: updated, jobs: stored.jobs, careersUrl: page.url, applyEmail: email };
}
