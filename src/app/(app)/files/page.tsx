import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import type { FileRow } from "@/lib/db/types";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { FileList } from "./file-list";
import { UploadForm } from "./upload-form";

export const metadata: Metadata = { title: "ملفاتي" };

export default function FilesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="ملفاتي"
        description="سيرتك وخطاباتك. الملفات خاصة فيك: ما أحد يشوفها غيرك، والتنزيل برابط مؤقت."
      />
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-32" />
          </div>
        }
      >
        <FilesSection />
      </Suspense>
    </div>
  );
}

async function FilesSection() {
  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database
    .from("files")
    .select("id, kind, file_name, size_bytes, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-hairline bg-card/50 p-4 sm:p-5">
        <UploadForm userId={user.id} />
      </div>
      <FileList files={(data ?? []) as Pick<FileRow, "id" | "kind" | "file_name" | "size_bytes" | "created_at">[]} />
    </div>
  );
}
