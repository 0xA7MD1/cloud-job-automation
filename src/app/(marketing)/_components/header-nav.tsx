"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { SECTION_LINKS } from "./nav";

/** القسم الي في منتصف الشاشة الحين (أو null فوق أول قسم) */
function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        setActive(ids.find((id) => visible.has(id)) ?? null);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

const IDS = SECTION_LINKS.map((l) => l.id);

export function HeaderNav() {
  const active = useActiveSection(IDS);
  return (
    <nav aria-label="أقسام الصفحة" className="absolute left-1/2 hidden -translate-x-1/2 lg:block">
      <ul className="flex items-center gap-1 rounded-full border border-hairline bg-(--glass) p-1">
        {SECTION_LINKS.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={active === id ? "location" : undefined}
              className={cn(
                "block rounded-full px-4 py-1.5 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                active === id && "bg-foreground/10 text-foreground",
              )}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
