import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { PROVIDER_INFO, type ProviderKind } from "@/lib/byok/providers";
import { PROVIDER_KEY_PUBLIC_COLUMNS, PROVIDERS, type ProviderKeyPublic } from "@/lib/db/types";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { ProviderCard } from "./provider-card";

export const metadata: Metadata = { title: "المفاتيح" };

const SECTIONS: { kind: ProviderKind; title: string; description: string }[] = [
  { kind: "ai", title: "الذكاء الاصطناعي", description: "يكفي مزود واحد. الشات يستخدم الافتراضي." },
  { kind: "search", title: "البحث عن الشركات", description: "Tavily أو Exa. Tavily فيه حصة مجانية شهرية." },
  { kind: "browser", title: "المتصفح", description: "للتقديم الفعلي على النماذج." },
];

export default function KeysPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="المفاتيح"
        description="مفاتيحك تنحفظ مشفّرة، وما نعرض منها إلا آخر 4 أحرف. الاستهلاك على حسابك عند كل مزود."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <KeySections />
      </Suspense>
    </div>
  );
}

async function KeySections() {
  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database
    .from("provider_keys")
    .select(PROVIDER_KEY_PUBLIC_COLUMNS)
    .eq("user_id", user.id);
  const rows = new Map(((data ?? []) as ProviderKeyPublic[]).map((row) => [row.provider, row]));

  return SECTIONS.map((section) => (
    <section key={section.kind} className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{section.title}</h2>
        <p className="text-sm text-muted-foreground">{section.description}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {PROVIDERS.filter((p) => PROVIDER_INFO[p].kind === section.kind).map((provider) => (
          <ProviderCard key={provider} provider={provider} row={rows.get(provider) ?? null} />
        ))}
      </div>
    </section>
  ));
}
