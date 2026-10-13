import Link from "next/link";
import { cacheLife } from "next/cache";
import { Logo } from "@/components/logo";
import { SECTION_LINKS } from "./nav";

// new Date() داخل صفحة ثابتة لازم يكون في كاش (cacheComponents)
async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

const linkClass =
  "rounded-sm text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-foreground/55";

export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-hairline">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-14 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div data-reveal className="flex flex-col gap-3">
          <Logo className="text-lg" />
          <p className="max-w-xs text-sm text-muted-foreground">يبحث عن الشركات ووظائفها الرسمية، ويقدّم عنك بعد موافقتك.</p>
        </div>
        <nav data-reveal aria-label="أقسام الصفحة" className="flex flex-col gap-3">
          <p className="text-sm font-medium">الصفحة</p>
          {SECTION_LINKS.map(({ id, label }) => (
            <a key={id} href={`#${id}`} className={`${linkClass} w-fit`}>
              {label}
            </a>
          ))}
        </nav>
        <nav data-reveal aria-label="الحساب" className="flex flex-col gap-3">
          <p className="text-sm font-medium">الحساب</p>
          <Link href="/sign-in" className={`${linkClass} w-fit`}>
            عندي حساب
          </Link>
          <Link href="/sign-up" className={`${linkClass} w-fit`}>
            ابدأ مجانًا
          </Link>
        </nav>
      </div>
      <div data-reveal className="mx-auto max-w-6xl border-t border-hairline px-4 py-6 text-xs text-muted-foreground">
        © <CurrentYear /> مساعد التقديم
      </div>
    </footer>
  );
}
