"use client";

import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

/** شريط الجوال: الاسم + المظهر + زر القائمة (يفتح الشريط الجانبي كـsheet) */
export function MobileBar() {
  const { toggleSidebar } = useSidebar();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-hairline bg-background/80 px-4 backdrop-blur-xl md:hidden">
      <Link href="/dashboard">
        <Logo />
      </Link>
      <div className="ms-auto flex items-center gap-2">
        <ThemeToggle />
        <Button variant="glass" size="icon-pill" onClick={toggleSidebar} aria-label="القائمة">
          <MenuIcon aria-hidden />
        </Button>
      </div>
    </header>
  );
}
