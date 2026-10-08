import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { NavLinks, NavLinksView } from "./_components/nav-links";
import { UserMenu } from "./_components/user-menu";

// الغلاف ثابت (يتحمّل فورًا)، وجزء المستخدم يتدفّق داخل Suspense لأنه يقرأ الجلسة.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-4">
          <Link href="/dashboard" className="font-semibold">
            مساعد التقديم
          </Link>
          <Suspense fallback={<NavLinksView pathname={null} />}>
            <NavLinks />
          </Suspense>
          <div className="ms-auto">
            <Suspense fallback={<Skeleton className="h-7 w-32" />}>
              <UserMenu />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
