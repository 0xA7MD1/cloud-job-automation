import { tool } from "ai";
import { z } from "zod";
import { SEARCH_PROVIDERS } from "@/lib/byok/providers";
import { getFirstProviderSecret } from "@/lib/byok/store";
import type { Company } from "@/lib/db/types";
import { getInsForgeAdminClient } from "@/lib/insforge/admin";
import { searchCompanies, searchErrorMessage, type CompanySearchProvider } from "@/lib/search/companies";
import { createJobTools } from "./job-tools";

// أدوات الشات. ما فيه أداة إرسال طلب (قاعدة 8): الإرسال يبدأ من الواجهة بتأكيد المستخدم.

/** عميل InsForge بجلسة المستخدم (RLS) */
export type SessionClient = Awaited<ReturnType<typeof import("@/lib/insforge/server").createInsForgeServerClient>>;

export interface ChatToolContext {
  userId: string;
  chatId: string;
  insforge: SessionClient;
}

export interface CompanyResult {
  companyId: string;
  name: string;
  domain: string;
  url: string;
  snippet: string;
  ats: Company["ats"];
}

export type ToolFailure = { ok: false; error: string };

export function createChatTools(ctx: ChatToolContext) {
  return {
    searchCompanies: tool({
      description:
        "Find companies (their official websites) matching what the user wants, e.g. 'fintech startups' in 'Riyadh'. " +
        "Results are saved and get a searchId. Never invent companies: only present what this tool returns.",
      inputSchema: z.object({
        query: z.string().min(2).max(200).describe("Industry / kind of company, in English works best"),
        location: z.string().max(100).optional().describe("City or country"),
        limit: z.number().int().min(1).max(10).optional().default(8),
      }),
      execute: async ({ query, location, limit }): Promise<
        { ok: true; searchId: string; provider: CompanySearchProvider; companies: CompanyResult[] } | ToolFailure
      > => {
        const secret = await getFirstProviderSecret(ctx.userId, SEARCH_PROVIDERS);
        if (!secret) return { ok: false, error: "ما فيه مفتاح بحث. أضف Tavily أو Exa من صفحة المفاتيح." };
        const provider = secret.provider as CompanySearchProvider;

        let candidates;
        try {
          candidates = await searchCompanies(provider, secret.apiKey, { query, location, limit });
        } catch (error) {
          return { ok: false, error: searchErrorMessage(error) };
        }

        // الشركات مشتركة بين المستخدمين: نضيف الجديد بس ونترك الموجود (بعميل الأدمن)
        const admin = getInsForgeAdminClient();
        if (candidates.length > 0) {
          await admin.database.from("companies").upsert(
            candidates.map((c) => ({ name: c.name, domain: c.domain, website_url: `https://${c.domain}`, source: provider })),
            { onConflict: "domain", ignoreDuplicates: true },
          );
        }
        const { data: rows } = await admin.database
          .from("companies")
          .select("id, domain, ats")
          .in("domain", candidates.map((c) => c.domain));
        const byDomain = new Map(((rows ?? []) as Pick<Company, "id" | "domain" | "ats">[]).map((r) => [r.domain, r]));

        const companies: CompanyResult[] = candidates.flatMap((c) => {
          const row = byDomain.get(c.domain);
          return row ? [{ companyId: row.id, name: c.name, domain: c.domain, url: c.url, snippet: c.snippet, ats: row.ats }] : [];
        });

        const { data: saved, error } = await ctx.insforge.database
          .from("searches")
          .insert({
            user_id: ctx.userId,
            chat_id: ctx.chatId,
            kind: "companies",
            provider,
            query,
            params: { location: location ?? null, limit },
            results: companies,
            result_count: companies.length,
          })
          .select("id")
          .single();
        if (error || !saved) return { ok: false, error: "انحفظ البحث بشكل ناقص. جرّب مرة ثانية." };

        return { ok: true, searchId: (saved as { id: string }).id, provider, companies };
      },
    }),

    listRecentSearches: tool({
      description: "List the user's recent saved searches (companies and jobs) so you can refer back to them instead of searching again.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(20).optional().default(10) }),
      execute: async ({ limit }) => {
        const { data } = await ctx.insforge.database
          .from("searches")
          .select("id, kind, provider, query, result_count, created_at")
          .eq("user_id", ctx.userId)
          .order("created_at", { ascending: false })
          .limit(limit);
        return { searches: data ?? [] };
      },
    }),

    getSearchResults: tool({
      description: "Load the saved results of a previous search by its searchId.",
      inputSchema: z.object({ searchId: z.uuid() }),
      execute: async ({ searchId }) => {
        const { data } = await ctx.insforge.database
          .from("searches")
          .select("id, kind, provider, query, params, results, created_at")
          .eq("id", searchId)
          .eq("user_id", ctx.userId)
          .maybeSingle();
        return data ? { ok: true as const, search: data } : { ok: false as const, error: "البحث مو موجود." };
      },
    }),

    ...createJobTools(ctx),
  };
}

export type ChatTools = ReturnType<typeof createChatTools>;
