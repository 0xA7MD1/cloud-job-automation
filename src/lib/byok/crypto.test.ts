import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, lastFour, type Keyring } from "./crypto";

const key = randomBytes(32);
const keyring: Keyring = () => key;
const ctx = { userId: "user-a", provider: "groq" };

describe("BYOK crypto", () => {
  it("round-trips a secret", () => {
    const secret = encryptSecret("gsk_live_example_1234", ctx, keyring);
    expect(secret.ciphertext).not.toContain("gsk_live");
    expect(decryptSecret(secret, ctx, keyring)).toBe("gsk_live_example_1234");
  });

  it("uses a fresh IV every time", () => {
    const a = encryptSecret("same", ctx, keyring);
    const b = encryptSecret("same", ctx, keyring);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("fails when the row is moved to another user or provider", () => {
    const secret = encryptSecret("k", ctx, keyring);
    expect(() => decryptSecret(secret, { ...ctx, userId: "user-b" }, keyring)).toThrow();
    expect(() => decryptSecret(secret, { ...ctx, provider: "openai" }, keyring)).toThrow();
  });

  it("fails on tampering or a wrong master key", () => {
    const secret = encryptSecret("k", ctx, keyring);
    const tampered = { ...secret, ciphertext: Buffer.from("x").toString("base64") };
    expect(() => decryptSecret(tampered, ctx, keyring)).toThrow();
    expect(() => decryptSecret(secret, ctx, () => randomBytes(32))).toThrow();
  });

  it("shows only the last four characters", () => {
    expect(lastFour("  sk-abcdef1234 ")).toBe("1234");
  });
});
