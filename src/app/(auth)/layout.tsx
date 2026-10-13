import Link from "next/link";
import { Logo } from "@/components/logo";
import { Stage } from "@/components/stage";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col p-2 sm:p-3">
      <Stage className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
        <ThemeToggle className="absolute top-4 end-4" />
        <Link
          href="/"
          className="rounded-lg text-xl outline-none focus-visible:ring-3 focus-visible:ring-foreground/55"
        >
          <Logo />
        </Link>
        <div className="w-full max-w-sm [&_[data-slot=card]]:bg-card/70 [&_[data-slot=card]]:shadow-(--card-shadow) [&_[data-slot=card]]:backdrop-blur-xl">
          {children}
        </div>
      </Stage>
    </main>
  );
}
