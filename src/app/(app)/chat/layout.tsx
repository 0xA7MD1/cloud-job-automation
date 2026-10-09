import { Suspense } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { ChatLinks } from "./_components/chat-links";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="hidden flex-col gap-3 md:flex">
        <Button asChild variant="glass" className="justify-start">
          {/* رابط عادي (مو تنقل داخلي): يحمّل الصفحة من جديد فتبدأ محادثة فاضية فعلًا */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/chat">
            <PlusIcon data-icon="inline-start" aria-hidden />
            محادثة جديدة
          </a>
        </Button>
        <Suspense fallback={<Skeleton className="h-40" />}>
          <ChatList />
        </Suspense>
      </aside>
      <div className="min-w-0">
        <div className="mb-4 md:hidden">
          <Button asChild variant="glass" size="sm">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/chat">
              <PlusIcon data-icon="inline-start" aria-hidden />
              محادثة جديدة
            </a>
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

async function ChatList() {
  const user = await requireUser();
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database
    .from("chats")
    .select("id, title")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(30);
  return <ChatLinks chats={(data ?? []) as { id: string; title: string | null }[]} />;
}
