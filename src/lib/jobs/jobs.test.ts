import { afterEach, describe, expect, it, vi } from "vitest";
import ashby from "./__fixtures__/ashby.json";
import greenhouse from "./__fixtures__/greenhouse.json";
import lever from "./__fixtures__/lever.json";
import { AtsFetchError, fetchAtsJobs, parseAshby, parseGreenhouse, parseLever } from "./ats";
import { detectAtsInHtml } from "./detect";
import { filterJobs } from "./filter";
import { htmlToText } from "./html";
import { parseJobUrl } from "./url";

afterEach(() => vi.unstubAllGlobals());

describe("htmlToText", () => {
  it("decodes Greenhouse double-encoded HTML into readable lines", () => {
    const text = htmlToText("&lt;h2&gt;Who we are&lt;/h2&gt;&lt;ul&gt;&lt;li&gt;Fast &amp;amp; calm&lt;/li&gt;&lt;/ul&gt;");
    expect(text).toBe("Who we are\n\n• Fast & calm");
  });
  it("drops scripts and styles", () => {
    expect(htmlToText("<p>Hi</p><script>alert(1)</script><style>p{}</style>")).toBe("Hi");
  });
});

describe("ATS parsers (real API samples)", () => {
  it("parses Greenhouse", () => {
    const [job] = parseGreenhouse(greenhouse);
    expect(job).toMatchObject({
      source: "greenhouse",
      externalId: "8172508",
      title: "Abuse Investigator",
      location: "Dublin",
      url: "https://stripe.com/jobs/search?gh_jid=8172508",
    });
    expect(job?.description).toContain("Stripe is a financial infrastructure platform");
    expect(job?.description).not.toContain("&lt;");
    expect(job?.postedAt).toBe("2026-09-03T17:32:53.000Z");
  });

  it("parses Lever", () => {
    const [job] = parseLever(lever);
    expect(job).toMatchObject({
      source: "lever",
      title: "Administrative Business Partner",
      location: "Singapore, Singapore",
      workplaceType: "hybrid",
      employmentType: "Full-time",
      department: "Administrative",
    });
    expect(job?.applyUrl).toMatch(/\/apply$/);
  });

  it("parses Ashby", () => {
    const [job] = parseAshby(ashby);
    expect(job).toMatchObject({
      source: "ashby",
      title: "Engineering Manager - EU",
      workplaceType: "remote",
      employmentType: "FullTime",
      department: "Engineering",
    });
    expect(job?.applyUrl).toMatch(/\/application$/);
  });

  it("skips malformed rows instead of crashing", () => {
    expect(parseGreenhouse({ jobs: [{ id: 1 }] })).toEqual([]);
    expect(parseLever({ not: "an array" })).toEqual([]);
    expect(parseAshby({ jobs: [{ id: "x", title: "t", jobUrl: "u", isListed: false }] })).toEqual([]);
  });
});

