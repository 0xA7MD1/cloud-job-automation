import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import type { Profile } from "@/lib/db/types";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { readAnswers, readPreferences } from "@/lib/profile";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "ملفي" };

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="ملفي" description="كل ما كان كامل، قلّت الأسئلة الي نوقف عندها وقت التقديم." />
      <Suspense fallback={<Skeleton className="h-[40rem]" />}>
        <ProfileSection />
      </Suspense>
    </div>
  );
}

async function ProfileSection() {
  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const [{ data: profile }, { data: cvFiles }] = await Promise.all([
    insforge.database.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    insforge.database
      .from("files")
      .select("id, file_name")
      .eq("user_id", user.id)
      .eq("kind", "cv")
      .order("created_at", { ascending: false }),
  ]);
  const row = (profile ?? { full_name: user.name }) as Partial<Profile>;

  return (
    <ProfileForm
      profile={row}
      answers={readAnswers(row.answers)}
      preferences={readPreferences(row.preferences)}
      cvFiles={(cvFiles ?? []) as { id: string; file_name: string }[]}
    />
  );
}
