import { describe, expect, it } from "vitest";
import { authErrorMessage, needsEmailVerification } from "./auth-errors";

describe("authErrorMessage", () => {
  it("maps common InsForge errors to Arabic without leaking details", () => {
    expect(authErrorMessage({ statusCode: 401, message: "Invalid credentials" })).toBe("البريد أو كلمة المرور غلط.");
    expect(authErrorMessage({ statusCode: 409, message: "User already exists" })).toContain("فيه حساب");
    expect(authErrorMessage({ statusCode: 429 })).toContain("محاولات كثيرة");
    expect(authErrorMessage({ statusCode: 500, message: "db exploded at line 7" })).not.toContain("db");
  });
});

describe("needsEmailVerification", () => {
  it("detects unverified email responses only", () => {
    expect(needsEmailVerification({ statusCode: 403, message: "Email verification required" })).toBe(true);
    expect(needsEmailVerification({ statusCode: 403, message: "Forbidden" })).toBe(false);
    expect(needsEmailVerification(null)).toBe(false);
  });
});
