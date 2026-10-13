import { MockLanguageModelV4 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractCareersJobs, extractLinks, isNotFoundPage, pickCareersLink, type CareersPage } from "./careers";
import { searchPlaces } from "@/lib/search/places";
import { findWorkableSlug, parseWorkable, workableSlug } from "./workable";

function modelReturning(output: unknown) {
  return new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: "text", text: JSON.stringify(output) }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 10, text: 10, reasoning: 0 },
      },
      warnings: [],
    },
  });
}

const page: CareersPage = {
  url: "https://acme.sa/careers",
  text: "Join Acme. Open positions: Frontend Developer (Riyadh), Accountant (Jeddah). Send your CV to hr@acme.sa. ".repeat(3),
  links: [
    { text: "Home", url: "https://acme.sa/" },
    { text: "Frontend Developer", url: "https://acme.sa/careers/frontend" },
  ],
  siteTitle: "Acme | Home",
  rendered: false,
};

describe("careers page links", () => {
  it("reads absolute links with their text and drops fragments, mailto and duplicates", () => {
    const html = `
      <a href="/careers">الوظائف</a>
      <a href="https://acme.sa/careers#top">Careers again</a>
      <a href="mailto:hr@acme.sa">mail</a>
      <a class="x" href='about'><span>About</span> us</a>`;
    expect(extractLinks(html, "https://acme.sa/en/")).toEqual([
      { text: "الوظائف", url: "https://acme.sa/careers" },
      { text: "About us", url: "https://acme.sa/en/about" },
    ]);
  });

  it("picks the careers link on the same site or a known hiring system, never another site", () => {
    const links = [
      { text: "News", url: "https://acme.sa/news" },
      { text: "Careers at Partner", url: "https://partner.com/careers" },
      { text: "انضم لفريقنا", url: "https://acme.sa/join" },
    ];
    expect(pickCareersLink(links, "acme.sa")).toBe("https://acme.sa/join");
    expect(pickCareersLink([{ text: "Jobs", url: "https://apply.workable.com/acme/" }], "acme.sa")).toBe(
      "https://apply.workable.com/acme/",
    );
    expect(pickCareersLink([{ text: "Careers", url: "https://other.com/careers" }], "acme.sa")).toBeNull();
  });
});

describe("extractCareersJobs", () => {
  it("keeps only listed jobs, uses links from the page list and the careers page otherwise", async () => {
    const model = modelReturning({
      isCareersPage: true,
      noOpenings: false,
      applyEmail: "HR@acme.sa",
      moreJobsLink: -1,
      jobs: [
        { title: "Frontend Developer", location: "Riyadh", department: "", link: 1 },
        { title: "Accountant", location: "Jeddah", department: "Finance", link: -1 },
        { title: "Made up", location: "", department: "", link: 99 },
        { title: "Frontend Developer", location: "Riyadh", department: "", link: 1 },
      ],
    });
    const result = await extractCareersJobs(model, page, { id: "c1", name: "Acme" });
    expect(result.readable).toBe(true);
    expect(result.applyEmail).toBe("hr@acme.sa");
    expect(result.postings.map((p) => [p.title, p.url])).toEqual([
      ["Frontend Developer", "https://acme.sa/careers/frontend"],
      ["Accountant", "https://acme.sa/careers"],
      ["Made up", "https://acme.sa/careers"],
    ]);
    expect(result.postings.every((p) => p.source === "careers_page" && p.externalId.length === 40)).toBe(true);
    // نفس الوظيفة بنفس الرابط = نفس المعرّف في كل قراءة
    const again = await extractCareersJobs(model, page, { id: "c1", name: "Acme" });
    expect(again.postings[0]!.externalId).toBe(result.postings[0]!.externalId);
  });

  it("does not trust an empty answer for a page that is not a careers page", async () => {
    const model = modelReturning({ isCareersPage: false, noOpenings: false, applyEmail: "", moreJobsLink: -1, jobs: [] });
    const result = await extractCareersJobs(model, page, { id: "c1", name: "Acme" });
    expect(result).toEqual({ postings: [], applyEmail: null, moreJobsUrl: null, readable: false });
  });

  it("points to the page that lists the jobs when this one only links to it", async () => {
    const model = modelReturning({ isCareersPage: true, noOpenings: false, applyEmail: "", moreJobsLink: 1, jobs: [] });
    const result = await extractCareersJobs(model, page, { id: "c1", name: "Acme" });
    expect(result.moreJobsUrl).toBe("https://acme.sa/careers/frontend");
    expect(result.readable).toBe(false);
  });

  it("treats 404 pages served with status 200 as missing", () => {
    expect(isNotFoundPage("https://elm.sa/Pages/PageNotFoundError.aspx?requestUrl=x", "Home")).toBe(true);
    expect(isNotFoundPage("https://elm.sa/careers", "Menu\n## 404\nPage Not Found")).toBe(true);
    expect(isNotFoundPage("https://acme.sa/careers", "Open positions: Frontend Developer")).toBe(false);
  });
});

describe("searchPlaces", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns place ids with company domains and skips places without a real website", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        places: [
          { id: "p1", websiteUri: "https://www.acme.sa/ar" },
          { id: "p2", websiteUri: "https://instagram.com/acme" },
          { id: "p3" },
          { id: "p4", websiteUri: "https://acme.sa/branch-2" },
          { id: "p5", websiteUri: "https://linktr.ee/shop" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await searchPlaces("key", { query: "software company", area: "Riyadh", limit: 20 });
    expect(result).toEqual({ hits: [{ placeId: "p1", domain: "acme.sa" }], withoutWebsite: 3 });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["X-Goog-FieldMask"]).toBe("places.id,places.websiteUri");
    expect(JSON.parse(init.body as string)).toMatchObject({ textQuery: "software company in Riyadh", pageSize: 20 });
  });
});

describe("workable", () => {
  it("reads the account from every Workable link shape and ignores job shortlinks", () => {
    expect(workableSlug("https://apply.workable.com/mozn-ai/?lng=en")).toBe("mozn-ai");
    expect(workableSlug("http://foodics.workable.com/")).toBe("foodics");
    expect(workableSlug("https://apply.workable.com/api/v1/widget/accounts/acme")).toBe("acme");
    expect(workableSlug("https://apply.workable.com/j/9BDF0B39E6")).toBeNull();
    expect(workableSlug("https://acme.sa/careers")).toBeNull();
    expect(findWorkableSlug(["https://acme.sa/", "https://apply.workable.com/acme/j/ABC/"])).toBe("acme");
  });

  it("maps the public widget feed to stable job postings", () => {
    const postings = parseWorkable({
      jobs: [
        {
          title: "AI Engineer",
          shortcode: "9BDF0B39E6",
          employment_type: "Full-time",
          telecommuting: false,
          department: "Technology",
          url: "https://apply.workable.com/j/9BDF0B39E6",
          application_url: "https://apply.workable.com/j/9BDF0B39E6/apply",
          published_on: "2026-09-29",
          city: "Riyadh",
          country: "Saudi Arabia",
        },
        { title: "No code", url: "https://x" },
      ],
    });
    expect(postings).toEqual([
      expect.objectContaining({
        source: "careers_page",
        externalId: "workable:9BDF0B39E6",
        title: "AI Engineer",
        location: "Riyadh, Saudi Arabia",
        department: "Technology",
        applyUrl: "https://apply.workable.com/j/9BDF0B39E6/apply",
      }),
    ]);
  });
});
