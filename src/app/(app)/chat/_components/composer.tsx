"use client";

import { useEffect, useLayoutEffect, useSyncExternalStore, type RefObject } from "react";
import { ArrowUpIcon, SquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// نفس حد الخادم (/api/chat)
export const MAX_MESSAGE = 8000;
// العداد يطلع قرب الحد بس
const COUNTER_FROM = MAX_MESSAGE - 1000;

const COARSE = "(pointer: coarse)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(COARSE);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** شاشة لمس: Enter ينزّل سطر والإرسال بالزر، مثل تطبيقات الجوال */
function useCoarsePointer() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(COARSE).matches, () => false);
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-hairline bg-muted px-1 py-px font-sans text-[0.6875rem] text-foreground/80" dir="ltr">
      {children}
    </kbd>
  );
}

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  inputRef,
  autoFocus,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  autoFocus?: boolean;
  placeholder: string;
  className?: string;
}) {
  const coarse = useCoarsePointer();
  const canSend = !busy && value.trim().length > 0;

  // يكبر مع النص لين الحد الأعلى (field-sizing ما يدعمه كل متصفح)
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, inputRef]);

  // التركيز التلقائي بالماوس بس: على الجوال يفتح الكيبورد ويغطي الصفحة
  useEffect(() => {
    if (autoFocus && window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, [autoFocus, inputRef]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSend();
      }}
      className={cn(
        "rounded-[1.625rem] border border-hairline bg-(--glass) shadow-(--card-shadow) backdrop-blur-xl transition-[border-color,box-shadow] duration-200 focus-within:border-(--border-strong)",
        className,
      )}
    >
      <textarea
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && busy) {
            event.preventDefault();
            onStop();
            return;
          }
          if (event.key === "Enter" && !event.shiftKey && !coarse && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (canSend) onSend();
          }
        }}
        placeholder={placeholder}
        aria-label="رسالتك"
        rows={1}
        maxLength={MAX_MESSAGE}
        dir="auto"
        // 16px على الجوال: أقل منها يخلي آيفون يقرّب الصفحة عند التركيز
        className="block max-h-[min(40dvh,16rem)] min-h-13 w-full resize-none overflow-y-auto bg-transparent px-5 pt-4 pb-1 text-base leading-7 outline-none placeholder:text-muted-foreground sm:text-[0.9375rem]"
      />
      <div className="flex items-center gap-3 ps-5 pe-2.5 pb-2.5">
        <p className="hidden text-xs text-muted-foreground [@media(pointer:fine)]:block" aria-hidden>
          {busy ? (
            <>
              <Kbd>Esc</Kbd> يوقف الرد
            </>
          ) : (
            <>
              <Kbd>Enter</Kbd> يرسل · <Kbd>Shift</Kbd> + <Kbd>Enter</Kbd> سطر جديد
            </>
          )}
        </p>
        {value.length >= COUNTER_FROM && (
          <span
            className={cn("text-xs text-muted-foreground tabular-nums", value.length >= MAX_MESSAGE && "text-destructive")}
            dir="ltr"
          >
            {value.length.toLocaleString("en")} / {MAX_MESSAGE.toLocaleString("en")}
          </span>
        )}
        <div className="ms-auto">
          {busy ? (
            <Button type="button" size="icon-lg" variant="outline" className="rounded-full" onClick={onStop} aria-label="أوقف الرد">
              <SquareIcon className="size-3.5 fill-current" aria-hidden />
            </Button>
          ) : (
            <Button type="submit" size="icon-lg" className="rounded-full" disabled={!canSend} aria-label="أرسل">
              <ArrowUpIcon aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
