"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export type JobActionResult = { ok: true } | { ok: false; error: string };

const statusSchema = z.enum(["new", "saved", "dismissed"]);

/** فرز الوظيفة عند المستخدم: جديدة / محفوظة / مستبعدة. لو مو مربوطة به نربطها. */
export async function setJobStatusAction(jobId: string, status: string): Promise<JobActionResult> {
  const id = z.uuid().safeParse(jobId);
  const parsed = statusSchema.safeParse(status);
  if (!id.success || !parsed.success) return { ok: false, error: "طلب غير صالح." };

  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database
    .from("user_jobs")
    .upsert({ user_id: user.id, job_id: id.data, status: parsed.data }, { onConflict: "user_id,job_id" });
  if (error) return { ok: false, error: "ما قدرنا نحدّث الوظيفة." };
  return { ok: true };
}

export async function followCompanyAction(companyId: string): Promise<JobActionResult> {
  const id = z.uuid().safeParse(companyId);
  if (!id.success) return { ok: false, error: "طلب غير صالح." };

  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database
    .from("user_companies")
    .upsert({ user_id: user.id, company_id: id.data }, { onConflict: "user_id,company_id", ignoreDuplicates: true });
  if (error) return { ok: false, error: "ما قدرنا نتابع الشركة." };
  return { ok: true };
}

export async function unfollowCompanyAction(companyId: string): Promise<JobActionResult> {
  const id = z.uuid().safeParse(companyId);
  if (!id.success) return { ok: false, error: "طلب غير صالح." };

  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database
    .from("user_companies")
    .delete()
    .eq("user_id", user.id)
    .eq("company_id", id.data);
  if (error) return { ok: false, error: "ما قدرنا نلغي المتابعة." };
  return { ok: true };
}
