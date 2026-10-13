import Link from "next/link";
import { LogInIcon } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, CtaIcon } from "@/components/ui/button";
import { HeaderNav } from "./header-nav";
import { HeaderShell } from "./header-shell";
import { MobileMenu } from "./mobile-menu";

/** هيدر عائم: شفاف فوق الهيرو، وحبّة زجاجية (على طريقة bandar.solutions) مع السكرول */
export function SiteHeader() {
  return (
    <HeaderShell>
      <Link
        href="/"
        className="shrink-0 rounded-lg text-lg outline-none focus-visible:ring-3 focus-visible:ring-foreground/55"
      >
        <Logo />
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
    </HeaderShell>
  );
}
