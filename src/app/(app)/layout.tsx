import Link from "next/link";
import { Suspense } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileBar } from "./_components/mobile-bar";
import { NavLinks, NavLinksView } from "./_components/nav-links";
import { UserMenu } from "./_components/user-menu";

// الغلاف ثابت (يتحمّل فورًا)، وجزء المستخدم يتدفّق داخل Suspense لأنه يقرأ الجلسة.
// الشريط الجانبي على جهة البداية (يمين)، وعلى الجوال يصير sheet.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar side="right" dir="rtl" variant="inset">
        <SidebarHeader className="px-4 pt-4">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/dashboard"
              className="rounded-md text-base font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              مساعد التقديم
            </Link>
            <ThemeToggle className="hidden md:inline-flex" />
          </div>
        </SidebarHeader>
        <SidebarContent className="px-2">
          <Suspense fallback={<NavLinksView pathname={null} />}>
            <NavLinks />
          </Suspense>
        </SidebarContent>
        <SidebarFooter className="p-3">
          <Suspense fallback={<Skeleton className="h-12 rounded-xl" />}>
            <UserMenu />
          </Suspense>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-w-0 md:border md:border-hairline md:peer-data-[variant=inset]:shadow-none">
        <MobileBar />
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
