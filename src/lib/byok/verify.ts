import type { Provider } from "@/lib/db/types";

export type VerifyResult =
  | { status: "valid"; models?: string[] }
  | { status: "invalid" }
  /** ما قدرنا نتأكد (شبكة، حد طلبات، عطل عند المزود): المفتاح ينحفظ كـunverified */
  | { status: "unknown" };

const TIMEOUT_MS = 10_000;
const MAX_MODELS = 150;

async function call(url: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch {
    return null;
  }
}

function classify(response: Response | null): "ok" | "invalid" | "unknown" {
  if (!response) return "unknown";
  if (response.ok) return "ok";
  if (response.status === 401 || response.status === 403) return "invalid";
  // Google يرجّع 400 لمفتاح غلط
  if (response.status === 400) return "invalid";
  return "unknown";
}

async function modelIds(response: Response, pick: (body: unknown) => string[]): Promise<string[] | undefined> {
  try {
    return pick(await response.json()).slice(0, MAX_MODELS);
  } catch {
    return undefined;
  }
}

const idsFromData = (body: unknown) =>
  ((body as { data?: { id?: unknown }[] }).data ?? [])
    .map((m) => m.id)
    .filter((id): id is string => typeof id === "string")
    .sort();

/**
 * يتحقق من المفتاح بطلب خفيف عند المزود (قائمة النماذج أو معلومات المفتاح).
 * المفتاح دائمًا في هيدر، أبد ما يروح في الرابط.
 */
export async function verifyProviderKey(provider: Provider, apiKey: string): Promise<VerifyResult> {
  const bearer = { Authorization: `Bearer ${apiKey}` };

  switch (provider) {
    case "groq":
    case "openai": {
      const base = provider === "groq" ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1";
      const res = await call(`${base}/models`, { headers: bearer });
      const state = classify(res);
      if (state !== "ok" || !res) return { status: state === "invalid" ? "invalid" : "unknown" };
      return { status: "valid", models: await modelIds(res, idsFromData) };
    }

    case "anthropic": {
      const res = await call("https://api.anthropic.com/v1/models?limit=100", {
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      });
      const state = classify(res);
      if (state !== "ok" || !res) return { status: state === "invalid" ? "invalid" : "unknown" };
      return { status: "valid", models: await modelIds(res, idsFromData) };
    }

    case "google": {
      const res = await call("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
        headers: { "x-goog-api-key": apiKey },
      });
      const state = classify(res);
      if (state !== "ok" || !res) return { status: state === "invalid" ? "invalid" : "unknown" };
      return {
        status: "valid",
        models: await modelIds(res, (body) =>
          ((body as { models?: { name?: unknown; supportedGenerationMethods?: unknown }[] }).models ?? [])
            .filter(
              (m) =>
                Array.isArray(m.supportedGenerationMethods) &&
                m.supportedGenerationMethods.includes("generateContent"),
            )
            .map((m) => (typeof m.name === "string" ? m.name.replace(/^models\//, "") : ""))
            .filter(Boolean)
            .sort(),
        ),
      };
    }

    case "openrouter": {
      const res = await call("https://openrouter.ai/api/v1/key", { headers: bearer });
      const state = classify(res);
      if (state !== "ok") return { status: state === "invalid" ? "invalid" : "unknown" };
      // قائمة النماذج عامة: نختار الي تدعم الأدوات، والمجانية أول
      const list = await call("https://openrouter.ai/api/v1/models", {});
      const models =
        list?.ok
          ? await modelIds(list, (body) =>
              ((body as { data?: { id?: unknown; supported_parameters?: unknown }[] }).data ?? [])
                .filter((m) => Array.isArray(m.supported_parameters) && m.supported_parameters.includes("tools"))
                .map((m) => (typeof m.id === "string" ? m.id : ""))
                .filter(Boolean)
                .sort((a, b) => Number(b.endsWith(":free")) - Number(a.endsWith(":free")) || a.localeCompare(b)),
            )
          : undefined;
      return { status: "valid", models };
    }

    case "tavily": {
      const res = await call("https://api.tavily.com/usage", { headers: bearer });
      const state = classify(res);
      return { status: state === "ok" ? "valid" : state };
    }

    case "exa": {
      // ما فيه طريقة مجانية: بحث واحد بنتيجة وحدة.
      const res = await call("https://api.exa.ai/search", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ query: "company careers page", numResults: 1, type: "fast" }),
      });
      const state = classify(res);
      return { status: state === "ok" ? "valid" : state };
    }

    case "steel": {
      const res = await call("https://api.steel.dev/v1/sessions?limit=1", {
        headers: { "steel-api-key": apiKey },
      });
      const state = classify(res);
      return { status: state === "ok" ? "valid" : state };
    }
  }
}
