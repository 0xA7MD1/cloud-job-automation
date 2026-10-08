import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps internal paths with query and hash", () => {
    expect(safeRedirectPath("/files?kind=cv#top")).toBe("/files?kind=cv#top");
  });

  it.each([
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "javascript:alert(1)",
    "files",
    "",
    undefined,
    42,
  ])("rejects %s", (value) => {
    expect(safeRedirectPath(value)).toBe("/dashboard");
  });
});
