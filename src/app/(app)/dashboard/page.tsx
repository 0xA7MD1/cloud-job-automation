import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FileTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export const metadata: Metadata = { title: "الرئيسية" };

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <Suspense fallback={<Skeleton className="h-9 w-64" />}>
        <Greeting />
      </Suspense>
      <div className="grid gap-4 sm:grid-cols-2">
        <Suspense fallback={<Skeleton className="h-40" />}>
          <FilesCard />
        </Suspense>
      </div>
    </div>
  );
}

async function Greeting() {
  const user = await requireUser();
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold">أهلًا{user.name ? ` ${user.name}` : ""}</h1>
      <p className="text-muted-foreground">ابدأ برفع سيرتك الذاتية. البحث والتقديم يجون بعدها.</p>
    </div>
  );
}

async function FilesCard() {
  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const { count } = await insforge.database
    .from("files")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("kind", "cv");
  const cvCount = count ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileTextIcon className="size-4 text-muted-foreground" aria-hidden />
          سيرتك الذاتية
        </CardTitle>
        <CardDescription>
          {cvCount === 0 ? "ما رفعت سيرة للحين." : `عندك ${cvCount} ${cvCount === 1 ? "نسخة" : "نسخ"}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        البوت يعبّي نماذج التقديم من سيرتك، فخلها محدّثة.
      </CardContent>
      <CardFooter>
        <Button asChild variant={cvCount === 0 ? "default" : "outline"}>
          <Link href="/files">{cvCount === 0 ? "ارفع سيرتك" : "إدارة الملفات"}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
