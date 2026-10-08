"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { encryptSecret, lastFour } from "@/lib/byok/crypto";
import { AI_PROVIDERS, PROVIDER_INFO, readSettings, type ProviderSettings } from "@/lib/byok/providers";
import { getProviderSecret } from "@/lib/byok/store";
import { verifyProviderKey, type VerifyResult } from "@/lib/byok/verify";
import { PROVIDERS, type Provider } from "@/lib/db/types";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export interface KeyFormState {
  ok?: boolean;
  error?: string;
  message?: string;
}

const providerSchema = z.enum(PROVIDERS);

function pickModel(provider: Provider, models: string[] | undefined, current?: string): string | undefined {
  if (current && (!models || models.includes(current))) return current;
  const suggested = PROVIDER_INFO[provider].suggestedModel;
  if (!models || models.length === 0) return suggested;
  if (suggested && models.includes(suggested)) return suggested;
  return models[0];
}

async function readRow(provider: Provider) {
  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database
    .from("provider_keys")
    .select("id, settings")
    .eq("user_id", user.id)
    .eq("provider", provider)
    .maybeSingle();
  return { user, insforge, row: data as { id: string; settings: unknown } | null };
}

function statusFields(result: VerifyResult) {
  return {
    status: result.status === "valid" ? "valid" : result.status === "invalid" ? "invalid" : "unverified",
    verified_at: result.status === "valid" ? new Date().toISOString() : null,
  } as const;
}

/** يحفظ مفتاح جديد أو يستبدل القديم. نتحقق منه أول، ولا نحفظ مفتاح مرفوض. */
export async function saveProviderKeyAction(_prev: KeyFormState, formData: FormData): Promise<KeyFormState> {
  const provider = providerSchema.safeParse(formData.get("provider"));
  const apiKey = z
    .string()
    .trim()
    .min(8, { error: "المفتاح قصير. انسخه كامل." })
    .max(500)
    .regex(/^\S+$/, { error: "المفتاح فيه مسافات. انسخه بدونها." })
    .safeParse(formData.get("apiKey"));
  if (!provider.success) return { error: "مزود غير معروف." };
  if (!apiKey.success) return { error: apiKey.error.issues[0]?.message ?? "المفتاح غير صالح." };

  const { user, insforge, row } = await readRow(provider.data);
  const label = PROVIDER_INFO[provider.data].label;

  const verification = await verifyProviderKey(provider.data, apiKey.data);
  if (verification.status === "invalid") return { error: `${label} رفض المفتاح. تأكد إنك نسخته صح.` };

  const previous = readSettings(row?.settings);
  const models = verification.status === "valid" ? verification.models : previous.models;
  const settings: ProviderSettings = { ...previous, models };
  if (PROVIDER_INFO[provider.data].kind === "ai") {
    settings.model = pickModel(provider.data, models, previous.model);
    if (!row) {
      const { count } = await insforge.database
        .from("provider_keys")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("provider", AI_PROVIDERS);
      // أول مزود ذكاء يضيفه المستخدم يصير الافتراضي
      if (!count) settings.default = true;
    }
  }

  const encrypted = encryptSecret(apiKey.data, { userId: user.id, provider: provider.data });
  const secretColumns = { ...encrypted, last4: lastFour(apiKey.data), settings };

  if (row) {
    const { error } = await insforge.database
      .from("provider_keys")
      .update({ ...secretColumns, ...statusFields(verification) })
      .eq("id", row.id);
    if (error) return { error: "ما قدرنا نحفظ المفتاح." };
  } else {
    const { error } = await insforge.database
      .from("provider_keys")
      .insert({ user_id: user.id, provider: provider.data, ...secretColumns });
    if (error) return { error: "ما قدرنا نحفظ المفتاح." };
    // الحالة ما تنكتب مع الإدخال (صلاحيات الأعمدة)، فنحدّثها بعده
    await insforge.database
      .from("provider_keys")
      .update(statusFields(verification))
      .eq("user_id", user.id)
      .eq("provider", provider.data);
  }

  return {
    ok: true,
    message:
      verification.status === "valid"
        ? `انحفظ مفتاح ${label} واشتغل.`
        : `انحفظ مفتاح ${label}، لكن ما قدرنا نتأكد منه الحين. جرّب «تحقق» بعد شوي.`,
  };
}

