"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpIcon, RotateCcwIcon, SquareIcon } from "lucide-react";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChatUIMessage } from "@/lib/chat/types";
import { MessageView } from "./message-view";

const SUGGESTIONS = [
  "شركات تقنية مالية في الرياض",
  "شركات ذكاء اصطناعي توظّف عن بعد",
  "شركات ناشئة في دبي تستخدم Greenhouse",
];

export function Chat({ id, initialMessages }: { id: string | null; initialMessages: ChatUIMessage[] }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  // معرّف المحادثة: موجود، أو ينولد مع أول رسالة (uuid يتحقق منه الخادم)
  const [chatId, setChatId] = useState(id);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api: "/api/chat",
        // الخادم يحمّل السجل من القاعدة: نرسل آخر رسالة بس، ومعرّف المحادثة يجي مع كل طلب
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { id: body?.chatId, message: messages[messages.length - 1] },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, stop, error, regenerate } = useChat<ChatUIMessage>({
    // معرّف ثابت للمحادثة الجديدة (بدونه useChat يولّد عشوائي وقت البناء). المعرّف الحقيقي يروح في body
    id: id ?? "new-chat",
    messages: initialMessages,
    transport,
    onFinish: () => router.refresh(),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    let currentId = chatId;
    if (!currentId) {
      // محادثة جديدة: نثبّت رابطها عشان التحديث يرجّعها
      currentId = crypto.randomUUID();
      setChatId(currentId);
      window.history.replaceState(null, "", `/chat/${currentId}`);
    }
    void sendMessage({ text: trimmed }, { body: { chatId: currentId } });
    setInput("");
  }

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-4">
      <div className="flex flex-1 flex-col gap-6">
        {messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
            <h1 className="text-xl font-semibold">وش تدوّر؟</h1>
            <p className="max-w-md text-sm text-muted-foreground">
              قل لي نوع الشركات والمدينة، وألقى لك الشركات ووظائفها من مواقعها الرسمية.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <Button key={s} variant="outline" size="sm" onClick={() => send(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message) => (
          <MessageView key={message.id} message={message} onAsk={send} busy={busy} />
        ))}
        {status === "submitted" && <p className="animate-pulse text-sm text-muted-foreground">يفكر…</p>}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error.message || "صار خطأ."}</AlertDescription>
            <AlertAction>
              <Button variant="outline" size="sm" onClick={() => regenerate({ body: { chatId } })}>
                <RotateCcwIcon data-icon="inline-start" aria-hidden />
                أعد المحاولة
              </Button>
            </AlertAction>
          </Alert>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="sticky bottom-4 flex items-end gap-2 rounded-xl border bg-background p-2 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send(input);
            }
          }}
          placeholder="مثلًا: شركات أمن سيبراني في جدة"
          aria-label="رسالتك"
          rows={1}
          maxLength={8000}
          className="max-h-40 min-h-10 resize-none border-0 shadow-none focus-visible:ring-0"
          dir="auto"
        />
        {busy ? (
          <Button type="button" size="icon" variant="outline" onClick={() => stop()} aria-label="أوقف">
            <SquareIcon aria-hidden />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!input.trim()} aria-label="أرسل">
            <ArrowUpIcon aria-hidden />
          </Button>
        )}
      </form>
    </div>
  );
}
