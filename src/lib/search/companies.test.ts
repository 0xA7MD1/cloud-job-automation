import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchProviderError, searchCompanies, toCandidates } from "./companies";

afterEach(() => vi.unstubAllGlobals());

describe("toCandidates", () => {
  it("drops job boards, duplicates and bad URLs, and respects the limit", () => {
    const results = [
      { title: "Acme | Careers", url: "https://careers.acme.com/jobs", content: "  Acme builds   rockets. " },
      { title: "Acme jobs", url: "https://www.linkedin.com/company/acme" },
      { title: "Acme again", url: "https://www.acme.com" },
      { title: "Beta", url: "nope" },
      { title: "Gamma Home", url: "https://gamma.io", text: "Gamma does AI." },
      { title: "Delta", url: "https://delta.sa" },
    ];
    expect(toCandidates(results, 2)).toEqual([
      { name: "Acme", domain: "acme.com", url: "https://careers.acme.com/jobs", snippet: "Acme builds rockets." },
      { name: "Gamma Home", domain: "gamma.io", url: "https://gamma.io", snippet: "Gamma does AI." },
    ]);
  });
});

describe("searchCompanies", () => {
  it("calls Tavily with the key in a header and maps results", async () => {
    const fetchMock = vi.fn(async () => Response.json({ results: [{ title: "Tamara", url: "https://tamara.co" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const out = await searchCompanies("tavily", "tvly-secret", { query: "fintech", location: "Riyadh", limit: 5 });
    expect(out).toEqual([{ name: "Tamara", domain: "tamara.co", url: "https://tamara.co", snippet: "" }]);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.tavily.com/search");
    expect(url).not.toContain("tvly-secret");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tvly-secret");
    expect(JSON.parse(String(init.body)).query).toBe("fintech in Riyadh company official website");
  });

  it("raises a typed error with the status code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 432 })));
    await expect(searchCompanies("exa", "k", { query: "x", limit: 3 })).rejects.toBeInstanceOf(SearchProviderError);
  });
});
