"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckIcon, PencilIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteChatAction, renameChatAction } from "../actions";

export interface ChatSummary {
  id: string;
  title: string | null;
  /** «آخر 24 ساعة»، «آخر 7 أيام»… يحسبها الخادم */
  group: string;
}

// البحث يطلع بس لما القائمة تطول
const SEARCH_FROM = 8;

export function ChatLinks({ chats, onNavigate }: { chats: ChatSummary[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  // المحذوفة تختفي فورًا، قبل ما يرجع الخادم بالقائمة الجديدة
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());

  const needle = query.trim().toLowerCase();
  const visible = chats.filter(
    (chat) => !removed.has(chat.id) && (!needle || (chat.title ?? "").toLowerCase().includes(needle)),
  );
  // القائمة مرتبة بالأحدث ⇒ المجموعات تطلع بنفس الترتيب
  const groups = new Map<string, ChatSummary[]>();
  for (const chat of visible) groups.set(chat.group, [...(groups.get(chat.group) ?? []), chat]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {chats.length >= SEARCH_FROM && (
        <div className="relative shrink-0 px-2 pt-2">
          <SearchIcon className="pointer-events-none absolute start-5 top-1/2 mt-1 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="دوّر في المحادثات"
            aria-label="دوّر في المحادثات"
            className="h-9 w-full rounded-lg border border-hairline bg-transparent ps-9 pe-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-(--border-strong) focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </div>
      )}

      <nav aria-label="المحادثات" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-1 pb-3">
        {chats.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-pretty text-muted-foreground">
            محادثاتك تنحفظ هنا. ابدأ بسؤال عن نوع الشركات الي تبيها.
          </p>
        ) : visible.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">ما فيه محادثة بهذا الاسم.</p>
        ) : (
          [...groups].map(([label, items]) => (
            <section key={label} aria-label={label} className="mt-3 first:mt-2">
              <h3 className="px-3 pb-1 text-xs font-medium text-muted-foreground">{label}</h3>
              <ul className="flex flex-col gap-px">
                {items.map((chat) => (
                  <ChatRow
                    key={chat.id}
                    chat={chat}
                    active={pathname === `/chat/${chat.id}`}
                    onNavigate={onNavigate}
                    onRemoved={() => setRemoved((prev) => new Set(prev).add(chat.id))}
                    onRestored={() =>
                      setRemoved((prev) => {
                        const next = new Set(prev);
                        next.delete(chat.id);
                        return next;
                      })
                    }
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </nav>
    </div>
  );
}

function ChatRow({
  chat,
  active,
  onNavigate,
  onRemoved,
  onRestored,
}: {
  chat: ChatSummary;
  active: boolean;
  onNavigate?: () => void;
  onRemoved: () => void;
  onRestored: () => void;
}) {
  const [mode, setMode] = useState<"view" | "rename" | "confirm">("view");
  // الاسم الجديد يبان فورًا لين يرجع الخادم بالقائمة
  const [renamed, setRenamed] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const title = renamed ?? chat.title ?? "محادثة";

  function rename(value: string) {
    const next = value.trim();
    setMode("view");
    if (!next || next === title) return;
    setRenamed(next);
    startTransition(async () => {
      const result = await renameChatAction(chat.id, next);
      if (!result.ok) {
        setRenamed(null);
        toast.error(result.error);
      }
    });
  }

  function remove() {
    setMode("view");
    onRemoved();
    startTransition(async () => {
      const result = await deleteChatAction(chat.id);
      if (!result.ok) {
        onRestored();
        toast.error(result.error);
        return;
      }
      if (!active) return void toast.success("انحذفت المحادثة.");
      // المحادثة المفتوحة انحذفت ⇒ محادثة جديدة بتحميل كامل (مثل زر «محادثة جديدة»): لو الشات بدأ في
      // /chat وتغيّر رابطه بـreplaceState، التنقل الداخلي لـ/chat يرجّع نفس المكوّن برسائله
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/chat");
    });
  }

  if (mode === "rename") {
    return (
      <li>
        <form
          className="flex items-center gap-1 rounded-lg bg-foreground/5 p-1"
          onSubmit={(event) => {
            event.preventDefault();
            rename(new FormData(event.currentTarget).get("title")?.toString() ?? "");
          }}
        >
          <input
            name="title"
            defaultValue={title}
            maxLength={200}
            aria-label="اسم المحادثة"
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => event.key === "Escape" && setMode("view")}
            className="h-8 min-w-0 flex-1 rounded-md border border-hairline bg-background px-2 text-sm outline-none focus-visible:border-(--border-strong)"
            dir="auto"
          />
          <Button type="submit" variant="ghost" size="icon-sm" aria-label="احفظ الاسم">
            <CheckIcon aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="إلغاء" onClick={() => setMode("view")}>
            <XIcon aria-hidden />
          </Button>
        </form>
      </li>
    );
  }

  if (mode === "confirm") {
    return (
      <li className="flex items-center gap-1 rounded-lg bg-destructive/10 py-1 ps-3 pe-1 text-sm" role="group" aria-label="تأكيد الحذف">
        <span className="min-w-0 flex-1 truncate">تحذف «{title}»؟</span>
        <Button variant="destructive" size="sm" autoFocus onClick={remove}>
          احذف
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setMode("view")}>
          لا
        </Button>
      </li>
    );
  }

  return (
    <li
      className={cn(
        "group/row relative flex items-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground has-focus-visible:bg-foreground/5",
        active && "bg-foreground/10 text-foreground hover:bg-foreground/10",
        pending && "opacity-60",
      )}
    >
      <Link
        href={`/chat/${chat.id}`}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        className="min-w-0 flex-1 truncate rounded-lg py-2 ps-3 pe-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        dir="auto"
        title={title}
      >
        {title}
      </Link>
      {/* بالماوس تبان مع المرور أو التركيز، وباللمس دايم ظاهرة */}
      <div className="flex shrink-0 items-center pe-1 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100 [@media(hover:hover)]:group-has-focus-visible/row:opacity-100">
        <Button variant="ghost" size="icon-xs" aria-label={`غيّر اسم «${title}»`} onClick={() => setMode("rename")}>
          <PencilIcon aria-hidden />
        </Button>
        <Button variant="ghost" size="icon-xs" aria-label={`احذف «${title}»`} onClick={() => setMode("confirm")}>
          <Trash2Icon aria-hidden />
        </Button>
      </div>
    </li>
  );
}