describe("fetchAtsJobs", () => {
  it("returns null for a board that does not exist", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Not Found", { status: 404 })));
    await expect(fetchAtsJobs("ashby", "nope")).resolves.toBeNull();
  });
  it("throws a typed error on other failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    await expect(fetchAtsJobs("lever", "x")).rejects.toBeInstanceOf(AtsFetchError);
  });
  it("encodes the slug in the URL", async () => {
    const fetchMock = vi.fn(async () => Response.json({ jobs: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchAtsJobs("greenhouse", "a/b?c");
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toContain("/boards/a%2Fb%3Fc/jobs");
  });
});

describe("detectAtsInHtml", () => {
  it.each([
    ['<a href="https://boards.greenhouse.io/acme/jobs/1">', "greenhouse", "acme"],
    ['<a href="https://job-boards.greenhouse.io/acme">', "greenhouse", "acme"],
    ['<script src="https://boards.greenhouse.io/embed/job_board/js?for=acme"></script>', "greenhouse", "acme"],
    ['<a href="https://jobs.lever.co/acme-inc/">Jobs</a>', "lever", "acme-inc"],
    ['<iframe src="https://jobs.ashbyhq.com/acme.ai/embed">', "ashby", "acme.ai"],
  ])("finds %s", (html, ats, slug) => {
    expect(detectAtsInHtml(html)).toEqual({ ats, slug });
  });

  it("recognises unsupported systems and plain pages", () => {
    expect(detectAtsInHtml('<a href="https://acme.wd3.myworkdayjobs.com/en-US/careers">')).toEqual({ ats: "workday", slug: null });
    expect(detectAtsInHtml("<p>We are hiring!</p>")).toBeNull();
  });
});

describe("parseJobUrl", () => {
  const replit = "7c3c9d29-cec2-4367-8564-eadaed165aea";
  it.each([
    [`https://jobs.ashbyhq.com/replit/${replit}`, { ats: "ashby", slug: "replit", externalId: replit }],
    [`https://jobs.ashbyhq.com/replit/${replit.toUpperCase()}/application?utm_source=x`, { ats: "ashby", slug: "replit", externalId: replit }],
    ["https://jobs.ashbyhq.com/Lemon%20Squeezy/" + replit, { ats: "ashby", slug: "Lemon Squeezy", externalId: replit }],
    [`https://jobs.lever.co/acme-inc/${replit}/apply`, { ats: "lever", slug: "acme-inc", externalId: replit }],
    ["https://job-boards.greenhouse.io/stripe/jobs/8172508?gh_src=abc", { ats: "greenhouse", slug: "stripe", externalId: "8172508" }],
    ["https://boards.greenhouse.io/stripe/jobs/8172508", { ats: "greenhouse", slug: "stripe", externalId: "8172508" }],
    ["https://boards.greenhouse.io/embed/job_app?for=stripe&token=8172508", { ats: "greenhouse", slug: "stripe", externalId: "8172508" }],
    ["https://stripe.com/jobs/search?gh_jid=8172508", { ats: "greenhouse", domain: "stripe.com", externalId: "8172508" }],
    [`https://www.acme.ai/careers?ashby_jid=${replit}`, { ats: "ashby", domain: "acme.ai", externalId: replit }],
  ])("reads %s", (url, expected) => {
    expect(parseJobUrl(url)).toEqual(expected);
  });

  it.each([
    "https://jobs.ashbyhq.com/replit",
    "https://jobs.ashbyhq.com/replit/not-a-job-id",
    "https://job-boards.greenhouse.io/stripe",
    "https://jobs.lever.co/acme/123",
    "https://www.linkedin.com/jobs/view/123?gh_jid=123",
    "https://stripe.com/jobs",
    "javascript:alert(1)",
    "not a url",
  ])("ignores %s", (url) => {
    expect(parseJobUrl(url)).toBeNull();
  });
});

describe("filterJobs", () => {
  const jobs = [
    { title: "Senior Frontend Engineer", location: "Riyadh, Saudi Arabia", workplaceType: "onsite" as const, postedAt: "2026-10-01" },
    { title: "Frontend Engineer", location: "Remote - EMEA", workplaceType: "remote" as const, postedAt: "2026-10-05" },
    { title: "Backend Engineer", location: "Riyadh", workplaceType: null, postedAt: "2026-10-06" },
    { title: "Frontend Intern", location: "Riyadh", workplaceType: null, postedAt: "2026-10-07" },
  ];

  it("matches keywords, excludes words and ranks by relevance then date", () => {
    const out = filterJobs(jobs, { keywords: ["frontend engineer"], exclude: ["intern"] });
    expect(out.map((j) => j.title)).toEqual(["Frontend Engineer", "Senior Frontend Engineer"]);
  });

  it("filters by location, treating 'remote' as the workplace type", () => {
    expect(filterJobs(jobs, { location: "riyadh" }).map((j) => j.title)).toHaveLength(3);
    expect(filterJobs(jobs, { location: "Remote" }).map((j) => j.title)).toEqual(["Frontend Engineer"]);
  });
});

describe("filterJobs with several preferred locations", () => {
  it("keeps jobs in any of them", () => {
    const jobs = [
      { title: "Engineer", location: "Riyadh", workplaceType: null, postedAt: null },
      { title: "Engineer", location: "Dubai", workplaceType: null, postedAt: null },
      { title: "Engineer", location: "Berlin", workplaceType: "remote" as const, postedAt: null },
      { title: "Engineer", location: "London", workplaceType: null, postedAt: null },
    ];
    expect(filterJobs(jobs, { locations: ["Riyadh", "dubai", "Remote"] }).map((j) => j.location)).toEqual([
      "Riyadh",
      "Dubai",
      "Berlin",
    ]);
  });
});
