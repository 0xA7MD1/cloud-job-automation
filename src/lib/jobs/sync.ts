import type { Company, Job, JobSource } from "@/lib/db/types";
import { getInsForgeAdminClient } from "@/lib/insforge/admin";
import { fetchAtsJobs, isSupportedAts, type JobPosting, type SupportedAts } from "./ats";
import { detectCompanyAts } from "./detect";

// مزامنة وظائف شركة مع الجدول المشترك. تستخدمها أداة الشات والفحص الدوري.
// كل الكتابة بعميل الأدمن لأن jobs/companies مشتركة (المستخدم يقرأ بس).

export type CompanyRef = Pick<Company, "id" | "name" | "domain" | "ats" | "ats_slug" | "careers_url" | "last_scanned_at">;
export type ReadyCompany = CompanyRef & { ats: SupportedAts; ats_slug: string };

export const COMPANY_COLUMNS = "id, name, domain, ats, ats_slug, careers_url, last_scanned_at";

/** مزامنة أحدث من هذا تكفي: نقرأ من القاعدة بدل ما نضغط على لوحة الشركة */
export const FRESH_FOR_MS = 6 * 60 * 60 * 1000;

export function isFresh(company: Pick<Company, "last_scanned_at">, now = Date.now()): boolean {
  return !!company.last_scanned_at && now - Date.parse(company.last_scanned_at) < FRESH_FOR_MS;
}

/** الوظائف المفتوحة المحفوظة لشركة (بدون الوصف: ثقيل وما نحتاجه للقائمة) */
export async function loadOpenJobs(company: ReadyCompany): Promise<SyncedJob[]> {
  const { data } = await getInsForgeAdminClient()
    .database.from("jobs")
    .select("id, source, external_id, title, location, workplace_type, employment_type, department, url, apply_url, posted_at")
    .eq("company_id", company.id)
    .eq("source", company.ats)
    .is("closed_at", null)
    .limit(2000);
  type Row = Pick<Job, "id" | "external_id" | "title" | "location" | "workplace_type" | "employment_type" | "department" | "url" | "apply_url" | "posted_at">;
  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    source: company.ats,
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
  }));
}

export type EnsureResult =
  | { ok: true; company: ReadyCompany }
  | { ok: false; reason: "no_domain" | "unsupported" | "not_found"; company: CompanyRef };

/** يتأكد إننا نعرف نظام التوظيف ولوحته. لو ما نعرف: نكتشفه ونحفظه للكل. */
export async function ensureCompanyAts(company: CompanyRef): Promise<EnsureResult> {
  if (isSupportedAts(company.ats) && company.ats_slug) {
    return { ok: true, company: { ...company, ats: company.ats, ats_slug: company.ats_slug } };
  }
  if (company.ats === "workday" || company.ats === "other") return { ok: false, reason: "unsupported", company };
  if (!company.domain) return { ok: false, reason: "no_domain", company };

  const match = await detectCompanyAts(company.domain, company.name);
  const updated: CompanyRef = {
    ...company,
    ats: match.ats,
    ats_slug: match.slug,
    careers_url: match.careersUrl ?? company.careers_url,
  };
  await getInsForgeAdminClient()
    .database.from("companies")
    .update({ ats: updated.ats, ats_slug: updated.ats_slug, careers_url: updated.careers_url })
    .eq("id", company.id);

  if (isSupportedAts(updated.ats) && updated.ats_slug) {
    return { ok: true, company: { ...updated, ats: updated.ats, ats_slug: updated.ats_slug } };
  }
  return { ok: false, reason: updated.ats === "unknown" ? "not_found" : "unsupported", company: updated };
}

export interface SyncedJob extends JobPosting {
  id: string;
}

export interface SyncResult {
  jobs: SyncedJob[];
  /** وظائف أول مرة نشوفها في هذه المزامنة */
  newJobIds: Set<string>;
  /** اللوحة اختفت (404): رجّعنا الشركة لـunknown */
  boardGone: boolean;
}

const CHUNK = 100;

function chunks<T>(list: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * يجيب وظائف الشركة المفتوحة، يحدّث الجدول المشترك (إضافة/تحديث)، ويعلّم
 * الوظائف الي اختفت من اللوحة كمغلقة.
 */
export async function syncCompanyJobs(company: ReadyCompany): Promise<SyncResult> {
  const postings = await fetchAtsJobs(company.ats, company.ats_slug);
  if (postings === null) {
    await getInsForgeAdminClient().database.from("companies").update({ ats: "unknown", ats_slug: null }).eq("id", company.id);
    return { jobs: [], newJobIds: new Set(), boardGone: true };
  }
  return { ...(await storeCompanyJobs(company.id, company.ats, postings)), boardGone: false };
}

/**
 * يحفظ قائمة وظائف شركة من مصدر واحد (لوحة توظيف أو صفحة careers): إضافة/تحديث،
 * والي اختفت من المصدر تنقفل. القائمة لازم تكون كاملة: قائمة ناقصة تقفل وظائف مفتوحة.
 */
export async function storeCompanyJobs(
  companyId: string,
  source: JobSource,
  all: JobPosting[],
  raw?: (posting: JobPosting) => Record<string, unknown> | null,
): Promise<Omit<SyncResult, "boardGone">> {
  const admin = getInsForgeAdminClient();
  const startedAt = new Date().toISOString();
  // نفس الوظيفة مكررة في المصدر (Workable يكررها لكل موقع): التكرار بنفس الدفعة يرفضه upsert
  const postings = [...new Map(all.map((p) => [p.externalId, p])).values()];

  // الموجود قبل المزامنة: عشان نعرف الجديد بدون الاعتماد على ساعة الخادم
  const known = new Set<string>();
  for (const ids of chunks(postings.map((p) => p.externalId), 300)) {
    const { data } = await admin.database
      .from("jobs")
      .select("external_id")
      .eq("source", source)
      .in("external_id", ids);
    for (const row of (data ?? []) as { external_id: string }[]) known.add(row.external_id);
  }

  const idByExternal = new Map<string, string>();
  for (const batch of chunks(postings)) {
    const { data, error } = await admin.database
      .from("jobs")
      .upsert(
        batch.map((p) => ({
          company_id: companyId,
          source: p.source,
          external_id: p.externalId,
          title: p.title,
          location: p.location,
          workplace_type: p.workplaceType,
          employment_type: p.employmentType,
          department: p.department,
          description: p.description,
          url: p.url,
          apply_url: p.applyUrl,
          posted_at: p.postedAt,
          last_seen_at: startedAt,
          closed_at: null,
          ...(raw ? { raw: raw(p) } : {}),
        })),
        { onConflict: "source,external_id" },
      )
      .select("id, external_id");
    if (error) throw new Error(`jobs upsert failed: ${error.message}`);
    for (const row of (data ?? []) as { id: string; external_id: string }[]) idByExternal.set(row.external_id, row.id);
  }

  // اختفت من المصدر ⇒ مغلقة
  await admin.database
    .from("jobs")
    .update({ closed_at: startedAt })
    .eq("company_id", companyId)
    .eq("source", source)
    .is("closed_at", null)
    .lt("last_seen_at", startedAt);

  await admin.database.from("companies").update({ last_scanned_at: startedAt }).eq("id", companyId);

  const jobs: SyncedJob[] = postings.flatMap((p) => {
    const id = idByExternal.get(p.externalId);
    return id ? [{ ...p, id }] : [];
  });
  const newJobIds = new Set(jobs.filter((j) => !known.has(j.externalId)).map((j) => j.id));
  return { jobs, newJobIds };
}
