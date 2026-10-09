"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "الرئيسية" },
  { href: "/chat", label: "الشات" },
  { href: "/jobs", label: "الوظائف" },
  { href: "/applications", label: "الطلبات" },
  { href: "/files", label: "ملفاتي" },
  { href: "/profile", label: "ملفي" },
  { href: "/settings/keys", label: "المفاتيح" },
] as const;

/** الروابط بدون تمييز الصفحة الحالية: تظهر في الغلاف الثابت لين يوصل المسار. */
export function NavLinksView({ pathname }: { pathname: string | null }) {
  return (
    <nav className="-mx-1 flex items-center gap-1 overflow-x-auto text-sm">
      {LINKS.map(({ href, label }) => {
        const active = !!pathname && (pathname === href || pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:text-foreground",
              active && "bg-muted font-medium text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** usePathname قيمة وقت الطلب في المسارات الديناميكية ⇒ داخل <Suspense> في الغلاف. */
export function NavLinks() {
  return <NavLinksView pathname={usePathname()} />;
}
