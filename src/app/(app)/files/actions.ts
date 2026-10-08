"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import type { FileRow } from "@/lib/db/types";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { USER_FILES_BUCKET, isOwnedObjectKey, isUploadKind, validateUpload } from "@/lib/storage";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const registerInput = z.object({
  kind: z.string().refine(isUploadKind),
  objectKey: z.string().min(1).max(400),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive(),
});

/**
 * يسجّل ملف بعد ما رفعه المتصفح مباشرة لـInsForge Storage.
 * الملف نفسه ما يمر من هنا (حد Vercel 4.5MB)، بس بياناته.
 */
export async function registerFile(input: z.input<typeof registerInput>): Promise<ActionResult> {
  const parsed = registerInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "بيانات الملف ناقصة." };
  const { kind, objectKey, fileName, mimeType, sizeBytes } = parsed.data;
  if (!isUploadKind(kind)) return { ok: false, error: "نوع الملف غير مسموح." };

  const user = await requireUser();
  if (!isOwnedObjectKey(objectKey, user.id, kind)) return { ok: false, error: "مسار الملف غير صالح." };

  const invalid = validateUpload(kind, { size: sizeBytes, type: mimeType });
  if (invalid) return { ok: false, error: invalid };

  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database.from("files").insert({
    user_id: user.id,
    kind,
    bucket: USER_FILES_BUCKET,
    object_key: objectKey,
    file_name: fileName,
    mime_type: mimeType,
    size_bytes: sizeBytes,
  });
  if (error) return { ok: false, error: "ما قدرنا نحفظ بيانات الملف." };
  return { ok: true, data: undefined };
}

async function getOwnFile(fileId: string) {
  const id = z.uuid().safeParse(fileId);
  if (!id.success) return null;

  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database
    .from("files")
    .select("id, bucket, object_key, file_name")
    .eq("id", id.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return { insforge, file: data as Pick<FileRow, "id" | "bucket" | "object_key" | "file_name"> };
}

/** رابط تنزيل مؤقت (5 دقائق). الـbucket خاص، فما فيه رابط دائم. */
export async function getDownloadUrl(fileId: string): Promise<ActionResult<string>> {
  const found = await getOwnFile(fileId);
  if (!found) return { ok: false, error: "الملف مو موجود." };

  const { data, error } = await found.insforge.storage
    .from(found.file.bucket)
    .createSignedUrl(found.file.object_key, 300);
  if (error || !data?.signedUrl) return { ok: false, error: "ما قدرنا نجهّز رابط التنزيل." };
  return { ok: true, data: data.signedUrl };
}

export async function deleteFile(fileId: string): Promise<ActionResult> {
  const found = await getOwnFile(fileId);
  if (!found) return { ok: false, error: "الملف مو موجود." };

  // الملف أول ثم الصف: لو فشل حذف الملف يبقى الصف وتقدر تعيد المحاولة.
  const removed = await found.insforge.storage.from(found.file.bucket).remove(found.file.object_key);
  if (removed.error && removed.error.statusCode !== 404) {
    return { ok: false, error: "ما قدرنا نحذف الملف من التخزين." };
  }

  const { error } = await found.insforge.database.from("files").delete().eq("id", found.file.id);
  if (error) return { ok: false, error: "انحذف الملف لكن بقي سجله. جرّب مرة ثانية." };
  return { ok: true, data: undefined };
}
