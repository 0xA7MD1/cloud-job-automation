"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export type ChatActionResult = { ok: true } | { ok: false; error: string };

const titleSchema = z.string().trim().min(1).max(200);

export async function renameChatAction(chatId: string, title: string): Promise<ChatActionResult> {
  const id = z.uuid().safeParse(chatId);
  const name = titleSchema.safeParse(title);
  if (!id.success || !name.success) return { ok: false, error: "اكتب اسم من حرف لين 200." };

  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database
    .from("chats")
    .update({ title: name.data })
    .eq("id", id.data)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "ما قدرنا نغيّر اسم المحادثة." };
  refresh();
  return { ok: true };
}

/** يحذف المحادثة ورسائلها (cascade). البحوث المرتبطة تبقى وينفك ربطها. */
export async function deleteChatAction(chatId: string): Promise<ChatActionResult> {
  const id = z.uuid().safeParse(chatId);
  if (!id.success) return { ok: false, error: "طلب غير صالح." };

  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database.from("chats").delete().eq("id", id.data).eq("user_id", user.id);
  if (error) return { ok: false, error: "ما قدرنا نحذف المحادثة." };
  refresh();
  return { ok: true };
}
