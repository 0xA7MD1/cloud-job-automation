import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import type { ChatUIMessage } from "@/lib/chat/types";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { Chat } from "../_components/chat";

export const metadata: Metadata = { title: "الشات" };

export default function ChatPage({ params }: PageProps<"/chat/[id]">) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ExistingChat params={params} />
    </Suspense>
  );
}

async function ExistingChat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const { data: chat } = await insforge.database
    .from("chats")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!chat) notFound();

  // آخر 200 رسالة (مو أول 200): المحادثة الطويلة تفتح على آخرها
  const { data } = await insforge.database
    .from("messages")
    .select("id, role, parts, metadata")
    .eq("chat_id", id)
    .order("created_at", { ascending: false })
    .limit(200);

  return <Chat id={id} initialMessages={((data ?? []) as ChatUIMessage[]).reverse()} />;
}

/** نفس شكل الشات (رسائل + مربع الكتابة) عشان ما تنط الصفحة لما يوصل */
function ChatSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 overflow-hidden px-4 pt-6 sm:px-6">
        <Skeleton className="ms-auto h-11 w-1/2 rounded-3xl" />
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
      <div className="px-3 pb-3 sm:px-6 sm:pb-4">
        <Skeleton className="mx-auto h-27 w-full max-w-3xl rounded-[1.625rem]" />
      </div>
    </div>
  );
}
