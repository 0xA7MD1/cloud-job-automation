import { isAggregatorDomain, normalizeDomain } from "@/lib/search/domain";
import type { SupportedAts } from "./ats";

// وظيفة وحدة من رابط يلصقه المستخدم. المعرّف داخل الرابط معرّف نظام التوظيف (external_id)،
// مو معرّف الوظيفة عندنا: نجيب اللوحة ونلقاها فيها.

export type JobLink =
  | { ats: SupportedAts; slug: string; externalId: string }
  // رابط على موقع الشركة نفسه (stripe.com/jobs/search?gh_jid=…): اللوحة نعرفها من نطاقها
  | { ats: SupportedAts; domain: string; externalId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GREENHOUSE_ID = /^\d{1,20}$/;
const SLUG = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,99}$/;

function segments(pathname: string): string[] {
  return pathname
    .split("/")
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
}

function board(ats: SupportedAts, slug: string | null | undefined, id: string | null | undefined): JobLink | null {
  if (!slug || !id || !SLUG.test(slug)) return null;
  if (ats === "greenhouse" ? !GREENHOUSE_ID.test(id) : !UUID.test(id)) return null;
  return { ats, slug, externalId: ats === "greenhouse" ? id : id.toLowerCase() };
}

/** يقرأ رابط وظيفة على Greenhouse أو Lever أو Ashby. null لو مو رابط وظيفة نعرفه. */
export function parseJobUrl(input: string): JobLink | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  const path = segments(url.pathname);

  // job-boards.greenhouse.io/{slug}/jobs/{id} · boards.greenhouse.io/embed/job_app?for={slug}&token={id}
  if (host === "boards.greenhouse.io" || host === "job-boards.greenhouse.io") {
    if (path[0] === "embed") return board("greenhouse", url.searchParams.get("for"), url.searchParams.get("token"));
    return path[1] === "jobs" ? board("greenhouse", path[0], path[2]) : null;
  }
  // jobs.lever.co/{slug}/{id}[/apply]
  if (host === "jobs.lever.co") return board("lever", path[0], path[1]);
  // jobs.ashbyhq.com/{slug}/{id}[/application]
  if (host === "jobs.ashbyhq.com") return board("ashby", path[0], path[1]);

  const domain = normalizeDomain(url.toString());
  if (!domain || isAggregatorDomain(domain)) return null;
  const ghId = url.searchParams.get("gh_jid");
  if (ghId && GREENHOUSE_ID.test(ghId)) return { ats: "greenhouse", domain, externalId: ghId };
  const ashbyId = url.searchParams.get("ashby_jid");
  if (ashbyId && UUID.test(ashbyId)) return { ats: "ashby", domain, externalId: ashbyId.toLowerCase() };
  return null;
}
