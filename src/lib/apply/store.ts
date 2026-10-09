import type { Application, ApplicationEventType, Company, FileKind, FileRow, Job, Profile } from "@/lib/db/types";
import { getInsForgeAdminClient } from "@/lib/insforge/admin";
import { readAnswers, type Answers } from "@/lib/profile";
import { USER_FILES_BUCKET, buildObjectKey } from "@/lib/storage";

// قراءة وكتابة الطلب من مهام Trigger.dev بعميل الأدمن.
// كل استعلام على جداول المستخدم بفلتر user_id صريح (AGENTS.md).

export const APPLICATION_COLUMNS =
  "id, user_id, job_id, status, answers, form, cv_file_id, cover_letter_file_id, cover_letter_docx_file_id, cover_letter_text, outreach, browser_provider, trigger_run_id, submit_attempted_at, submitted_at, confirmation_ref, evidence_file_id, status_detail, error, prepared_at, created_at, updated_at";

export type JobWithCompany = Pick<
  Job,
  "id" | "source" | "external_id" | "title" | "location" | "description" | "url" | "apply_url" | "closed_at"
> & { company: Pick<Company, "id" | "name" | "domain" | "ats" | "ats_slug"> | null };

export interface ApplicationBundle {
  app: Application;
  job: JobWithCompany;
}

const JOB_COLUMNS = "id, source, external_id, title, location, description, url, apply_url, closed_at, company:companies(id, name, domain, ats, ats_slug)";

export async function loadApplication(applicationId: string): Promise<ApplicationBundle | null> {
  const admin = getInsForgeAdminClient();
  const { data: app } = await admin.database
    .from("applications")
    .select(APPLICATION_COLUMNS)
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return null;
  const { data: job } = await admin.database
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("id", (app as Application).job_id)
    .maybeSingle();
  if (!job) return null;
  return { app: app as Application, job: job as unknown as JobWithCompany };
}

/** يحدّث الطلب (بفلتر المالك) ويسجّل حدث في السجل الي ما ينحذف. */
export async function updateApplication(
  app: Pick<Application, "id" | "user_id">,
  patch: Partial<Application>,
  event?: { type: ApplicationEventType; data?: Record<string, unknown> },
): Promise<void> {
  const admin = getInsForgeAdminClient();
  if (Object.keys(patch).length > 0) {
    const { error } = await admin.database.from("applications").update(patch).eq("id", app.id).eq("user_id", app.user_id);
    if (error) throw new Error(`application update failed: ${error.message}`);
  }
  if (event) {
    const { error } = await admin.database
      .from("application_events")
      .insert({ application_id: app.id, user_id: app.user_id, type: event.type, data: event.data ?? {} });
    if (error) throw new Error(`application event failed: ${error.message}`);
  }
}

export interface ApplicantData {
  profile: Profile | null;
  bank: Answers;
  email: string;
}

export async function loadApplicant(userId: string): Promise<ApplicantData> {
  const admin = getInsForgeAdminClient();
  const [{ data: profile }, { data: email }] = await Promise.all([
    admin.database.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    admin.database.rpc("user_email", { p_user_id: userId }),
  ]);
  return {
    profile: (profile as Profile | null) ?? null,
    bank: readAnswers((profile as Profile | null)?.answers),
    email: typeof email === "string" ? email : "",
  };
}

/** ملف يملكه المستخدم فعلًا. المعرّف جاي من صف يعدّله المستخدم، فنتحقق من الملكية قبل ما نرفعه لأي جهة. */
export async function loadOwnedFile(userId: string, fileId: string | null): Promise<FileRow | null> {
  if (!fileId) return null;
  const { data } = await getInsForgeAdminClient()
    .database.from("files")
    .select("id, user_id, kind, bucket, object_key, file_name, mime_type, size_bytes, created_at")
    .eq("id", fileId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as FileRow | null) ?? null;
}

export async function downloadFile(file: Pick<FileRow, "bucket" | "object_key">): Promise<Buffer> {
  const { data, error } = await getInsForgeAdminClient().storage.from(file.bucket).download(file.object_key);
  if (error || !data) throw new Error(`file download failed${error ? `: ${error.message}` : ""}`);
  return Buffer.from(await data.arrayBuffer());
}

/** يرفع ملف ولّدناه (خطاب، دليل تقديم) لمجلد المستخدم ويسجّله في files. */
export async function storeGeneratedFile(
  userId: string,
  kind: Extract<FileKind, "document" | "evidence">,
  fileName: string,
  mimeType: string,
  content: Buffer,
): Promise<string> {
  const admin = getInsForgeAdminClient();
  const objectKey = buildObjectKey(userId, kind, fileName);
  const blob = new Blob([new Uint8Array(content)], { type: mimeType });
  const { error: uploadError } = await admin.storage.from(USER_FILES_BUCKET).upload(objectKey, blob);
  if (uploadError) throw new Error(`file upload failed: ${uploadError.message}`);

  const { data, error } = await admin.database
    .from("files")
    .insert({
      user_id: userId,
      kind,
      bucket: USER_FILES_BUCKET,
      object_key: objectKey,
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: content.byteLength,
    })
    .select("id")
    .single();
  if (error || !data) {
    await admin.storage.from(USER_FILES_BUCKET).remove(objectKey);
    throw new Error(`file record failed${error ? `: ${error.message}` : ""}`);
  }
  return (data as { id: string }).id;
}

/**
 * يحذف ملف مولّد قديم (بعد ما يتولّد بديله). نوع document بس: خطاب رفعه
 * المستخدم بنفسه (cover_letter) ما نلمسه أبدًا.
 */
export async function removeGeneratedFile(userId: string, fileId: string | null): Promise<void> {
  const file = await loadOwnedFile(userId, fileId);
  if (!file || file.kind !== "document") return;
  const admin = getInsForgeAdminClient();
  await admin.storage.from(file.bucket).remove(file.object_key);
  await admin.database.from("files").delete().eq("id", file.id).eq("user_id", userId);
}
