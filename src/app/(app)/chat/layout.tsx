import type { Viewport } from "next";
import Link from "next/link";
import { cache, Suspense } from "react";
import { KeyRoundIcon, SquarePenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { requireUser } from "@/lib/auth";
import { AI_PROVIDERS, SEARCH_PROVIDERS } from "@/lib/byok/providers";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { ChatLinks, type ChatSummary } from "./_components/chat-links";
import { ChatTopBar } from "./_components/chat-top-bar";

// كروم أندرويد يصغّر الصفحة مع الكيبورد ⇒ مربع الكتابة يبقى ظاهر
export const viewport: Viewport = { interactiveWidget: "resizes-content" };

const DAY = 86_400_000;
const GROUPS = [
  { label: "آخر 24 ساعة", maxAge: DAY },
  { label: "آخر 7 أيام", maxAge: 7 * DAY },
  { label: "آخر 30 يوم", maxAge: 30 * DAY },
];

// القائمة يقرأها العمود الجانبي والشريط العلوي (عنوان المحادثة + قائمة الجوال): cache = استعلام واحد للطلب
const getChats = cache(async (): Promise<ChatSummary[]> => {
  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database
    .from("chats")
    .select("id, title, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50);
  // المجموعات بالعمر مو بالتاريخ: ما تعتمد على منطقة المستخدم الزمنية، فالخادم والمتصفح يتفقون
  const now = Date.now();
  return ((data ?? []) as { id: string; title: string | null; updated_at: string }[]).map((chat) => {
    const age = now - new Date(chat.updated_at).getTime();
    return { id: chat.id, title: chat.title, group: GROUPS.find((g) => age < g.maxAge)?.label ?? "أقدم" };
  });
});

/**
 * الشات بعرض المساحة كلها وطول الشاشة بالضبط، والتمرير داخل عمود الرسائل بس.
 * الارتفاع = الشاشة − (شريط الجوال 4rem) أو (هامش الغلاف 1rem + حدّه 2px).
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <div data-slot="chat-shell" className="flex h-[calc(100dvh-4rem)] md:h-[calc(100dvh-1rem-2px)]">
        <aside aria-label="المحادثات" className="hidden w-64 shrink-0 flex-col border-e border-hairline md:flex xl:w-72">
          <div className="flex h-14 shrink-0 items-center border-b border-hairline px-2">
            <Button asChild variant="ghost" className="h-9 w-full justify-start gap-2 px-3 font-semibold">
              {/* رابط عادي (مو تنقل داخلي): يحمّل الصفحة من جديد فتبدأ محادثة فاضية فعلًا */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/chat">
                <SquarePenIcon aria-hidden />
                محادثة جديدة
              </a>
            </Button>
          </div>
          <Suspense fallback={<ChatListSkeleton />}>
            <ChatList />
          </Suspense>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-1 border-b border-hairline px-2 sm:px-4">
            <Suspense fallback={<p className="px-2 text-sm font-medium">الشات</p>}>
              <TopBar />
            </Suspense>
          </header>
          <Suspense fallback={null}>
            <KeyNotice />
          </Suspense>
          {children}
        </div>
      </div>
    </TooltipProvider>
  );
}

async function ChatList() {
  return <ChatLinks chats={await getChats()} />;
}

async function TopBar() {
  return <ChatTopBar chats={await getChats()} />;
}

function ChatListSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3" aria-hidden>
      <Skeleton className="h-3 w-20" />
      {[78, 64, 86, 55, 70].map((w) => (
        <Skeleton key={w} className="h-8" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

/** تنبيه رفيع فوق الرسائل لو ناقص مفتاح: بدون مفتاح ذكاء الشات ما يرد، وبدون مفتاح بحث ما يلقى شركات. */
async function KeyNotice() {
  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database.from("provider_keys").select("provider, status").eq("user_id", user.id);
  const usable = ((data ?? []) as { provider: string; status: string }[]).filter((k) => k.status !== "invalid");
  const has = (list: readonly string[]) => usable.some((k) => list.includes(k.provider));
  const hasAi = has(AI_PROVIDERS);
  if (hasAi && has(SEARCH_PROVIDERS)) return null;

  return (
    <div role="status" className="flex shrink-0 items-center gap-3 border-b border-hairline bg-muted/40 px-4 py-2 text-sm">
      <KeyRoundIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <p className="min-w-0 flex-1 text-pretty text-muted-foreground">
        {hasAi
          ? "ما عندك مفتاح بحث (Exa أو Tavily)، فما أقدر أدوّر شركات جديدة."
          : "ما عندك مفتاح ذكاء اصطناعي، فالشات ما يقدر يرد."}
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href="/settings/keys">أضف مفتاح</Link>
      </Button>
    </div>
  );
}
