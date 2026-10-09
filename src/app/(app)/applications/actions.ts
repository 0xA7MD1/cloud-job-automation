"use server";

import { z } from "zod";
import { readForm, readStoredAnswers, answerValueSchema, type StoredAnswers } from "@/lib/apply/form";
import { isOwnerAccount, reprepareApplication, startApplication, triggerErrorMessage } from "@/lib/apply/service";
import { requireUser } from "@/lib/auth";
import type { Application } from "@/lib/db/types";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { triggerRenderCoverLetter } from "@/lib/trigger/server";

export type AppActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** حالات يقدر المستخدم يعدّل فيها (قبل أي محاولة إرسال) */
const EDITABLE: Application["status"][] = ["draft", "ready", "failed", "cancelled"];

export async function startApplicationAction(jobId: string): Promise<AppActionResult<{ id: string }>> {
  const id = z.uuid().safeParse(jobId);
  if (!id.success) return { ok: false, error: "طلب غير صالح." };
  const user = await requireUser();
  return startApplication(await createInsForgeServerClient(), user.id, id.data);
}

export async function reprepareAction(applicationId: string): Promise<AppActionResult<{ id: string }>> {
  const id = z.uuid().safeParse(applicationId);
  if (!id.success) return { ok: false, error: "طلب غير صالح." };
  const user = await requireUser();
  return reprepareApplication(await createInsForgeServerClient(), user.id, id.data);
}

async function loadEditable(applicationId: string) {
  const id = z.uuid().safeParse(applicationId);
  if (!id.success) return null;
  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database
    .from("applications")
    .select("id, status, form, answers, submit_attempted_at")
    .eq("id", id.data)
    .eq("user_id", user.id)
    .maybeSingle();
  const app = data as Pick<Application, "id" | "status" | "form" | "answers" | "submit_attempted_at"> | null;
  if (!app) return null;
  return { user, insforge, app, editable: EDITABLE.includes(app.status) && !app.submit_attempted_at };
}

const answersInput = z.record(z.string().max(300), answerValueSchema);

/** يحفظ إجابات عدّلها المستخدم. المفاتيح لازم تكون من أسئلة النموذج. */
export async function saveAnswersAction(applicationId: string, input: unknown): Promise<AppActionResult> {
  const parsed = answersInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "إجابات غير صالحة." };
  const found = await loadEditable(applicationId);
  if (!found) return { ok: false, error: "الطلب مو موجود." };
  if (!found.editable) return { ok: false, error: "ما تقدر تعدّل الطلب الحين." };

  const form = readForm(found.app.form);
  if (!form) return { ok: false, error: "الطلب ما تجهّز للحين." };
  const keys = new Set(form.fields.filter((f) => f.type !== "file").map((f) => f.key));

  const current = readStoredAnswers(found.app.answers);
  const next: StoredAnswers = { ...current };
  for (const [key, value] of Object.entries(parsed.data)) {
    if (!keys.has(key)) continue;
    const before = current[key];
    const same = before && JSON.stringify(before.value) === JSON.stringify(value);
    if (same) continue;
    next[key] = { value, source: "user" };
  }

  const { error } = await found.insforge.database.from("applications").update({ answers: next }).eq("id", found.app.id);
  if (error) return { ok: false, error: "ما قدرنا نحفظ الإجابات." };
  return { ok: true, data: undefined };
}

/** يحفظ نص الخطاب ويولّد PDF/Word من جديد في الخلفية */
export async function saveCoverLetterAction(applicationId: string, text: string): Promise<AppActionResult> {
  const body = z.string().trim().min(50, "الخطاب قصير مرة.").max(12_000).safeParse(text);
  if (!body.success) return { ok: false, error: body.error.issues[0]?.message ?? "نص غير صالح." };
  const found = await loadEditable(applicationId);
  if (!found) return { ok: false, error: "الطلب مو موجود." };
  if (!found.editable) return { ok: false, error: "ما تقدر تعدّل الطلب الحين." };

  const { error } = await found.insforge.database
    .from("applications")
    .update({ cover_letter_text: body.data })
    .eq("id", found.app.id);
  if (error) return { ok: false, error: "ما قدرنا نحفظ الخطاب." };

  try {
    await triggerRenderCoverLetter(await isOwnerAccount(found.insforge, found.user.id), found.app.id);
  } catch (e) {
    return { ok: false, error: `انحفظ النص، لكن ${triggerErrorMessage(e)}` };
  }
  return { ok: true, data: undefined };
}

/** يختار نسخة السيرة الذاتية لهذا الطلب */
export async function selectCvAction(applicationId: string, fileId: string): Promise<AppActionResult> {
  const fid = z.uuid().safeParse(fileId);
  if (!fid.success) return { ok: false, error: "ملف غير صالح." };
  const found = await loadEditable(applicationId);
  if (!found) return { ok: false, error: "الطلب مو موجود." };
  if (!found.editable) return { ok: false, error: "ما تقدر تعدّل الطلب الحين." };

  const { data: file } = await found.insforge.database
    .from("files")
    .select("id")
    .eq("id", fid.data)
    .eq("user_id", found.user.id)
    .eq("kind", "cv")
    .maybeSingle();
  if (!file) return { ok: false, error: "السيرة مو موجودة في ملفاتك." };

  const { error } = await found.insforge.database.from("applications").update({ cv_file_id: fid.data }).eq("id", found.app.id);
  if (error) return { ok: false, error: "ما قدرنا نغيّر السيرة." };
  return { ok: true, data: undefined };
}