export async function reverifyProviderKeyAction(provider: Provider): Promise<KeyFormState> {
  const parsed = providerSchema.safeParse(provider);
  if (!parsed.success) return { error: "مزود غير معروف." };

  const { user, insforge, row } = await readRow(parsed.data);
  if (!row) return { error: "ما فيه مفتاح محفوظ." };

  // نعيد التحقق حتى من المفاتيح المعلّمة مرفوضة (يمكن انحلّت المشكلة عند المزود)
  const secret = await getProviderSecret(user.id, parsed.data, { includeInvalid: true });
  if (!secret) return { error: "ما قدرنا نقرأ المفتاح. أضفه من جديد." };

  const verification = await verifyProviderKey(parsed.data, secret.apiKey);
  const previous = readSettings(row.settings);
  const settings: ProviderSettings =
    verification.status === "valid" && verification.models
      ? { ...previous, models: verification.models, model: pickModel(parsed.data, verification.models, previous.model) }
      : previous;

  await insforge.database
    .from("provider_keys")
    .update({ ...statusFields(verification), settings })
    .eq("id", row.id);

  if (verification.status === "valid") return { ok: true, message: "المفتاح يشتغل." };
  if (verification.status === "invalid") return { error: "المزود رفض المفتاح. أضف مفتاح جديد." };
  return { error: "ما قدرنا نوصل للمزود. جرّب بعد شوي." };
}

export async function deleteProviderKeyAction(provider: Provider): Promise<KeyFormState> {
  const parsed = providerSchema.safeParse(provider);
  if (!parsed.success) return { error: "مزود غير معروف." };

  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database
    .from("provider_keys")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", parsed.data);
  if (error) return { error: "ما قدرنا نحذف المفتاح." };
  return { ok: true, message: "انحذف المفتاح." };
}

const settingsPatch = z.object({
  model: z.string().trim().min(1).max(200).optional(),
  captchaEnabled: z.boolean().optional(),
});

export async function updateProviderSettingsAction(
  provider: Provider,
  patch: z.input<typeof settingsPatch>,
): Promise<KeyFormState> {
  const parsedProvider = providerSchema.safeParse(provider);
  const parsedPatch = settingsPatch.safeParse(patch);
  if (!parsedProvider.success || !parsedPatch.success) return { error: "بيانات غير صالحة." };
  if (parsedPatch.data.captchaEnabled !== undefined && parsedProvider.data !== "steel") {
    return { error: "حل الكابتشا خاص بـSteel." };
  }

  const { insforge, row } = await readRow(parsedProvider.data);
  if (!row) return { error: "أضف المفتاح أول." };

  const { error } = await insforge.database
    .from("provider_keys")
    .update({ settings: { ...readSettings(row.settings), ...parsedPatch.data } })
    .eq("id", row.id);
  if (error) return { error: "ما قدرنا نحفظ الإعداد." };
  return { ok: true, message: "انحفظ." };
}

/** يخلي مزود الذكاء هذا هو الافتراضي للشات، ويشيلها عن الباقين. */
export async function setDefaultAiProviderAction(provider: Provider): Promise<KeyFormState> {
  const parsed = providerSchema.safeParse(provider);
  if (!parsed.success || !AI_PROVIDERS.includes(parsed.data)) return { error: "مزود غير صالح." };

  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database
    .from("provider_keys")
    .select("id, provider, settings")
    .eq("user_id", user.id)
    .in("provider", AI_PROVIDERS);

  const rows = (data ?? []) as { id: string; provider: Provider; settings: unknown }[];
  if (!rows.some((r) => r.provider === parsed.data)) return { error: "أضف المفتاح أول." };

  for (const row of rows) {
    const isDefault = row.provider === parsed.data;
    const settings = readSettings(row.settings);
    if (settings.default === isDefault) continue;
    await insforge.database
      .from("provider_keys")
      .update({ settings: { ...settings, default: isDefault } })
      .eq("id", row.id);
  }
  return { ok: true, message: `${PROVIDER_INFO[parsed.data].label} صار الافتراضي للشات.` };
}
