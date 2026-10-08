import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyProviderKey } from "./verify";

const KEY = "secret-key-123456";

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => handler(String(url), init ?? {}));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("verifyProviderKey", () => {
  it("returns valid with the model list", async () => {
    mockFetch(() => Response.json({ data: [{ id: "b-model" }, { id: "a-model" }] }));
    await expect(verifyProviderKey("groq", KEY)).resolves.toEqual({
      status: "valid",
      models: ["a-model", "b-model"],
    });
  });

  it("returns invalid on 401", async () => {
    mockFetch(() => new Response("nope", { status: 401 }));
    await expect(verifyProviderKey("openai", KEY)).resolves.toEqual({ status: "invalid" });
  });

  it("returns unknown on network errors and 5xx (the key is kept as unverified)", async () => {
    mockFetch(() => {
      throw new TypeError("fetch failed");
    });
    await expect(verifyProviderKey("tavily", KEY)).resolves.toEqual({ status: "unknown" });
    mockFetch(() => new Response("down", { status: 503 }));
    await expect(verifyProviderKey("steel", KEY)).resolves.toEqual({ status: "unknown" });
  });

  it("never puts the key in the URL", async () => {
    const fn = mockFetch(() => Response.json({ data: [], models: [] }));
    for (const provider of ["groq", "openai", "anthropic", "google", "openrouter", "tavily", "exa", "steel"] as const) {
      await verifyProviderKey(provider, KEY);
    }
    for (const [url, init] of fn.mock.calls) {
      expect(String(url)).not.toContain(KEY);
      if (String(url).includes("openrouter.ai/api/v1/models")) continue; // public list, no key
      expect(JSON.stringify(init?.headers)).toContain(KEY);
    }
  });

  it("keeps only Gemini models that generate content", async () => {
    mockFetch(() =>
      Response.json({
        models: [
          { name: "models/gemini-x", supportedGenerationMethods: ["generateContent"] },
          { name: "models/embed-y", supportedGenerationMethods: ["embedContent"] },
        ],
      }),
    );
    await expect(verifyProviderKey("google", KEY)).resolves.toEqual({ status: "valid", models: ["gemini-x"] });
  });
});
