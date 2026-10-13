"use client";

import { useSyncExternalStore } from "react";

// كم بكسل سكرول قبل ما تطلع الحبّة الزجاجية
const GLASS_AFTER = 24;

const subscribe = (onChange: () => void) => {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
};

/** false في HTML الخادم (أعلى الصفحة)، وبعد الـhydration حسب السكرول الفعلي */
function useScrolled() {
  return useSyncExternalStore(subscribe, () => window.scrollY > GLASS_AFTER, () => false);
}

/**
 * الهيدر ظاهر دائمًا. أعلى الصفحة بدون خلفية (فوق الهيرو مباشرة)، ومع السكرول تطلع وراه
 * حبّة زجاجية عشان يتميّز عن المحتوى الي يمر تحته. الحبّة طبقة لحالها تتلاشى بالشفافية بس
 * (أرخص حركة)، والعناصر ما تتحرك.
 */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const scrolled = useScrolled();
  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center">
      <div
        data-scrolled={scrolled}
        className="group/header pointer-events-auto relative isolate flex h-16 w-[min(1200px,calc(100%-32px))] items-center gap-2 ps-6 pe-2.5"
      >
        <span
          aria-hidden
          className="absolute inset-0 -z-10 rounded-full border border-hairline bg-(image:--header-bg) opacity-0 shadow-(--header-shadow) backdrop-blur-xl transition-opacity duration-300 ease-out group-data-[scrolled=true]/header:opacity-100 motion-reduce:transition-none"
        >
          <span className="absolute inset-x-12 -top-px h-px bg-linear-to-r from-transparent via-foreground/30 to-transparent" />
        </span>
        {children}
      </div>
    </header>
  );
}
