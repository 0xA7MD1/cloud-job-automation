import type { Provider } from "@/lib/db/types";
import { getInsForgeAdminClient } from "@/lib/insforge/admin";
import { decryptSecret } from "./crypto";
import { readSettings, type ProviderSettings } from "./providers";

export interface ProviderSecret {
  apiKey: string;
  settings: ProviderSettings;
}

/**
 * يفك مفتاح المستخدم عند الخادم. الأعمدة السرية ما يقدر يقرأها المستخدم
 * (صلاحيات الأعمدة)، فنقرأها بعميل الأدمن وبفلتر user_id صريح.
 *
 * النتيجة تبقى في الذاكرة: لا ترجعها للواجهة، ولا تمرّرها لـTrigger.dev، ولا تسجّلها.
 */
export async function getProviderSecret(
  userId: string,
  provider: Provider,
  { includeInvalid = false }: { includeInvalid?: boolean } = {},
): Promise<ProviderSecret | null> {
  if (typeof window !== "undefined") throw new Error("فك المفاتيح ممنوع في المتصفح");

  const { data, error } = await getInsForgeAdminClient()
    .database.from("provider_keys")
    .select("ciphertext, iv, auth_tag, key_version, settings, status")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (error || !data) return null;
  if (data.status === "invalid" && !includeInvalid) return null;

  return {
    apiKey: decryptSecret(data, { userId, provider }),
    settings: readSettings(data.settings),
  };
}

/** أول مزود متاح من القائمة، والافتراضي أول. */
export async function getFirstProviderSecret(
  userId: string,
  providers: readonly Provider[],
): Promise<(ProviderSecret & { provider: Provider }) | null> {
  const { data } = await getInsForgeAdminClient()
    .database.from("provider_keys")
    .select("provider, settings")
    .eq("user_id", userId)
    .in("provider", [...providers])
    .neq("status", "invalid");

  const rows = (data ?? []) as { provider: Provider; settings: unknown }[];
  const ordered = [...rows].sort((a, b) => {
    const aDefault = readSettings(a.settings).default ? 0 : 1;
    const bDefault = readSettings(b.settings).default ? 0 : 1;
    return aDefault - bDefault || providers.indexOf(a.provider) - providers.indexOf(b.provider);
  });

  for (const row of ordered) {
    const secret = await getProviderSecret(userId, row.provider);
    if (secret) return { ...secret, provider: row.provider };
  }
  return null;
}
