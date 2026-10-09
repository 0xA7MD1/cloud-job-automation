"use client";

import Link from "next/link";
import { LogInIcon, MenuIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, CtaIcon } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SECTION_LINKS } from "./nav";

export function MobileMenu() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="glass" size="icon-pill" className="lg:hidden" aria-label="القائمة">
          <MenuIcon aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(20rem,85vw)] gap-0 border-hairline bg-background/95 backdrop-blur-xl">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>مساعد التقديم</SheetTitle>
          <SheetDescription>يبحث ويقدّم على الوظائف عنك.</SheetDescription>
        </SheetHeader>
        <nav aria-label="أقسام الصفحة" className="px-3 py-2">
          <ul className="flex flex-col">
            {SECTION_LINKS.map(({ id, label }) => (
              <li key={id}>
                <SheetClose asChild>
                  <a
                    href={`#${id}`}
                    className="block rounded-xl px-3 py-3 text-base outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {label}
                  </a>
                </SheetClose>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-auto flex flex-col gap-3 border-t border-hairline p-6">
          <Button asChild variant="cta" size="lg">
            <Link href="/sign-up">
              ابدأ مجانًا
              <CtaIcon />
            </Link>
          </Button>
          <Button asChild variant="glass" size="lg">
            <Link href="/sign-in">
              <LogInIcon data-icon="inline-start" aria-hidden />
              عندي حساب
            </Link>
          </Button>
          <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
            المظهر
            <ThemeToggle />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
