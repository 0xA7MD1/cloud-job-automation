import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button, CtaIcon } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { AI_PROVIDERS, SEARCH_PROVIDERS } from "@/lib/byok/providers";
import type { MonthlyApplyUsage } from "@/lib/db/types";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export const metadata: Metadata = { title: "الرئيسية" };

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <Suspense fallback={<Skeleton className="h-16 w-72" />}>
        <Greeting />
      </Suspense>
      <div className="grid gap-4 md:grid-cols-2">
        <Suspense fallback={<Skeleton className="h-64" />}>
          <SetupCard />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-40" />}>
          <QuotaCard />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-40" />}>
          <ApplicationsCard />
        </Suspense>
      </div>
    </div>
  );
}

async function Greeting() {
  const user = await requireUser();
  return (
    <PageHeader title={`أهلًا${user.name ? ` ${user.name}` : ""}`} description="كمّل التجهيز تحت، وبعدها قل للشات وش تدوّر.">
      <Button asChild variant="cta">
        <Link href="/chat">
          افتح الشات
          <CtaIcon />
        </Link>
      </Button>
    </PageHeader>
  );
}

async function SetupCard() {
  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const [cv, keys, profile] = await Promise.all([
    insforge.database
      .from("files")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("kind", "cv"),
    insforge.database.from("provider_keys").select("provider, status").eq("user_id", user.id),
    insforge.database.from("profiles").select("full_name, phone, preferences").eq("user_id", user.id).maybeSingle(),
  ]);

  const usable = ((keys.data ?? []) as { provider: string; status: string }[]).filter((k) => k.status !== "invalid");
  const has = (list: readonly string[]) => usable.some((k) => list.includes(k.provider));
  const prefs = (profile.data?.preferences ?? {}) as { target_roles?: unknown[] };

  const steps = [
    { done: (cv.count ?? 0) > 0, label: "ارفع سيرتك الذاتية", href: "/files" },
    { done: has(AI_PROVIDERS), label: "أضف مفتاح ذكاء اصطناعي (Groq مجاني)", href: "/settings/keys" },
    { done: has(SEARCH_PROVIDERS), label: "أضف مفتاح بحث (Tavily مجاني)", href: "/settings/keys" },
    {
      done: !!profile.data?.full_name && !!profile.data?.phone && (prefs.target_roles?.length ?? 0) > 0,
      label: "عبّ ملفك والوظائف الي تدوّرها",
      href: "/profile",
    },
  ];
  const remaining = steps.filter((s) => !s.done).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>التجهيز</CardTitle>
        <CardDescription>{remaining === 0 ? "كل شي جاهز." : `باقي ${remaining} من ${steps.length}.`}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {steps.map((step) => (
            <li key={step.label} className="flex items-center gap-3">
              {step.done ? (
                <CheckCircle2Icon className="size-5 text-primary" aria-label="تم" />
              ) : (
                <CircleIcon className="size-5 text-muted-foreground" aria-label="باقي" />
              )}
              {step.done ? (
                <span className="text-muted-foreground line-through">{step.label}</span>
              ) : (
                <Button asChild variant="link" className="h-auto p-0">
                  <Link href={step.href}>{step.label}</Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

async function QuotaCard() {
  await requireUser();
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database.rpc("monthly_apply_usage");
  const usage = (Array.isArray(data) ? data[0] : data) as MonthlyApplyUsage | undefined;
  const used = usage?.used ?? 0;
  const limit = usage?.apply_limit ?? 500;
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>تقديمات هذا الشهر</CardTitle>
        <CardDescription>تتجدد أول كل شهر.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-3xl font-bold tabular-nums">
          {used}
          <span className="text-base font-normal text-muted-foreground"> / {limit}</span>
        </p>
        <Progress value={percent} aria-label={`استخدمت ${percent}% من الحصة`} />
      </CardContent>
    </Card>
  );
}

async function ApplicationsCard() {
  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database.from("applications").select("status").eq("user_id", user.id);
  const count = (statuses: string[]) => ((data ?? []) as { status: string }[]).filter((r) => statuses.includes(r.status)).length;
  const rows = [
    { label: "ينتظرك", value: count(["needs_user"]), href: "/applications?tab=active" },
    { label: "جاهزة للمراجعة", value: count(["ready", "failed"]), href: "/applications?tab=review" },
    { label: "شغّالة الحين", value: count(["preparing", "queued", "running"]), href: "/applications?tab=active" },
    { label: "انرسلت", value: count(["submitted"]), href: "/applications?tab=submitted" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>الطلبات</CardTitle>
        <CardDescription>جهّز من الوظائف أو الشات، وقدّم من صفحة الطلب.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-2 gap-3">
          {rows.map((row) => (
            <li key={row.label}>
              <Link
                href={row.href}
                className="flex flex-col rounded-xl border border-hairline bg-background/40 p-3 outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-foreground/55"
              >
                <span className="text-2xl font-bold tabular-nums">{row.value}</span>
                <span className="text-sm text-muted-foreground">{row.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
