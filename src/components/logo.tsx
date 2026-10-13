import { cn } from "@/lib/utils";

// الشعار: حرف «ت» (تقديم) بنقطتين معيّنتين على طريقة الخط العربي، ويُقرأ كمان وجه مبتسم (مساعد).
// المربّع بنفس سطح زر cta (أسود بلمعة في الفاتح، أبيض في الداكن) ⇒ يتبع الثيم بدون ألوان خاصة.
// نفس الرسم في src/app/icon.svg وsrc/app/apple-icon.png: لو عدّلته هنا عدّلهم معه.
const GLYPH = (
  <>
    <path d="M6.5 13C6.5 19.8 10.2 22 16 22S25.5 19.8 25.5 13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <path d="M13.3 8.3l2.2 2.2-2.2 2.2-2.2-2.2zM18.7 8.3l2.2 2.2-2.2 2.2-2.2-2.2z" fill="currentColor" />
  </>
);

/** المربّع وحده. حجمه بالـem افتراضيًا ⇒ يكبر ويصغر مع حجم الخط حوله */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-[1.6em] shrink-0 place-items-center rounded-[28%] bg-(image:--cta-bg) text-(--cta-fg) shadow-[inset_0_0_0_1px_var(--cta-border),inset_0_1px_rgb(255_255_255/0.35)]",
        className
      )}
    >
      <svg viewBox="0 0 32 32" className="size-full">
        {GLYPH}
      </svg>
    </span>
  );
}

/** المربّع + الاسم. حجم الخط من className يحدد حجم الاثنين */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-[0.45em] font-semibold", className)}>
      <LogoMark />
      مساعد التقديم
    </span>
  );
}
