import Link from "next/link";
import { cacheLife } from "next/cache";
import { SECTION_LINKS } from "./nav";

// new Date() داخل صفحة ثابتة لازم يكون في كاش (cacheComponents)
async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

const linkClass =
  "rounded-sm text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-hairline">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-14 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <p className="text-lg font-semibold">مساعد التقديم</p>
          <p className="max-w-xs text-sm text-muted-foreground">يبحث عن الشركات ووظائفها الرسمية، ويقدّم عنك بعد موافقتك.</p>
        </div>
        <nav aria-label="أقسام الصفحة" className="flex flex-col gap-3">
          <p className="text-sm font-medium">الصفحة</p>
          {SECTION_LINKS.map(({ id, label }) => (
            <a key={id} href={`#${id}`} className={`${linkClass} w-fit`}>
              {label}
            </a>
          ))}
        </nav>
        <nav aria-label="الحساب" className="flex flex-col gap-3">
          <p className="text-sm font-medium">الحساب</p>
          <Link href="/sign-in" className={`${linkClass} w-fit`}>
            عندي حساب
          </Link>
          <Link href="/sign-up" className={`${linkClass} w-fit`}>
            ابدأ مجانًا
          </Link>
        </nav>
      </div>
      <div className="mx-auto max-w-6xl border-t border-hairline px-4 py-6 text-xs text-muted-foreground">
        © <CurrentYear /> مساعد التقديم
      </div>
    </footer>
  );
}
