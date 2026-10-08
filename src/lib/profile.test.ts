import { describe, expect, it } from "vitest";
import { readAnswers, readPreferences, splitList } from "./profile";

describe("profile JSON readers", () => {
  it("fills defaults for empty rows", () => {
    expect(readAnswers(null).decline_voluntary_disclosures).toBe(true);
    expect(readPreferences({}).workplace).toBe("any");
  });

  it("falls back to defaults on corrupted JSON instead of crashing", () => {
    expect(readPreferences({ workplace: "moon" }).workplace).toBe("any");
    expect(readAnswers({ requires_sponsorship: 42 }).requires_sponsorship).toBe("");
  });
});

describe("splitList", () => {
  it("splits on Arabic and English commas and new lines", () => {
    expect(splitList("Frontend, Backend،الرياض\n Remote ")).toEqual(["Frontend", "Backend", "الرياض", "Remote"]);
    expect(splitList(undefined)).toEqual([]);
  });
});
