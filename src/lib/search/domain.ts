// مواقع تجمّع وظائف أو بيانات شركات: مو موقع الشركة الرسمي، فنستبعدها من نتائج البحث عن الشركات.
export const AGGREGATOR_DOMAINS = [
  "linkedin.com", "indeed.com", "glassdoor.com", "glassdoor.sa", "bayt.com", "naukrigulf.com", "gulftalent.com",
  "wuzzuf.net", "monster.com", "ziprecruiter.com", "simplyhired.com", "jooble.org", "talent.com", "careerjet.com",
  "akhtaboot.com", "tanqeeb.com", "laimoon.com", "drjobpro.com", "builtin.com", "wellfound.com", "ycombinator.com",
  "workatastartup.com", "crunchbase.com", "zoominfo.com", "tracxn.com", "owler.com", "dnb.com", "pitchbook.com",
  "wikipedia.org", "facebook.com", "instagram.com", "x.com", "twitter.com", "youtube.com", "tiktok.com",
  "reddit.com", "medium.com", "quora.com", "google.com", "apple.com", "play.google.com",
  "greenhouse.io", "lever.co", "ashbyhq.com", "workable.com", "myworkdayjobs.com", "smartrecruiters.com",
  "bamboohr.com", "recruitee.com", "jobvite.com", "icims.com", "taleo.net", "successfactors.com",
] as const;

// بادئات شائعة نشيلها عشان يبقى نطاق الشركة نفسه (careers.acme.com ⇒ acme.com)
const STRIP_PREFIXES = ["www.", "careers.", "career.", "jobs.", "job.", "en.", "ar.", "about.", "corporate."];

/** نطاق الشركة من رابط: أحرف صغيرة، بدون www أو careers. null لو الرابط مو صالح. */
export function normalizeDomain(input: string): string | null {
  let host: string;
  try {
    host = new URL(input.includes("://") ? input : `https://${input}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!host.includes(".") || /^\d+(\.\d+){3}$/.test(host)) return null;

  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of STRIP_PREFIXES) {
      if (host.startsWith(prefix) && host.split(".").length > 2) {
        host = host.slice(prefix.length);
        changed = true;
      }
    }
  }
  return host;
}

export function isAggregatorDomain(domain: string): boolean {
  return AGGREGATOR_DOMAINS.some((agg) => domain === agg || domain.endsWith(`.${agg}`));
}

/**
 * اسم الشركة من عنوان الصفحة: "Careers at Acme | Acme Inc" ⇒ "Acme Inc".
 * نختار المقطع الأقرب لنطاق الشركة، وإلا أول مقطع.
 */
export function companyNameFromTitle(title: string, domain: string): string {
  const root = domain.split(".")[0] ?? domain;
  const segments = title
    .split(/\s+[|–—\-:·•]\s+/)
    .map((s) => s.replace(/^(careers|jobs|work)\s+(at|with)\s+/i, "").trim())
    .filter(Boolean);
  const match = segments.find((s) => s.toLowerCase().replace(/[^a-z0-9]/g, "").includes(root.replace(/[^a-z0-9]/g, "")));
  const name = match ?? segments[0] ?? root;
  return name.slice(0, 200);
}
