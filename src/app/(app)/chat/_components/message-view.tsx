"use client";

import { Markdown } from "@/components/markdown";
import type { ChatUIMessage } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { ToolPartView } from "./tool-parts";

export function MessageView({
  message,
  onAsk,
  busy,
}: {
  message: ChatUIMessage;
  onAsk: (text: string) => void;
  busy: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex flex-col gap-3", isUser && "items-start")}>
      {message.parts.map((part, i) => {
        const key = `${message.id}-${i}`;
        if (part.type === "text") {
          return isUser ? (
            <p key={key} dir="auto" className="max-w-[85%] rounded-2xl bg-muted px-4 py-2 text-sm whitespace-pre-wrap">
              {part.text}
            </p>
          ) : (
            <Markdown key={key}>{part.text}</Markdown>
          );
        }
        if (part.type.startsWith("tool-")) {
          return <ToolPartView key={key} part={part} onAsk={onAsk} busy={busy} />;
        }
        return null;
      })}
    </div>
  );
}
