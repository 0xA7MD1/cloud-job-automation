import { describe, expect, it } from "vitest";
import { readEnv } from "./env";

describe("readEnv", () => {
  it("returns a valid value", () => {
    expect(
      readEnv("NEXT_PUBLIC_APP_URL", { NEXT_PUBLIC_APP_URL: "http://localhost:3000" }),
    ).toBe("http://localhost:3000");
  });

  it("throws on a missing value without leaking anything", () => {
    expect(() => readEnv("INSFORGE_API_KEY", {})).toThrow(/INSFORGE_API_KEY/);
  });

  it("accepts only a 32-byte base64 master key", () => {
    const good = Buffer.alloc(32, 7).toString("base64");
    const short = Buffer.alloc(16, 7).toString("base64");

    expect(readEnv("BYOK_MASTER_KEY", { BYOK_MASTER_KEY: good })).toBe(good);
    expect(() => readEnv("BYOK_MASTER_KEY", { BYOK_MASTER_KEY: short })).toThrow(
      /BYOK_MASTER_KEY/,
    );
  });

  it("never includes the secret value in the error", () => {
    const secret = "not-base64-secret-value";
    try {
      readEnv("BYOK_MASTER_KEY", { BYOK_MASTER_KEY: secret });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
