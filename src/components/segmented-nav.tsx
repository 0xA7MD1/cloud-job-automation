import Link from "next/link";
import { cn } from "@/lib/utils";

/** تبويبات بشكل حبّة (روابط، فالحالة في الرابط) */
export function SegmentedNav({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: React.ReactNode; active: boolean }[];
}) {
  return (
    <nav
      aria-label={label}
      className="flex gap-1 overflow-x-auto rounded-full border border-hairline bg-(--glass) p-1 text-sm shadow-(--card-shadow)"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "flex-1 shrink-0 rounded-full px-4 py-1.5 text-center whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            item.active && "bg-foreground/10 font-medium text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
