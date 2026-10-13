import type { Provider } from "@/lib/db/types";

// كتالوج المزودين. آمن للمتصفح: ما فيه أي سر.

export type ProviderKind = "ai" | "search" | "browser" | "places";

export interface ProviderInfo {
  label: string;
  kind: ProviderKind;
  /** وين يطلع المستخدم مفتاحه */
  keyUrl: string;
  /** نموذج مقترح لو المستخدم ما اختار (ينتقى من قائمة المزود بعد التحقق) */
  suggestedModel?: string;
  note?: string;
}

export const PROVIDER_INFO: Record<Provider, ProviderInfo> = {
  groq: {
    label: "Groq",
    kind: "ai",
    keyUrl: "https://console.groq.com/keys",
    suggestedModel: "openai/gpt-oss-120b",
    note: "فيه حصة مجانية تتجدد يوميًا.",
  },
  openrouter: {
    label: "OpenRouter",
    kind: "ai",
    keyUrl: "https://openrouter.ai/settings/keys",
    suggestedModel: "openai/gpt-oss-120b",
    note: "نماذج كثيرة، بعضها مجاني (تنتهي بـ:free).",
  },
  openai: {
    label: "OpenAI",
    kind: "ai",
    keyUrl: "https://platform.openai.com/api-keys",
    suggestedModel: "gpt-5-mini",
  },
  anthropic: {
    label: "Anthropic",
    kind: "ai",
    keyUrl: "https://console.anthropic.com/settings/keys",
    suggestedModel: "claude-haiku-5-5",
  },
  google: {
    label: "Google Gemini",
    kind: "ai",
    keyUrl: "https://aistudio.google.com/apikey",
    suggestedModel: "gemini-2.5-flash",
    note: "الخطة المجانية تستخدم بياناتك لتحسين منتجات Google. لا تستخدمها لبيانات سيرتك لو هذا يضايقك.",
  },
  tavily: {
    label: "Tavily",
    kind: "search",
    keyUrl: "https://app.tavily.com/home",
    note: "1000 بحث مجاني شهريًا يتجدد.",
  },
  exa: {
    label: "Exa",
    kind: "search",
    keyUrl: "https://dashboard.exa.ai/api-keys",
    note: "التحقق من المفتاح يستهلك بحث واحد.",
  },
  steel: {
    label: "Steel",
    kind: "browser",
    keyUrl: "https://app.steel.dev/settings/api-keys",
    note: "للتقديم الفعلي. حل الكابتشا يحتاج إيداع $10 مرة وحدة في حسابك عند Steel.",
  },
  google_places: {
    label: "Google Places",
    kind: "places",
    keyUrl: "https://console.cloud.google.com/google/maps-apis/credentials",
    note: "فعّل «Places API (New)» في مشروعك عند Google. 1000 بحث مجاني شهريًا، وكل بحث يرجّع حتى 20 شركة.",
  },
};

export const AI_PROVIDERS = (Object.keys(PROVIDER_INFO) as Provider[]).filter(
  (p) => PROVIDER_INFO[p].kind === "ai",
);
export const SEARCH_PROVIDERS = (Object.keys(PROVIDER_INFO) as Provider[]).filter(
  (p) => PROVIDER_INFO[p].kind === "search",
);

/** إعدادات غير سرية تنحفظ في provider_keys.settings */
export interface ProviderSettings {
  /** النموذج المختار (مزودي الذكاء) */
  model?: string;
  /** النماذج المتاحة لهذا المفتاح، من آخر تحقق */
  models?: string[];
  /** مزود الشات الافتراضي */
  default?: boolean;
  /** Steel: المستخدم فعّل حل الكابتشا في حسابه (إيداع $10) */
  captchaEnabled?: boolean;
}

export function readSettings(value: unknown): ProviderSettings {
  if (!value || typeof value !== "object") return {};
  const v = value as Record<string, unknown>;
  return {
    model: typeof v.model === "string" ? v.model : undefined,
    models: Array.isArray(v.models) ? v.models.filter((m): m is string => typeof m === "string") : undefined,
    default: v.default === true,
    captchaEnabled: v.captchaEnabled === true,
  };
}
