"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChatUIMessage } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { ToolPartView } from "./tool-parts";

type Part = ChatUIMessage["parts"][number];

/** جزء يطلع للمستخدم: نص فيه كلام، أو بطاقة أداة */
export function isVisiblePart(part: Part): boolean {
  return part.type === "text" ? part.text.trim().length > 0 : part.type.startsWith("tool-");
}

function textOf(message: ChatUIMessage): string {
  return message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n\n")
    .trim();
}

export function MessageView({
  message,
  onAsk,
  busy,
  streaming,
  isLast,
  onRegenerate,
}: {
  message: ChatUIMessage;
  onAsk: (text: string) => void;
  busy: boolean;
  /** الرد هذا ينكتب الحين: أزراره تطلع بعد ما يخلص */
  streaming: boolean;
  isLast: boolean;
  onRegenerate?: () => void;
}) {
  const isUser = message.role === "user";
  const text = textOf(message);

  return (
    // رسائل المستخدم على الطرف الثاني (يسار)، والرد يبدأ من اليمين بعرض العمود
    <div className={cn("group/message flex flex-col gap-3", isUser && "items-end")}>
      {message.parts.map((part, i) => {
        const key = `${message.id}-${i}`;
        if (part.type === "text") {
          if (!part.text.trim()) return null;
          return isUser ? (
            <p
              key={key}
              dir="auto"
              className="max-w-[85%] rounded-3xl bg-muted px-4 py-2.5 text-base leading-7 break-words whitespace-pre-wrap sm:text-[0.9375rem]"
            >
              {part.text}
            </p>
          ) : (
            <Markdown key={key} className="text-[0.9375rem]">
              {part.text}
            </Markdown>
          );
        }
        if (part.type.startsWith("tool-")) {
          return <ToolPartView key={key} part={part} onAsk={onAsk} busy={busy} />;
        }
        return null;
      })}
      {text && !streaming && (
        <MessageActions
          text={text}
          onRegenerate={onRegenerate}
          // آخر رد أزراره ظاهرة دايم، والباقي مع المرور
          persistent={isLast && !isUser}
          className={cn(isUser ? "-mt-2" : "-mt-1 -ms-2")}
        />
      )}
    </div>
  );
}

function MessageActions({
  text,
  onRegenerate,
  persistent,
  className,
}: {
  text: string;
  onRegenerate?: () => void;
  persistent: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("ما قدرنا ننسخ. حدّد النص وانسخه يدويًا.");
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 text-muted-foreground transition-opacity duration-150",
        // بالماوس تبان مع المرور أو التركيز، وباللمس دايم ظاهرة
        !persistent &&
          "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/message:opacity-100 [@media(hover:hover)]:focus-within:opacity-100",
        className,
      )}
    >
      <ActionButton label={copied ? "انتسخ" : "انسخ"} onClick={copy}>
        {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      </ActionButton>
      {onRegenerate && (
        <ActionButton label="ولّد الرد من جديد" onClick={onRegenerate}>
          <RotateCcwIcon aria-hidden />
        </ActionButton>
      )}
    </div>
  );
}

function ActionButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} className="hover:text-foreground">
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
