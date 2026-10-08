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
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <Skeleton className="h-16 w-2/3" />
          <Skeleton className="ms-auto h-24 w-3/4" />
        </div>
      }
    >
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

  const { data } = await insforge.database
    .from("messages")
    .select("id, role, parts, metadata")
    .eq("chat_id", id)
    .order("created_at", { ascending: true })
    .limit(200);

  return <Chat id={id} initialMessages={(data ?? []) as ChatUIMessage[]} />;
}
