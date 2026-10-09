import Link from "next/link";
import { LogInIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, CtaIcon } from "@/components/ui/button";
import { HeaderNav } from "./header-nav";
import { MobileMenu } from "./mobile-menu";

/** هيدر عائم بشكل حبّة زجاجية (على طريقة bandar.solutions) */
export function SiteHeader() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center">
      <div className="pointer-events-auto relative flex h-16 w-[min(1200px,calc(100%-32px))] items-center gap-2 rounded-full border border-hairline bg-(image:--header-bg) ps-5 pe-3 shadow-(--header-shadow) backdrop-blur-xl">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-12 -top-px h-px bg-linear-to-r from-transparent via-foreground/30 to-transparent"
        />
        <Link
          href="/"
          className="shrink-0 rounded-full text-base font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          مساعد التقديم
        </Link>
        <HeaderNav />
        <div className="ms-auto flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Button asChild variant="glass" className="hidden sm:inline-flex">
            <Link href="/sign-in">
              <LogInIcon data-icon="inline-start" aria-hidden />
              عندي حساب
            </Link>
          </Button>
          <Button asChild variant="cta">
            <Link href="/sign-up">
              ابدأ مجانًا
              <CtaIcon />
            </Link>
          </Button>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
