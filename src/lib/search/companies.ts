import { AGGREGATOR_DOMAINS, companyNameFromTitle, isAggregatorDomain, normalizeDomain } from "./domain";

export type CompanySearchProvider = "tavily" | "exa";

export interface CompanyCandidate {
  name: string;
  domain: string;
  url: string;
  snippet: string;
}

export interface CompanySearchInput {
  query: string;
  location?: string;
  limit: number;
}

export class SearchProviderError extends Error {
  constructor(
    readonly provider: CompanySearchProvider,
    readonly status: number | null,
  ) {
    super(`${provider} search failed${status ? ` (${status})` : ""}`);
  }
}

const TIMEOUT_MS = 15_000;

function buildQuery({ query, location }: CompanySearchInput): string {
  return [query.trim(), location?.trim() ? `in ${location.trim()}` : "", "company official website"]
    .filter(Boolean)
    .join(" ");
}

interface RawResult {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  text?: unknown;
}

/** يحوّل نتائج المزود لشركات: يستبعد مواقع التوظيف، ويوحّد النطاق، ويشيل التكرار. */
export function toCandidates(results: RawResult[], limit: number): CompanyCandidate[] {
  const seen = new Set<string>();
  const out: CompanyCandidate[] = [];
  for (const r of results) {
    if (typeof r.url !== "string") continue;
    const domain = normalizeDomain(r.url);
    if (!domain || isAggregatorDomain(domain) || seen.has(domain)) continue;
    seen.add(domain);
    const title = typeof r.title === "string" ? r.title : domain;
    const body = typeof r.content === "string" ? r.content : typeof r.text === "string" ? r.text : "";
    out.push({
      name: companyNameFromTitle(title, domain),
      domain,
      url: r.url,
      snippet: body.replace(/\s+/g, " ").trim().slice(0, 300),
    });
    if (out.length >= limit) break;
  }
  return out;
}

async function post(url: string, headers: Record<string, string>, body: unknown, provider: CompanySearchProvider) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new SearchProviderError(provider, null);
  }
  if (!response.ok) throw new SearchProviderError(provider, response.status);
  return (await response.json()) as { results?: RawResult[] };
}

/** بحث عن شركات بمفتاح المستخدم. المفتاح في الهيدر بس. */
export async function searchCompanies(
  provider: CompanySearchProvider,
  apiKey: string,
  input: CompanySearchInput,
): Promise<CompanyCandidate[]> {
  // نطلب أكثر من المطلوب لأن بعض النتائج تنستبعد (مواقع توظيف، تكرار)
  const fetchCount = Math.min(20, input.limit * 2);

  if (provider === "tavily") {
    const data = await post(
      "https://api.tavily.com/search",
      { Authorization: `Bearer ${apiKey}` },
      {
        query: buildQuery(input),
        search_depth: "basic",
        max_results: fetchCount,
        exclude_domains: AGGREGATOR_DOMAINS.slice(0, 150),
      },
      provider,
    );
    return toCandidates(data.results ?? [], input.limit);
  }

  const data = await post(
    "https://api.exa.ai/search",
    { "x-api-key": apiKey },
    {
      query: [input.query, input.location].filter(Boolean).join(" "),
      category: "company",
      type: "auto",
      numResults: fetchCount,
      contents: { text: { maxCharacters: 400 } },
    },
    provider,
  );
  return toCandidates(data.results ?? [], input.limit);
}
