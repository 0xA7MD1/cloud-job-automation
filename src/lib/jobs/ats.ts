import type { JobSource } from "@/lib/db/types";
import { htmlToText } from "./html";
import { discardBody } from "@/lib/http";

export type SupportedAts = "greenhouse" | "lever" | "ashby";
export const SUPPORTED_ATS: readonly SupportedAts[] = ["greenhouse", "lever", "ashby"];

export function isSupportedAts(value: string | null | undefined): value is SupportedAts {
  return !!value && (SUPPORTED_ATS as readonly string[]).includes(value);
}

/** وظيفة موحّدة من أي نظام توظيف، جاهزة لجدول jobs */
export interface JobPosting {
  source: JobSource;
  externalId: string;
  title: string;
  location: string | null;
  workplaceType: "onsite" | "remote" | "hybrid" | null;
  employmentType: string | null;
  department: string | null;
  description: string | null;
  url: string;
  applyUrl: string | null;
  postedAt: string | null;
}

const TIMEOUT_MS = 20_000;

export class AtsFetchError extends Error {
  constructor(
    readonly ats: SupportedAts,
    readonly status: number | null,
  ) {
    super(`${ats} jobs fetch failed${status ? ` (${status})` : ""}`);
  }
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function workplace(value: unknown, location?: string | null): JobPosting["workplaceType"] {
  const v = `${typeof value === "string" ? value : ""}`.toLowerCase().replace(/[^a-z]/g, "");
  if (v === "remote") return "remote";
  if (v === "hybrid") return "hybrid";
  if (v === "onsite" || v === "inoffice") return "onsite";
  if (location && /\bremote\b/i.test(location)) return "remote";
  return null;
}

function isoDate(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

// ---------------------------------------------------------------------------
// Greenhouse: https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
// ---------------------------------------------------------------------------
export function parseGreenhouse(body: unknown): JobPosting[] {
  const jobs = (body as { jobs?: Record<string, unknown>[] })?.jobs ?? [];
  return jobs.flatMap((j) => {
    const id = j.id;
    const title = str(j.title);
    const url = str(j.absolute_url);
    if ((typeof id !== "number" && typeof id !== "string") || !title || !url) return [];
    const location = str((j.location as { name?: unknown } | undefined)?.name);
    const departments = (j.departments as { name?: unknown }[] | undefined) ?? [];
    return [
      {
        source: "greenhouse" as const,
        externalId: String(id),
        title,
        location,
        workplaceType: workplace(null, location),
        employmentType: null,
        department: str(departments[0]?.name),
        description: typeof j.content === "string" ? htmlToText(j.content) : null,
        url,
        applyUrl: url,
        postedAt: isoDate(j.first_published ?? j.updated_at),
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Lever: https://api.lever.co/v0/postings/{site}?mode=json
// ---------------------------------------------------------------------------
export function parseLever(body: unknown): JobPosting[] {
  const jobs = Array.isArray(body) ? (body as Record<string, unknown>[]) : [];
  return jobs.flatMap((j) => {
    const id = str(j.id);
    const title = str(j.text);
    const url = str(j.hostedUrl);
    if (!id || !title || !url) return [];
    const categories = (j.categories as Record<string, unknown> | undefined) ?? {};
    const location = str(categories.location);
    const description = [str(j.descriptionPlain), str(j.additionalPlain)].filter(Boolean).join("\n\n");
    return [
      {
        source: "lever" as const,
        externalId: id,
        title,
        location,
        workplaceType: workplace(j.workplaceType, location),
        employmentType: str(categories.commitment),
        department: str(categories.team) ?? str(categories.department),
        description: description ? description.slice(0, 20_000) : null,
        url,
        applyUrl: str(j.applyUrl),
        postedAt: isoDate(j.createdAt),
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Ashby: https://api.ashbyhq.com/posting-api/job-board/{name}
// ---------------------------------------------------------------------------
export function parseAshby(body: unknown): JobPosting[] {
  const jobs = (body as { jobs?: Record<string, unknown>[] })?.jobs ?? [];
  return jobs.flatMap((j) => {
    const id = str(j.id);
    const title = str(j.title);
    const url = str(j.jobUrl);
    if (!id || !title || !url || j.isListed === false) return [];
    const location = str(j.location);
    const description = str(j.descriptionPlain) ?? (typeof j.descriptionHtml === "string" ? htmlToText(j.descriptionHtml) : null);
    return [
      {
        source: "ashby" as const,
        externalId: id,
        title,
        location,
        workplaceType: workplace(j.workplaceType, location) ?? (j.isRemote === true ? "remote" : null),
        employmentType: str(j.employmentType),
        department: str(j.department) ?? str(j.team),
        description: description ? description.slice(0, 20_000) : null,
        url,
        applyUrl: str(j.applyUrl),
        postedAt: isoDate(j.publishedAt),
      },
    ];
  });
}

const ENDPOINTS: Record<SupportedAts, (slug: string) => string> = {
  greenhouse: (slug) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`,
  lever: (slug) => `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`,
  ashby: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`,
};

const PARSERS: Record<SupportedAts, (body: unknown) => JobPosting[]> = {
  greenhouse: parseGreenhouse,
  lever: parseLever,
  ashby: parseAshby,
};

/**
 * يجيب كل الوظائف المفتوحة لشركة من واجهة نظام التوظيف العامة (بدون مفتاح).
 * يرجّع null لو اللوحة مو موجودة (404)، ويرمي AtsFetchError لأي خطأ ثاني.
 */
export async function fetchAtsJobs(ats: SupportedAts, slug: string): Promise<JobPosting[] | null> {
  let response: Response;
  try {
    response = await fetch(ENDPOINTS[ats](slug), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new AtsFetchError(ats, null);
  }
  if (response.status === 404 || !response.ok) {
    discardBody(response);
    if (response.status === 404) return null;
    throw new AtsFetchError(ats, response.status);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // انقطع أو انتهت المهلة وسط قراءة الرد
    throw new AtsFetchError(ats, null);
  }
  return PARSERS[ats](body);
}

export function atsBoardUrl(ats: SupportedAts, slug: string): string {
  if (ats === "greenhouse") return `https://job-boards.greenhouse.io/${slug}`;
  if (ats === "lever") return `https://jobs.lever.co/${slug}`;
  return `https://jobs.ashbyhq.com/${slug}`;
}
