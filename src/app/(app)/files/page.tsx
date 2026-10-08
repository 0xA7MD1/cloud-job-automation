import type { Metadata } from "next";
import { Suspense } from "react";
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
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">ملفاتي</h1>
        <p className="text-muted-foreground">
          سيرتك وخطاباتك. الملفات خاصة فيك: ما أحد يشوفها غيرك، والتنزيل برابط مؤقت.
        </p>
      </div>
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
      <UploadForm userId={user.id} />
      <FileList files={(data ?? []) as Pick<FileRow, "id" | "kind" | "file_name" | "size_bytes" | "created_at">[]} />
    </div>
  );
}
