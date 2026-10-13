import type { Page } from "playwright-core";
import { describe, expect, it, vi } from "vitest";
import { liveSessionId } from "@/lib/browser";
import type { AtsAdapter, FillPlan, FillReport, Outcome } from "./adapters/common";
import { adapterFor, runSubmission, type SubmissionHooks } from "./submit";

const page = { waitForTimeout: async () => {} } as unknown as Page;

const plan: FillPlan = {
  form: { ats: "greenhouse", applyUrl: "https://example.test/apply", fetchedAt: "", complete: true, fields: [] },
  answers: {},
  files: { cv: { name: "cv.pdf", mimeType: "application/pdf", buffer: Buffer.from("x") }, coverLetter: null },
  profile: { city: null, country: null, phone: null },
};

function adapter(opts: { open?: boolean; fill?: FillReport; outcomes?: Outcome[] }) {
  const outcomes = [...(opts.outcomes ?? [])];
  return {
    ats: "greenhouse",
    open: vi.fn(async () => opts.open ?? true),
    fill: vi.fn(async () => opts.fill ?? { filled: ["email"], skipped: [] }),
    submit: vi.fn(async () => {}),
    outcome: vi.fn(async () => outcomes.shift() ?? { kind: "pending" as const }),
  } satisfies AtsAdapter;
}

function hooks(opts: { attempt?: boolean; userOutcome?: Outcome } = {}) {
  return {
    step: vi.fn(),
    markSubmitAttempted: vi.fn<SubmissionHooks["markSubmitAttempted"]>(async () => opts.attempt ?? true),
    waitForUser: vi.fn<SubmissionHooks["waitForUser"]>(async () => opts.userOutcome ?? { kind: "pending" }),
  } satisfies SubmissionHooks;
}

const submitted: Outcome = { kind: "submitted", confirmationRef: "ABC-123", text: "Thank you for applying" };

describe("runSubmission", () => {
  it("records the attempt before clicking submit, then succeeds on the confirmation page", async () => {
    const a = adapter({ outcomes: [submitted] });
    const h = hooks();
    const result = await runSubmission(page, a, plan, h);
    expect(result).toMatchObject({ status: "submitted", confirmationRef: "ABC-123" });
    expect(h.markSubmitAttempted).toHaveBeenCalledWith("auto");
    expect(h.markSubmitAttempted.mock.invocationCallOrder[0]!).toBeLessThan(a.submit.mock.invocationCallOrder[0]!);
    expect(h.waitForUser).not.toHaveBeenCalled();
  });

  it("never clicks submit twice when an attempt was already recorded", async () => {
    const a = adapter({});
    const result = await runSubmission(page, a, plan, hooks({ attempt: false }));
    expect(result).toMatchObject({ status: "failed", attempted: true });
    expect(a.submit).not.toHaveBeenCalled();
  });

  it("hands over to the user when a required field could not be filled", async () => {
    const a = adapter({ fill: { filled: [], skipped: [{ key: "q", label: "Visa?", required: true, reason: "no answer" }] } });
    const h = hooks({ userOutcome: submitted });
    const result = await runSubmission(page, a, plan, h);
    expect(result.status).toBe("submitted");
    expect(h.markSubmitAttempted).toHaveBeenCalledWith("handed_to_user");
    expect(h.waitForUser.mock.calls[0]![0]).toContain("Visa?");
    expect(a.submit).not.toHaveBeenCalled();
  });

  it("in an unattended batch, stops before submit when a required field could not be filled", async () => {
    const a = adapter({ fill: { filled: [], skipped: [{ key: "q", label: "Visa?", required: true, reason: "option not found" }] } });
    const h = hooks();
    const result = await runSubmission(page, a, plan, h, { unattended: true });
    expect(result).toMatchObject({ status: "failed", attempted: false });
    if (result.status === "failed") expect(result.error).toContain("Visa?");
    expect(h.markSubmitAttempted).not.toHaveBeenCalled();
    expect(h.waitForUser).not.toHaveBeenCalled();
    expect(a.submit).not.toHaveBeenCalled();
  });

  it("waits for the user on a captcha and reports a possible submission on timeout", async () => {
    const a = adapter({ outcomes: [{ kind: "captcha" }] });
    const h = hooks();
    const result = await runSubmission(page, a, plan, h);
    expect(h.waitForUser.mock.calls[0]![0]).toContain("كابتشا");
    expect(result).toMatchObject({ status: "failed", attempted: true });
  });

  it("stops before any attempt when the page does not open", async () => {
    const a = adapter({ open: false, outcomes: [{ kind: "closed" }] });
    const h = hooks();
    const result = await runSubmission(page, a, plan, h);
    expect(result).toMatchObject({ status: "failed", attempted: false });
    expect(h.markSubmitAttempted).not.toHaveBeenCalled();
  });
});

describe("liveSessionId", () => {
  it("is a stable v4-shaped UUID per application run", () => {
    const id = liveSessionId("app-1", "run_1");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(liveSessionId("app-1", "run_1")).toBe(id);
    expect(liveSessionId("app-1", "run_2")).not.toBe(id);
  });
});

describe("adapters", () => {
  it("cover every supported ATS", () => {
    expect(adapterFor("greenhouse")?.ats).toBe("greenhouse");
    expect(adapterFor("lever")?.ats).toBe("lever");
    expect(adapterFor("ashby")?.ats).toBe("ashby");
  });
});
