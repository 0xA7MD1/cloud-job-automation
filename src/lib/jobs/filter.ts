import type { JobPosting } from "./ats";

export interface JobFilter {
  /** كلمات من المسمى (أي وحدة منها تكفي) */
  keywords?: string[];
  /** جزء من الموقع: مدينة أو دولة أو Remote */
  location?: string | null;
  /** أي واحد منها يكفي (تفضيلات المستخدم). يتجاهل لو location محدد */
  locations?: string[];
  workplace?: "any" | "remote" | "hybrid" | "onsite";
  /** لو ظهرت في المسمى نستبعد الوظيفة */
  exclude?: string[];
}

const fold = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

function tokens(list: string[] | undefined): string[] {
  return (list ?? [])
    .flatMap((k) => fold(k).split(/[,،]/))
    .map((k) => k.trim())
    .filter((k) => k.length >= 2);
}

/** يفلتر ويرتّب: الأقوى تطابقًا مع الكلمات أول، ثم الأحدث. */
export function filterJobs<T extends Pick<JobPosting, "title" | "location" | "workplaceType" | "postedAt">>(
  jobs: T[],
  filter: JobFilter,
): T[] {
  const keywords = tokens(filter.keywords);
  const exclude = tokens(filter.exclude);
  const locations = (filter.location ? [filter.location] : (filter.locations ?? []))
    .map((l) => fold(l).trim())
    .filter(Boolean);

  const scored = jobs.flatMap((job) => {
    const title = fold(job.title);
    if (exclude.some((word) => title.includes(word))) return [];

    if (locations.length > 0) {
      const where = fold(job.location ?? "");
      const ok = locations.some((location) => {
        const wantsRemote = location.includes("remote") || location.includes("عن بعد");
        return where.includes(location) || (wantsRemote && job.workplaceType === "remote");
      });
      if (!ok) return [];
    }
    if (filter.workplace && filter.workplace !== "any" && job.workplaceType && job.workplaceType !== filter.workplace) {
      return [];
    }

    let score = 0;
    if (keywords.length > 0) {
      for (const word of keywords) {
        if (title.includes(word)) score += word.includes(" ") ? 3 : 2;
        else if (word.includes(" ") && word.split(/\s+/).every((part) => title.includes(part))) score += 1;
      }
      if (score === 0) return [];
    }
    return [{ job, score }];
  });

  return scored
    .sort((a, b) => b.score - a.score || (b.job.postedAt ?? "").localeCompare(a.job.postedAt ?? ""))
    .map((s) => s.job);
}
