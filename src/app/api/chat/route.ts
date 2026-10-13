import {
  APICallError,
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  TypeValidationError,
  validateUIMessages,
} from "ai";
import { z } from "zod";
import { getUserModel } from "@/lib/ai/model";
import { getCurrentUser } from "@/lib/auth";
import { chatInstructions } from "@/lib/chat/prompt";
import { createChatTools } from "@/lib/chat/tools";
import type { ChatUIMessage } from "@/lib/chat/types";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { readPreferences } from "@/lib/profile";

// Vercel Hobby يسمح حتى 300 ثانية: قراءة صفحة توظيف (متصفح + ذكاء) أو بحث بالمسمى في عدة لوحات تاخذ دقيقة أحيانًا.
export const maxDuration = 300;

const HISTORY_LIMIT = 40;

const bodySchema = z.object({
  id: z.uuid(),
  message: z.object({
    id: z.string().min(1).max(100),
    role: z.literal("user"),
    parts: z.array(z.record(z.string(), z.unknown())).min(1).max(20),
  }),
});

function textOf(message: { parts: Record<string, unknown>[] }): string {
  return message.parts
    .map((part) => (part.type === "text" && typeof part.text === "string" ? part.text : ""))
    .join(" ")
    .trim();
}

function plain(status: number, message: string) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

function modelErrorMessage(error: unknown): string {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401 || error.statusCode === 403) return "مزود الذكاء رفض مفتاحك. حدّثه من صفحة المفاتيح.";
    if (error.statusCode === 429) return "وصلت حد مزود الذكاء. انتظر شوي أو غيّر المزود من صفحة المفاتيح.";
    if (error.statusCode === 404) return "النموذج المختار مو موجود عند المزود. غيّره من صفحة المفاتيح.";
    if (error.statusCode === 400) return "النموذج رفض الطلب. يمكن ما يدعم الأدوات: جرّب نموذج ثاني من صفحة المفاتيح.";
  }
  return "صار خطأ وقت الرد. جرّب مرة ثانية.";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return plain(401, "سجّل دخول أول.");

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return plain(400, "طلب غير صالح.");
  const { id: chatId, message } = body.data;
  const text = textOf(message);
  if (!text || text.length > 8000) return plain(400, "الرسالة فاضية أو طويلة مرة.");

  const insforge = await createInsForgeServerClient();

  // المحادثة: موجودة للمستخدم، أو ننشئها. لو المعرّف لمستخدم ثاني، الإدخال يفشل (المفتاح الأساسي).
  const { data: chat } = await insforge.database
    .from("chats")
    .select("id, title")
    .eq("id", chatId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!chat) {
    const { error } = await insforge.database
      .from("chats")
      .insert({ id: chatId, user_id: user.id, title: text.slice(0, 80) });
    if (error) return plain(404, "المحادثة مو موجودة.");
  }

  const userModel = await getUserModel(user.id);
  if (!userModel) return plain(400, "أضف مفتاح ذكاء اصطناعي من صفحة المفاتيح أول.");

  const [{ data: history }, { data: profile }] = await Promise.all([
    insforge.database
      .from("messages")
      .select("id, role, parts, metadata, created_at")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    insforge.database.from("profiles").select("preferences").eq("user_id", user.id).maybeSingle(),
  ]);
  const stored = ((history ?? []) as (ChatUIMessage & { created_at: string })[]).reverse();

  // إعادة المحاولة / إعادة التوليد ترسل رسالة المستخدم نفسها: الي قبلها سياق، والردود الي بعدها قديمة
  // تنحذف (لا تدخل السياق ولا ترجع تطلع لما تنفتح المحادثة)
  const retryIndex = stored.findIndex((m) => m.id === message.id);
  const retried = stored[retryIndex];
  if (retried) {
    await insforge.database
      .from("messages")
      .delete()
      .eq("chat_id", chatId)
      .eq("user_id", user.id)
      .gt("created_at", retried.created_at);
  }
  const previous: ChatUIMessage[] = (retried ? stored.slice(0, retryIndex) : stored).map(
    ({ id, role, parts, metadata }) => ({ id, role, parts, metadata }),
  );

  const tools = createChatTools({ userId: user.id, chatId, insforge });

  let messages: ChatUIMessage[];
  try {
    messages = await validateUIMessages<ChatUIMessage>({ messages: [...previous, message], tools });
  } catch (error) {
    // رسائل قديمة ما تطابق شكل الأدوات الحالي: نكمل برسالة المستخدم بس
    if (!(error instanceof TypeValidationError)) throw error;
    messages = await validateUIMessages<ChatUIMessage>({ messages: [message], tools });
  }

  // رسالة المستخدم تنحفظ قبل الرد، عشان ما تضيع لو انقطع البث
  await insforge.database
    .from("messages")
    .upsert(
      { id: message.id, chat_id: chatId, user_id: user.id, role: "user", parts: message.parts },
      { onConflict: "id", ignoreDuplicates: true },
    );

  const result = streamText({
    model: userModel.model,
    instructions: chatInstructions(readPreferences(profile?.preferences), new Date().toISOString().slice(0, 10)),
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: isStepCount(6),
  });
  // يكمّل الرد ويحفظه حتى لو المستخدم سكّر الصفحة
  void result.consumeStream();

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      originalMessages: messages,
      generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
      onError: modelErrorMessage,
      onEnd: async ({ responseMessage }) => {
        if (responseMessage.role !== "assistant" || responseMessage.parts.length === 0) return;
        await insforge.database.from("messages").upsert(
          {
            id: responseMessage.id,
            chat_id: chatId,
            user_id: user.id,
            role: "assistant",
            parts: responseMessage.parts,
            metadata: { provider: userModel.provider, model: userModel.modelId },
          },
          // DO NOTHING بس: المستخدم ما عنده صلاحية تعديل الرسائل
          { onConflict: "id", ignoreDuplicates: true },
        );
        await insforge.database.from("chats").update({ title: chat?.title ?? text.slice(0, 80) }).eq("id", chatId);
      },
    }),
  });
}
