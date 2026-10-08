import type { FileKind } from "@/lib/db/types";

export const USER_FILES_BUCKET = "user-files";

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PNG = "image/png";
const JPEG = "image/jpeg";

const MB = 1024 * 1024;

/** الأنواع الي يرفعها المستخدم بنفسه. document/evidence يكتبها الخادم. */
export const UPLOAD_RULES = {
  cv: { label: "سيرة ذاتية", maxBytes: 5 * MB, mimeTypes: [PDF, DOCX] },
  cover_letter: { label: "خطاب تقديم", maxBytes: 5 * MB, mimeTypes: [PDF, DOCX] },
  other: { label: "ملف آخر", maxBytes: 5 * MB, mimeTypes: [PDF, DOCX, PNG, JPEG] },
} as const satisfies Partial<Record<FileKind, { label: string; maxBytes: number; mimeTypes: readonly string[] }>>;

export type UploadKind = keyof typeof UPLOAD_RULES;
export const UPLOAD_KINDS = Object.keys(UPLOAD_RULES) as UploadKind[];

export const FILE_KIND_LABELS: Record<FileKind, string> = {
  cv: "سيرة ذاتية",
  cover_letter: "خطاب تقديم",
  document: "مستند مولّد",
  evidence: "دليل تقديم",
  other: "ملف آخر",
};

export function isUploadKind(value: unknown): value is UploadKind {
  return typeof value === "string" && value in UPLOAD_RULES;
}

/** يرجع سبب الرفض بالعربي، أو null لو الملف مقبول. */
export function validateUpload(
  kind: UploadKind,
  file: { size: number; type: string },
): string | null {
  const rule = UPLOAD_RULES[kind];
  if (file.size <= 0) return "الملف فاضي.";
  if (file.size > rule.maxBytes) return `الحد ${rule.maxBytes / MB}MB للملف.`;
  if (!(rule.mimeTypes as readonly string[]).includes(file.type)) {
    return kind === "other" ? "المسموح: PDF أو Word أو صورة PNG/JPG." : "المسموح: PDF أو Word (docx).";
  }
  return null;
}

/**
 * اسم آمن للمسار: يحافظ على الحروف العربية واللاتينية والأرقام، ويستبدل الباقي بـ-.
 * الاسم الأصلي ينحفظ كما هو في files.file_name.
 */
export function sanitizeFileName(name: string): string {
  // اسم الملف بس، بدون أي مسار قبله
  const trimmed = (name.normalize("NFC").split(/[\\/]/).pop() ?? "").trim();
  const dot = trimmed.lastIndexOf(".");
  const base = dot > 0 ? trimmed.slice(0, dot) : trimmed;
  const ext = dot > 0 ? trimmed.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";

  const safeBase =
    base
      .replace(/[^\p{L}\p{N}_-]+/gu, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "file";

  return ext ? `${safeBase}.${ext.slice(0, 10)}` : safeBase;
}

/** المسار في الـbucket: <user_id>/<kind>/<uuid>-<name>. أول جزء لازم يكون المالك (سياسات Storage). */
export function buildObjectKey(
  userId: string,
  kind: FileKind,
  fileName: string,
  id: string = crypto.randomUUID(),
): string {
  return `${userId}/${kind}/${id}-${sanitizeFileName(fileName)}`;
}

/** يتأكد إن المسار داخل مجلد المستخدم ونوعه صحيح، قبل ما نسجّله في الجدول. */
export function isOwnedObjectKey(objectKey: string, userId: string, kind: FileKind): boolean {
  const parts = objectKey.split("/");
  return (
    parts.length === 3 &&
    parts[0] === userId &&
    parts[1] === kind &&
    !!parts[2] &&
    !objectKey.includes("..") &&
    objectKey.length <= 400
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}
