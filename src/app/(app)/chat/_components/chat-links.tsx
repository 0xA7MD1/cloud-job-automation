"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ChatLinks({ chats }: { chats: { id: string; title: string | null }[] }) {
  const pathname = usePathname();
  if (chats.length === 0) return <p className="text-sm text-muted-foreground">ما فيه محادثات.</p>;
  return (
    <nav className="flex flex-col gap-1" aria-label="المحادثات">
      {chats.map((chat) => {
        const href = `/chat/${chat.id}`;
        return (
          <Link
            key={chat.id}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            className={cn(
              "truncate rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
              pathname === href && "bg-muted text-foreground",
            )}
            dir="auto"
          >
            {chat.title || "محادثة"}
          </Link>
        );
      })}
    </nav>
  );
}
