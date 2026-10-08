import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readEnv } from "@/lib/env";

// AES-256-GCM. كل صف فيه key_version عشان نقدر ندوّر المفتاح الرئيسي:
// أضف BYOK_MASTER_KEY_V2، ارفع CURRENT_KEY_VERSION، وأعد تشفير الصفوف القديمة.
export const CURRENT_KEY_VERSION = 1;

export type Keyring = (version: number) => Buffer;

const envKeyring: Keyring = (version) => {
  if (version !== 1) throw new Error(`ما فيه مفتاح تشفير للإصدار ${version}`);
  return Buffer.from(readEnv("BYOK_MASTER_KEY"), "base64");
};

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  auth_tag: string;
  key_version: number;
}

export interface SecretContext {
  userId: string;
  provider: string;
}

// يربط النص المشفّر بصاحبه ومزوده: لو أحد نقل الصف لمستخدم ثاني، فك التشفير يفشل.
function additionalData({ userId, provider }: SecretContext): Buffer {
  return Buffer.from(`byok:${userId}:${provider}`, "utf8");
}

export function encryptSecret(
  plaintext: string,
  context: SecretContext,
  keyring: Keyring = envKeyring,
): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyring(CURRENT_KEY_VERSION), iv);
  cipher.setAAD(additionalData(context));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    auth_tag: cipher.getAuthTag().toString("base64"),
    key_version: CURRENT_KEY_VERSION,
  };
}

export function decryptSecret(
  secret: EncryptedSecret,
  context: SecretContext,
  keyring: Keyring = envKeyring,
): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyring(secret.key_version),
    Buffer.from(secret.iv, "base64"),
  );
  decipher.setAAD(additionalData(context));
  decipher.setAuthTag(Buffer.from(secret.auth_tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** آخر 4 أحرف بس للعرض. */
export function lastFour(secret: string): string {
  return secret.trim().slice(-4);
}
