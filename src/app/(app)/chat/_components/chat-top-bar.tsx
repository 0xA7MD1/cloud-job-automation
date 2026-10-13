"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { HistoryIcon, SquarePenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChatLinks, type ChatSummary } from "./chat-links";

/** عنوان المحادثة الحالية + (على الجوال) زر المحادثات السابقة وزر محادثة جديدة. */
export function ChatTopBar({ chats }: { chats: ChatSummary[] }) {
  // المحادثة الجديدة تغيّر الرابط لـ/chat/<id> مع أول رسالة (history.replaceState) وusePathname يتبعه
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const id = pathname.startsWith("/chat/") ? pathname.slice("/chat/".length) : null;
  const title = id ? (chats.find((chat) => chat.id === id)?.title ?? "محادثة") : "محادثة جديدة";

  return (
    <>
      <Button variant="ghost" size="icon" className="md:hidden" aria-label="المحادثات السابقة" onClick={() => setOpen(true)}>
        <HistoryIcon aria-hidden />
      </Button>
      <h1 className="min-w-0 flex-1 truncate px-1 font-sans text-sm font-medium" dir="auto" title={title}>
        {title}
      </h1>
      <Button asChild variant="ghost" size="icon" className="md:hidden">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/chat" aria-label="محادثة جديدة">
          <SquarePenIcon aria-hidden />
        </a>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[85%] gap-0 p-0 sm:max-w-xs" aria-describedby={undefined}>
          <SheetHeader className="border-b border-hairline pe-12">
            <SheetTitle>المحادثات</SheetTitle>
          </SheetHeader>
          <div className="border-b border-hairline p-2">
            <Button asChild variant="ghost" className="h-9 w-full justify-start gap-2 px-3 font-semibold">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/chat">
                <SquarePenIcon aria-hidden />
                محادثة جديدة
              </a>
            </Button>
          </div>
          <ChatLinks chats={chats} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
