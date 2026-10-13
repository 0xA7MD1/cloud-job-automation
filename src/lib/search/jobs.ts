import { post, type CompanySearchProvider } from "./companies";

// بحث بالمسمى في كل لوحات Greenhouse / Lever / Ashby (مو شركة وحدة): محرك البحث بمفتاح المستخدم
// يرجّع روابط وظائف على نطاقات اللوحات، وبعدها نجيب كل لوحة من واجهتها الرسمية.
// هذي الوظائف كلها تقديمها تلقائي.

export const ATS_JOB_DOMAINS = ["job-boards.greenhouse.io", "boards.greenhouse.io", "jobs.lever.co", "jobs.ashbyhq.com"];

export interface JobLinkSearch {
  titles: string[];
  location?: string | null;
}

/** روابط وظائف من محرك البحث. بحث واحد لكل مسمى (حتى 3) عشان كل مسمى ياخذ نصيبه. */
export async function searchAtsJobLinks(
  provider: CompanySearchProvider,
  apiKey: string,
  input: JobLinkSearch,
): Promise<string[]> {
  const where = input.location?.trim() ? ` ${input.location.trim()}` : "";
  const queries = input.titles.slice(0, 3).map((title) => `${title.trim()} job${where}`);

  const results = await Promise.all(
    queries.map(async (query) => {
      if (provider === "tavily") {
        const data = await post(
          "https://api.tavily.com/search",
          { Authorization: `Bearer ${apiKey}` },
          { query, search_depth: "basic", max_results: 20, include_domains: ATS_JOB_DOMAINS },
          provider,
        );
        return data.results ?? [];
      }
      const data = await post(
        "https://api.exa.ai/search",
        { "x-api-key": apiKey },
        { query, type: "auto", numResults: 25, includeDomains: ATS_JOB_DOMAINS },
        provider,
      );
      return data.results ?? [];
    }),
  );
  const urls = results.flat().flatMap((r) => (typeof r.url === "string" ? [r.url] : []));
  return [...new Set(urls)];
}
