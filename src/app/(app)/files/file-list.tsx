"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { DownloadIcon, FolderOpenIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FileRow } from "@/lib/db/types";
import { formatDateTime } from "@/lib/format";
import { FILE_KIND_LABELS, formatBytes } from "@/lib/storage";
import { deleteFile, getDownloadUrl } from "./actions";

type ListedFile = Pick<FileRow, "id" | "kind" | "file_name" | "size_bytes" | "created_at">;

export function FileList({ files }: { files: ListedFile[] }) {
  if (files.length === 0) {
    return <EmptyState icon={FolderOpenIcon}>ما فيه ملفات للحين. ارفع سيرتك الذاتية من فوق.</EmptyState>;
  }
  return (
    <ul className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-card/50">
      {files.map((file) => (
        <FileItem key={file.id} file={file} />
      ))}
    </ul>
  );
}

function FileItem({ file }: { file: ListedFile }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function download() {
    startTransition(async () => {
      const result = await getDownloadUrl(file.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.open(result.data, "_blank", "noopener,noreferrer");
    });
  }

  function remove() {
    if (!window.confirm(`تحذف «${file.file_name}»؟ ما تقدر ترجعه.`)) return;
    startTransition(async () => {
      const result = await deleteFile(file.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("انحذف الملف.");
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-medium" dir="auto">
          {file.file_name}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatBytes(file.size_bytes)} · {formatDateTime(file.created_at)}
        </span>
      </div>
      <Badge variant="secondary">{FILE_KIND_LABELS[file.kind]}</Badge>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={download} disabled={pending} aria-label="تنزيل">
          <DownloadIcon aria-hidden />
        </Button>
        <Button variant="ghost" size="icon" onClick={remove} disabled={pending} aria-label="حذف">
          <Trash2Icon aria-hidden />
        </Button>
      </div>
    </li>
  );
}
