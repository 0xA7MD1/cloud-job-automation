import { describe, expect, it, vi } from "vitest";
import { blockingMissing } from "./queue";
import { runsOnOwnerPc } from "./service";

vi.mock("server-only", () => ({}));

describe("runsOnOwnerPc", () => {
  it("keeps only the owner's local-Chrome submits on the owner's PC", () => {
    expect(runsOnOwnerPc(true, { status: "running", browser_provider: "local" })).toBe(true);
    expect(runsOnOwnerPc(true, { status: "needs_user", browser_provider: "local" })).toBe(true);
  });
  it("sends prepare, Steel runs and everyone else to the normal environment", () => {
    expect(runsOnOwnerPc(true, { status: "preparing", browser_provider: "local" })).toBe(false);
    expect(runsOnOwnerPc(true, { status: "needs_user", browser_provider: "steel" })).toBe(false);
    expect(runsOnOwnerPc(false, { status: "preparing", browser_provider: null })).toBe(false);
    expect(runsOnOwnerPc(false, { status: "running", browser_provider: "local" })).toBe(false);
  });
  it("prepares an auto-submit local-Chrome batch on the owner's PC so its submit lands there too", () => {
    expect(runsOnOwnerPc(true, { status: "preparing", browser_provider: "local", auto_submit: true })).toBe(true);
    expect(runsOnOwnerPc(true, { status: "preparing", browser_provider: "steel", auto_submit: true })).toBe(false);
    expect(runsOnOwnerPc(false, { status: "preparing", browser_provider: "local", auto_submit: true })).toBe(false);
  });
});

describe("blockingMissing", () => {
  const form = {
    ats: "ashby",
    applyUrl: "https://jobs.ashbyhq.com/x/1/application",
    fetchedAt: "",
    complete: true,
    fields: [
      { key: "resume", label: "Resume", type: "file", file: "cv", required: true, group: "basic" },
      { key: "why", label: "What excites you about X?", type: "textarea", required: true, group: "question" },
      { key: "portfolio", label: "Work samples", type: "file", file: "other", required: true, group: "question" },
      { key: "extra", label: "Anything else?", type: "textarea", required: false, group: "question" },
    ],
  };
  const app = (answers: Record<string, unknown>) => ({ form, answers, cv_file_id: "cv", cover_letter_file_id: null });

  it("blocks on a required open question without an answer", () => {
    expect(blockingMissing(app({})).map((f) => f.key)).toEqual(["why"]);
  });
  it("lets it through once answered; an 'other' file never blocks (finished in the browser)", () => {
    expect(blockingMissing(app({ why: { value: "Because...", source: "ai" } }))).toEqual([]);
  });
});
