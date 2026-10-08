import { logger, queue, schedules, task } from "@trigger.dev/sdk";
import { getInsForgeAdminClient } from "@/lib/insforge/admin";
import { filterJobs } from "@/lib/jobs/filter";
import { COMPANY_COLUMNS, ensureCompanyAts, isFresh, loadOpenJobs, syncCompanyJobs, type CompanyRef } from "@/lib/jobs/sync";
import { readPreferences } from "@/lib/profile";

// فحص الشركات المتابعة: جدول واحد يوزّع على مهمة لكل شركة (مو جدول لكل مستخدم).
// المدخلات معرّفات بس: Trigger.dev يحفظ المدخلات ويعرضها في لوحته.

const atsQueue = queue({ name: "ats-scan", concurrencyLimit: 3 });

export const scanCompany = task({
  id: "scan-company",
  queue: atsQueue,
  maxDuration: 300,
  retry: { maxAttempts: 2 },
  run: async ({ companyId }: { companyId: string }) => {
    const admin = getInsForgeAdminClient();
    const { data: company } = await admin.database.from("companies").select(COMPANY_COLUMNS).eq("id", companyId).maybeSingle();
    if (!company) return { skipped: "company not found" };

    const ready = await ensureCompanyAts(company as CompanyRef);
    if (!ready.ok) {
      logger.info("الشركة بدون لوحة مدعومة", { companyId, reason: ready.reason });
      return { skipped: ready.reason };
    }

    // الشات يمكن زامنها قبل شوي: نقرأ من القاعدة بدل ما نضغط على لوحة الشركة
    const synced = isFresh(ready.company)
      ? { jobs: await loadOpenJobs(ready.company), boardGone: false }
      : await syncCompanyJobs(ready.company);
    if (synced.boardGone) return { skipped: "board gone" };

    const { data: followers } = await admin.database
      .from("user_companies")
      .select("user_id, keywords")
      .eq("company_id", companyId);
    const rows = (followers ?? []) as { user_id: string; keywords: string[] }[];
    if (rows.length === 0) return { jobs: synced.jobs.length, linked: 0 };

    const { data: profiles } = await admin.database
      .from("profiles")
      .select("user_id, preferences")
      .in("user_id", rows.map((r) => r.user_id));
    const prefsByUser = new Map(
      ((profiles ?? []) as { user_id: string; preferences: unknown }[]).map((p) => [p.user_id, readPreferences(p.preferences)]),
    );

    let linked = 0;
    for (const follower of rows) {
      const prefs = prefsByUser.get(follower.user_id) ?? readPreferences(null);
      const keywords = follower.keywords.length > 0 ? follower.keywords : prefs.target_roles;
      // بدون كلمات نضيف كل وظائف الشركة لقائمته: كثير. ننتظره يحدد وش يبي
      if (keywords.length === 0) continue;

      const matched = filterJobs(synced.jobs, {
        keywords,
        locations: prefs.locations,
        workplace: prefs.workplace,
        exclude: prefs.exclude_keywords,
      }).slice(0, 50);
      if (matched.length === 0) continue;

      // عميل الأدمن: user_id صريح. ignoreDuplicates يحافظ على فرز المستخدم (محفوظة/مستبعدة)
      const { error } = await admin.database.from("user_jobs").upsert(
        matched.map((job) => ({ user_id: follower.user_id, job_id: job.id })),
        { onConflict: "user_id,job_id", ignoreDuplicates: true },
      );
      if (error) logger.error("فشل ربط الوظائف", { companyId, message: error.message });
      else linked += matched.length;
    }

    return { jobs: synced.jobs.length, followers: rows.length, linked };
  },
});

export const scanFollowedCompanies = schedules.task({
  id: "scan-followed-companies",
  // مرتين باليوم. كل شركة = تشغيل Micro قصير من حصة $5 المجانية
  cron: "0 */12 * * *",
  maxDuration: 120,
  run: async () => {
    const { data } = await getInsForgeAdminClient().database.from("user_companies").select("company_id").limit(10_000);
    const companyIds = [...new Set(((data ?? []) as { company_id: string }[]).map((r) => r.company_id))];

    for (let i = 0; i < companyIds.length; i += 100) {
      await scanCompany.batchTrigger(
        companyIds.slice(i, i + 100).map((companyId) => ({
          payload: { companyId },
          // لو الجدول تأخر وتكدّست، لا تفحص نفس الشركة مرتين بنفس الدورة
          options: { idempotencyKey: `scan-${companyId}-${new Date().toISOString().slice(0, 13)}` },
        })),
      );
    }
    logger.info("وزّعنا الفحص", { companies: companyIds.length });
    return { companies: companyIds.length };
  },
});
