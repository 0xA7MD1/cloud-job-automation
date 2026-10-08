import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { AI_PROVIDERS, PROVIDER_INFO } from "@/lib/byok/providers";
import { getFirstProviderSecret } from "@/lib/byok/store";
import type { Provider } from "@/lib/db/types";

export interface UserModel {
  model: LanguageModel;
  provider: Provider;
  modelId: string;
}

function build(provider: Provider, apiKey: string, modelId: string): LanguageModel {
  switch (provider) {
    case "groq":
      return createGroq({ apiKey })(modelId);
    case "openai":
      return createOpenAI({ apiKey })(modelId);
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(modelId);
    case "openrouter":
      return createOpenRouter({ apiKey })(modelId);
    default:
      throw new Error(`${provider} مو مزود ذكاء`);
  }
}

/** نموذج المستخدم من مفتاحه: الافتراضي أول، وإلا أول مزود ذكاء متاح. */
export async function getUserModel(userId: string): Promise<UserModel | null> {
  const secret = await getFirstProviderSecret(userId, AI_PROVIDERS);
  if (!secret) return null;
  const modelId = secret.settings.model ?? PROVIDER_INFO[secret.provider].suggestedModel;
  if (!modelId) return null;
  return { model: build(secret.provider, secret.apiKey, modelId), provider: secret.provider, modelId };
}
