import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";

// صفحات التسويق ثابتة بالكامل: ما تقرأ الجلسة
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only z-[60] rounded-full bg-background px-4 py-2 text-sm focus:not-sr-only focus:fixed focus:top-24 focus:start-4"
      >
        تخطَّ إلى المحتوى
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
