import { discardBody } from "@/lib/http";
import type { JobPosting } from "./ats";

// Workable: نظام توظيف منتشر عند الشركات السعودية والخليجية (Mozn، Foodics...). واجهة الودجت
// العامة (بدون مفتاح) ترجّع كل الوظائف المنشورة بدقة، فما نحتاج متصفح ولا ذكاء لصفحتهم.
// التقديم عليها من صفحتهم (ما عندنا محوّل Workable للحين)، فتنحفظ كوظائف «صفحة توظيف».

const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/i;
// مقاطع روابط Workable مو أسماء حسابات
const RESERVED = new Set(["j", "api", "careers", "jobs", "static", "assets", "www", "apply", "resources"]);

/** اسم حساب Workable من رابط (apply.workable.com/acme/… أو acme.workable.com). null لو مو منه. */
export function workableSlug(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!host.endsWith("workable.com")) return null;
  const path = url.pathname.split("/").filter(Boolean);
  let slug: string | undefined;
  if (host === "apply.workable.com") {
    slug = path[0] === "api" ? path[path.indexOf("accounts") + 1] : path[0];
  } else if (host.endsWith(".workable.com")) {
    slug = host.slice(0, -".workable.com".length);
  }
  if (!slug || !SLUG.test(slug) || RESERVED.has(slug.toLowerCase())) return null;
  return slug.toLowerCase();
}

/** أول حساب Workable في قائمة روابط */
export function findWorkableSlug(urls: readonly string[]): string | null {
  for (const url of urls) {
    const slug = workableSlug(url);
    if (slug) return slug;
  }
  return null;
}

export const workableBoardUrl = (slug: string) => `https://apply.workable.com/${slug}/`;

interface WorkableJob {
  title?: unknown;
  shortcode?: unknown;
  employment_type?: unknown;
  telecommuting?: unknown;
  department?: unknown;
  url?: unknown;
  application_url?: unknown;
  published_on?: unknown;
  city?: unknown;
  state?: unknown;
  country?: unknown;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function parseWorkable(body: unknown): JobPosting[] {
  const jobs = ((body as { jobs?: WorkableJob[] } | null)?.jobs ?? []) as WorkableJob[];
  return jobs.flatMap((j) => {
    const code = str(j.shortcode);
    const title = str(j.title);
    const url = str(j.url);
    if (!code || !title || !url) return [];
    const location = [str(j.city), str(j.country)].filter(Boolean).join(", ") || null;
    const posted = str(j.published_on);
    return [
      {
        source: "careers_page" as const,
        // الكود فريد عند Workable لكل وظيفة
        externalId: `workable:${code}`,
        title,
        location,
        workplaceType: j.telecommuting === true ? ("remote" as const) : null,
        employmentType: str(j.employment_type),
        department: str(j.department),
        description: null,
        url,
        applyUrl: str(j.application_url) ?? url,
        postedAt: posted && !Number.isNaN(Date.parse(posted)) ? new Date(posted).toISOString() : null,
      },
    ];
  });
}

/** وظائف حساب Workable. null = الحساب مو موجود أو الواجهة ما ردت. */
export async function fetchWorkableJobs(slug: string): Promise<JobPosting[] | null> {
  try {
    const response = await fetch(`https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(slug)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok) {
      discardBody(response);
      return null;
    }
    return parseWorkable(await response.json());
  } catch {
    return null;
  }
}
