"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  ArrowDownIcon,
  BrainCircuitIcon,
  CircleAlertIcon,
  KeyRoundIcon,
  LandmarkIcon,
  LinkIcon,
  RocketIcon,
  RotateCcwIcon,
  type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ChatUIMessage } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { Composer } from "./composer";
import { isVisiblePart, MessageView } from "./message-view";
import { useStickToBottom } from "./use-stick-to-bottom";

// send = يرسلها فورًا. وإلا تنكتب في المربع ويكمّلها المستخدم (مثل لصق الرابط)
const SUGGESTIONS: { icon: LucideIcon; label: string; hint?: string; prompt: string; send: boolean }[] = [
  { icon: LandmarkIcon, label: "شركات تقنية مالية في الرياض", prompt: "شركات تقنية مالية في الرياض", send: true },
  { icon: BrainCircuitIcon, label: "شركات ذكاء اصطناعي توظّف عن بعد", prompt: "شركات ذكاء اصطناعي توظّف عن بعد", send: true },
  { icon: RocketIcon, label: "شركات ناشئة في دبي تستخدم Greenhouse", prompt: "شركات ناشئة في دبي تستخدم Greenhouse", send: true },
  {
    icon: LinkIcon,
    label: "قدّم على وظيفة من رابطها",
    hint: "Greenhouse · Lever · Ashby",
    prompt: "قدّم لي على هذي الوظيفة: ",
    send: false,
  },
];

export function Chat({ id, initialMessages }: { id: string | null; initialMessages: ChatUIMessage[] }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // معرّف المحادثة: موجود، أو ينولد مع أول رسالة (uuid يتحقق منه الخادم)
  const [chatId, setChatId] = useState(id);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api: "/api/chat",
        // الخادم يحمّل السجل من القاعدة: نرسل آخر رسالة بس، ومعرّف المحادثة يجي مع كل طلب.
        // إعادة التوليد ترسل رسالة المستخدم نفسها، والخادم يحذف الردود القديمة الي بعدها
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
    // يحدّث قائمة المحادثات (العنوان والترتيب)
    onFinish: () => router.refresh(),
  });

  const busy = status === "submitted" || status === "streaming";
  const hasMessages = messages.length > 0;
  const { scrollRef, contentRef, atBottom, scrollToBottom } = useStickToBottom(hasMessages);
  const last = messages.at(-1);
  // الطلب راح وما وصل شي يبان للحين ⇒ نقاط الانتظار
  const waiting =
    status === "submitted" || (status === "streaming" && !(last?.role === "assistant" && last.parts.some(isVisiblePart)));

  function focusInput() {
    // بالماوس بس: على الجوال التركيز يفتح الكيبورد فوق الرد
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }

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
    scrollToBottom();
    void sendMessage({ text: trimmed }, { body: { chatId: currentId } });
    setInput("");
    focusInput();
  }

  function retry() {
    if (busy) return;
    scrollToBottom();
    void regenerate({ body: { chatId } });
  }

  const composer = (
    <Composer
      value={input}
      onChange={setInput}
      onSend={() => send(input)}
      onStop={() => void stop()}
      busy={busy}
      inputRef={inputRef}
      autoFocus
      placeholder={hasMessages ? "اكتب ردّك…" : "مثلًا: شركات أمن سيبراني في جدة"}
    />
  );

  if (!hasMessages) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="m-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <h2 className="font-display text-3xl leading-[1.25] sm:text-4xl">وش تدوّر؟</h2>
            <p className="max-w-md text-sm text-pretty text-muted-foreground">
              قل لي نوع الشركات والمدينة، وألقى لك الشركات ووظائفها من مواقعها الرسمية.
            </p>
          </div>
          {composer}
          <ul className="grid gap-2 sm:grid-cols-2" aria-label="اقتراحات">
            {SUGGESTIONS.map(({ icon: Icon, label, hint, prompt, send: sendNow }) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => {
                    if (sendNow) return send(prompt);
                    setInput(prompt);
                    inputRef.current?.focus();
                  }}
                  className="group/suggestion flex h-full w-full items-center gap-3 rounded-2xl border border-hairline bg-card/40 px-3.5 py-3 text-start text-sm transition-colors outline-none hover:border-(--border-strong) hover:bg-(--glass-hover) focus-visible:border-(--border-strong) focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-hairline bg-background text-muted-foreground transition-colors group-hover/suggestion:text-foreground">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium text-pretty">{label}</span>
                    {hint && (
                      <span className="text-xs text-muted-foreground" dir="ltr">
                        {hint}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div
          ref={contentRef}
          role="log"
          aria-label="المحادثة"
          className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-6 pb-12 sm:px-6"
        >
          {messages.map((message, index) => {
            const isLast = index === messages.length - 1;
            return (
              <MessageView
                key={message.id}
                message={message}
                onAsk={send}
                busy={busy}
                streaming={busy && isLast}
                isLast={isLast}
                onRegenerate={isLast && message.role === "assistant" && !busy ? retry : undefined}
              />
            );
          })}
          {waiting && <TypingDots />}
          {error && !busy && <ChatError message={error.message} onRetry={retry} />}
        </div>
      </div>

      <div className="relative shrink-0 px-3 pb-3 sm:px-6 sm:pb-4">
        {/* الرسائل تتلاشى تحت مربع الكتابة بدل ما تنقص فجأة */}
        <div className="pointer-events-none absolute inset-x-0 bottom-full h-10 bg-linear-to-t from-background" aria-hidden />
        <div
          inert={atBottom}
          className={cn(
            "absolute inset-x-0 bottom-full mb-2 flex justify-center transition-[opacity,translate] duration-200 motion-reduce:transition-none",
            atBottom ? "pointer-events-none translate-y-2 opacity-0" : "opacity-100",
          )}
        >
          <Button
            variant="glass"
            size="icon-pill"
            className="size-10"
            aria-label="انزل لآخر المحادثة"
            onClick={() => scrollToBottom()}
          >
            <ArrowDownIcon aria-hidden />
            {/* فيه رد ينكتب تحت */}
            {busy && <span className="absolute top-0.5 end-0.5 size-2 rounded-full bg-foreground motion-safe:animate-pulse" aria-hidden />}
          </Button>
        </div>
        <div className="mx-auto w-full max-w-3xl">
          {composer}
          <p className="mt-2 text-center text-[0.6875rem] text-pretty text-muted-foreground">
            ما ينرسل أي طلب تقديم إلا بعد تأكيدك من صفحة الطلب.
          </p>
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div role="status" aria-label="يكتب الرد" className="flex h-7 items-center gap-1.5">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 rounded-full bg-muted-foreground/70 motion-safe:animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

function ChatError({ message, onRetry }: { message: string; onRetry: () => void }) {
  // أخطاء خادمنا عربية. غيرها (انقطاع الشبكة مثلًا) رسالة المتصفح بالإنجليزي ⇒ نستبدلها
  const text = /[؀-ۿ]/.test(message) ? message : "انقطع الاتصال أو صار خطأ. تأكد من الإنترنت وجرّب مرة ثانية.";
  return (
    <Alert variant="destructive">
      <CircleAlertIcon aria-hidden />
      <AlertDescription className="flex flex-col gap-3">
        <p>{text}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcwIcon data-icon="inline-start" aria-hidden />
            أعد المحاولة
          </Button>
          {text.includes("المفاتيح") && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/settings/keys">
                <KeyRoundIcon data-icon="inline-start" aria-hidden />
                صفحة المفاتيح
              </Link>
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
