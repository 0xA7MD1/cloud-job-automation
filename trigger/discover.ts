import { logger, metadata, queue, task, wait } from "@trigger.dev/sdk";
import { getInsForgeAdminClient } from "@/lib/insforge/admin";
import { discoverCompanyJobs } from "@/lib/jobs/discover";
import { filterJobs } from "@/lib/jobs/filter";
import { COMPANY_COLUMNS, type CompanyRef } from "@/lib/jobs/sync";
import { readPreferences } from "@/lib/profile";

// فحص شركة لمستخدم واحد بالخلفية (شركات قريبة من الخرائط): لوحتها الرسمية أو صفحة التوظيف
// في موقعها، والوظائف تنضاف لصفحة «الوظائف» عنده. المدخلات معرّفات وكلمات بس.

// صفحات الشركات + الذكاء بمفتاح المستخدم: اثنين بنفس الوقت لكل مستخدم (concurrencyKey = user_id)
const discoverQueue = queue({ name: "discover-company", concurrencyLimit: 2 });

const RATE_LIMIT_WAITS = [30, 60, 120];
/** حد الوظائف الي نضيفها من شركة وحدة لقائمة المستخدم */
const MAX_LINKED = 25;

export interface DiscoverPayload {
  companyId: string;
  userId: string;
  searchId: string | null;
  /** مسميات طلبها المستخدم. فاضية = كل وظائف الشركة (صفحات الشركات المحلية قليلة وبالعربي غالبًا) */
  keywords: string[];
}

export const discoverCompanyTask = task({
  id: "discover-company",
  queue: discoverQueue,
  maxDuration: 600,
  retry: { maxAttempts: 1 },
  run: async ({ companyId, userId, searchId, keywords }: DiscoverPayload) => {
    const admin = getInsForgeAdminClient();
    const { data } = await admin.database.from("companies").select(COMPANY_COLUMNS).eq("id", companyId).maybeSingle();
    if (!data) return { skipped: "company not found" };

    metadata.set("step", "discover");
    const result = await discoverCompanyJobs(data as CompanyRef, userId, {
      waitForRateLimit: async (attempt) => {
        const seconds = RATE_LIMIT_WAITS[attempt - 1];
        if (!seconds) return false;
        await wait.for({ seconds });
        return true;
      },
    });
    if (result.kind === "none") {
      logger.info("no jobs source", { companyId, reason: result.reason });
      return { kind: "none", reason: result.reason };
    }

    const { data: profile } = await admin.database.from("profiles").select("preferences").eq("user_id", userId).maybeSingle();
    const prefs = readPreferences((profile as { preferences?: unknown } | null)?.preferences);
    const matched = filterJobs(result.jobs, { keywords, exclude: prefs.exclude_keywords }).slice(0, MAX_LINKED);
    if (matched.length === 0) return { kind: result.kind, jobs: result.jobs.length, linked: 0 };

    // عميل الأدمن: user_id صريح. ignoreDuplicates يحافظ على فرز المستخدم (محفوظة/مستبعدة)
    const { error } = await admin.database.from("user_jobs").upsert(
      matched.map((job) => ({ user_id: userId, job_id: job.id, search_id: searchId })),
      { onConflict: "user_id,job_id", ignoreDuplicates: true },
    );
    if (error) throw new Error(`user_jobs link failed: ${error.message}`);
    return { kind: result.kind, jobs: result.jobs.length, linked: matched.length };
  },
});
