"use client";

import { useTheme } from "next-themes";
import { buttonVariants } from "@/components/ui/button";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <AnimatedThemeToggler
      theme={resolvedTheme === "light" ? "light" : "dark"}
      onThemeChange={setTheme}
      className={cn(buttonVariants({ variant: "glass", size: "icon-pill" }), className)}
    />
  );
}
