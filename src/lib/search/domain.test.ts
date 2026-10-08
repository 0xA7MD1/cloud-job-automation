import { describe, expect, it } from "vitest";
import { companyNameFromTitle, isAggregatorDomain, normalizeDomain } from "./domain";

describe("normalizeDomain", () => {
  it.each([
    ["https://www.Acme.com/about", "acme.com"],
    ["https://careers.acme.com/jobs/1", "acme.com"],
    ["jobs.acme.co.uk", "acme.co.uk"],
    ["https://www.careers.acme.sa", "acme.sa"],
    ["https://careers.com", "careers.com"],
  ])("%s ⇒ %s", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it("rejects junk and IPs", () => {
    expect(normalizeDomain("not a url")).toBeNull();
    expect(normalizeDomain("http://127.0.0.1")).toBeNull();
    expect(normalizeDomain("localhost")).toBeNull();
  });
});

describe("isAggregatorDomain", () => {
  it("flags job boards and their subdomains", () => {
    expect(isAggregatorDomain("linkedin.com")).toBe(true);
    expect(isAggregatorDomain("sa.indeed.com")).toBe(true);
    expect(isAggregatorDomain("boards.greenhouse.io")).toBe(true);
    expect(isAggregatorDomain("acme.com")).toBe(false);
    expect(isAggregatorDomain("notlinkedin.com")).toBe(false);
  });
});

describe("companyNameFromTitle", () => {
  it("picks the segment that matches the domain", () => {
    expect(companyNameFromTitle("Careers at Acme | Acme Inc", "acme.com")).toBe("Acme");
    expect(companyNameFromTitle("Home - Tamara", "tamara.co")).toBe("Tamara");
    expect(companyNameFromTitle("Build the future of payments", "stripe.com")).toBe("Build the future of payments");
  });
});
