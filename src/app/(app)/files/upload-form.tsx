"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getInsForgeBrowserClient } from "@/lib/insforge/client";
import {
  UPLOAD_KINDS,
  UPLOAD_RULES,
  USER_FILES_BUCKET,
  buildObjectKey,
  validateUpload,
  type UploadKind,
} from "@/lib/storage";
import { registerFile } from "./actions";

export function UploadForm({ userId }: { userId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<UploadKind>("cv");
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("file");
    if (!(file instanceof File) || file.size === 0) {
      toast.error("اختر ملف.");
      return;
    }
    const invalid = validateUpload(kind, file);
    if (invalid) {
      toast.error(invalid);
      return;
    }

    startTransition(async () => {
      // 1) رفع مباشر من المتصفح لـInsForge Storage (سياسات الـbucket تتحقق من المجلد)
      const storage = getInsForgeBrowserClient().storage.from(USER_FILES_BUCKET);
      const objectKey = buildObjectKey(userId, kind, file.name);
      const uploaded = await storage.upload(objectKey, file);
      if (uploaded.error) {
        toast.error("فشل الرفع. تأكد من اتصالك وجرّب مرة ثانية.");
        return;
      }

      // 2) تسجيل البيانات في جدول files. لو فشل، نشيل الملف عشان ما يبقى يتيم.
      const registered = await registerFile({
        kind,
        objectKey,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      if (!registered.ok) {
        await storage.remove(objectKey);
        toast.error(registered.error);
        return;
      }

      toast.success("انرفع الملف.");
      formRef.current?.reset();
      router.refresh();
    });
  }

  const rule = UPLOAD_RULES[kind];
  return (
    <form ref={formRef} onSubmit={onSubmit}>
      <FieldGroup className="sm:flex-row sm:items-end">
        <Field className="sm:max-w-44">
          <FieldLabel htmlFor="kind">النوع</FieldLabel>
          <NativeSelect
            id="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as UploadKind)}
          >
            {UPLOAD_KINDS.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {UPLOAD_RULES[value].label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="file">الملف</FieldLabel>
          <Input id="file" name="file" type="file" accept={rule.mimeTypes.join(",")} required />
          <FieldDescription>
            {kind === "other" ? "PDF أو Word أو صورة" : "PDF أو Word"}، حتى {rule.maxBytes / (1024 * 1024)}MB.
          </FieldDescription>
        </Field>
        <Button type="submit" variant="cta" disabled={pending} className="sm:mb-7">
          <UploadIcon data-icon="inline-start" aria-hidden />
          {pending ? "جاري الرفع…" : "ارفع"}
        </Button>
      </FieldGroup>
    </form>
  );
}
