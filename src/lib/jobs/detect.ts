import type { Ats } from "@/lib/db/types";
import { fetchAtsJobs, type SupportedAts } from "./ats";
import { discardBody } from "@/lib/http";

export interface AtsMatch {
  ats: Ats;
  slug: string | null;
  careersUrl: string | null;
}

const SLUG = "([A-Za-z0-9][A-Za-z0-9_.-]{0,99})";

// روابط لوحات التوظيف كما تظهر في صفحات الشركات (روابط، iframe، سكربتات التضمين)
const PATTERNS: { ats: SupportedAts; regex: RegExp }[] = [
  { ats: "greenhouse", regex: new RegExp(`(?:job-)?boards(?:-api)?\\.greenhouse\\.io/(?:v1/boards/|embed/job_board(?:/js)?\\?for=)?${SLUG}`, "i") },
  { ats: "greenhouse", regex: new RegExp(`greenhouse\\.io/embed/job_board(?:/js)?\\?for=${SLUG}`, "i") },
  { ats: "lever", regex: new RegExp(`jobs\\.(?:eu\\.)?lever\\.co/${SLUG}`, "i") },
  { ats: "lever", regex: new RegExp(`api\\.lever\\.co/v0/postings/${SLUG}`, "i") },
  { ats: "ashby", regex: new RegExp(`jobs\\.ashbyhq\\.com/${SLUG}`, "i") },
  { ats: "ashby", regex: new RegExp(`api\\.ashbyhq\\.com/posting-api/job-board/${SLUG}`, "i") },
];

// مقاطع روابط مو أسماء شركات
const IGNORED_SLUGS = new Set(["embed", "v1", "js", "api", "jobs", "job_board", "static", "assets", "favicon.ico"]);

/** يلقى نظام التوظيف من HTML صفحة الشركة. */
export function detectAtsInHtml(html: string): { ats: Ats; slug: string | null } | null {
  for (const { ats, regex } of PATTERNS) {
    const match = regex.exec(html);
    const slug = match?.[1]?.replace(/[.]+$/, "");
    if (slug && !IGNORED_SLUGS.has(slug.toLowerCase())) return { ats, slug };
  }
  if (/myworkdayjobs\.com/i.test(html)) return { ats: "workday", slug: null };
  if (/smartrecruiters\.com|workable\.com|bamboohr\.com|recruitee\.com|icims\.com|taleo\.net|successfactors/i.test(html)) {
    return { ats: "other", slug: null };
  }
  return null;
}

const PAGE_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 1_500_000;

/** يجيب صفحة HTML عامة بحدود (وقت وحجم). https بس، وبدون منافذ مخصصة. */
async function fetchPage(url: string): Promise<string | null> {
  return (await fetchHtmlPage(url))?.html ?? null;
}

/** مثل fetchPage، ويرجّع الرابط النهائي بعد التحويلات (للروابط النسبية داخل الصفحة) */
export async function fetchHtmlPage(url: string): Promise<{ url: string; html: string } | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.port) return null;
  try {
    const response = await fetch(parsed, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JobAssistantBot/1.0)", Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok || !response.body || !(response.headers.get("content-type") ?? "").includes("html")) {
      discardBody(response);
      return null;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
    await reader.cancel().catch(() => undefined);
    return { url: response.url || parsed.toString(), html: new TextDecoder().decode(Buffer.concat(chunks)) };
  } catch {
    return null;
  }
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]/g, "");

/**
 * نخمّن اسم اللوحة من النطاق (stripe.com ⇒ stripe) ونتأكد إن الوظائف فعلًا للشركة:
 * الوصف أو الرابط لازم يذكر اسمها أو نطاقها، عشان ما نربط الشركة بلوحة شركة ثانية بنفس الاسم.
 */
async function guessFromDomain(domain: string, companyName: string): Promise<{ ats: SupportedAts; slug: string } | null> {
  const root = domain.split(".")[0] ?? "";
  if (root.length < 2) return null;
  const needles = [normalize(companyName), normalize(root), domain.toLowerCase()].filter((n) => n.length >= 3);

  for (const ats of ["greenhouse", "lever", "ashby"] as const) {
    let jobs;
    try {
      jobs = await fetchAtsJobs(ats, root);
    } catch {
      continue;
    }
    if (!jobs || jobs.length === 0) continue;
    const mentions = jobs.slice(0, 20).some((job) => {
      const text = `${job.description ?? ""} ${job.url}`.toLowerCase();
      return needles.some((n) => text.includes(n) || normalize(text).includes(n));
    });
    if (mentions) return { ats, slug: root };
  }
  return null;
}

/**
 * يحدد نظام التوظيف لشركة: يقرأ موقعها وصفحة careers أول، ثم يخمّن من النطاق.
 */
export async function detectCompanyAts(domain: string, companyName: string): Promise<AtsMatch> {
  const candidates = [`https://${domain}/careers`, `https://${domain}/jobs`, `https://${domain}`, `https://careers.${domain}`];
  let otherSystem: AtsMatch | null = null;

  for (const url of candidates) {
    const html = await fetchPage(url);
    if (!html) continue;
    const found = detectAtsInHtml(html);
    if (found && found.slug) return { ats: found.ats, slug: found.slug, careersUrl: url };
    if (found && !otherSystem) otherSystem = { ats: found.ats, slug: null, careersUrl: url };
  }

  const guessed = await guessFromDomain(domain, companyName);
  if (guessed) return { ...guessed, careersUrl: null };
  return otherSystem ?? { ats: "unknown", slug: null, careersUrl: null };
}
