import { BriefcaseBusinessIcon, BuildingIcon, FileTextIcon, PaperclipIcon, SearchIcon, SendIcon, SparklesIcon } from "lucide-react";
import { APP_NAV } from "@/components/app-nav";
import { Badge } from "@/components/ui/badge";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button, CtaIcon } from "@/components/ui/button";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { STATUS_LABELS } from "@/lib/apply/labels";
import { cn } from "@/lib/utils";
import { BrowserFrame } from "./browser-frame";

// واجهة وهمية من مكوّناتنا ونصوصنا الحقيقية: سؤال في الشات ← شركات ← وظيفة رسمية ← طلب جاهز.
// الشركات والأشخاص خياليين (نفس أسماء بيانات التجربة).

const COMPANIES = [
  { name: "Nakhla Pay", domain: "nakhlapay.example", ats: "Greenhouse" },
  { name: "Sahm Analytics", domain: "sahm.example", ats: "Lever" },
  { name: "Wadi Cloud", domain: "wadicloud.example", ats: "Greenhouse" },
];

function Line({ icon: Icon, children }: { icon: typeof SearchIcon; children: React.ReactNode }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Icon className="size-3.5" aria-hidden />
      {children}
    </p>
  );
}

function AppMock() {
  return (
    <div className="flex h-[640px] text-start">
      <aside className="hidden w-52 shrink-0 flex-col gap-5 border-e border-hairline bg-sidebar/60 p-3 md:flex">
        <p className="px-2 pt-1 text-sm font-semibold">مساعد التقديم</p>
        {APP_NAV.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <p className="px-2 pb-1 text-[11px] text-muted-foreground">{group.label}</p>
            {group.items.map(({ href, label, icon: Icon }) => (
              <span
                key={href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground",
                  href === "/chat" && "bg-foreground/10 font-medium text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </span>
            ))}
          </div>
        ))}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-5 p-4 sm:p-6">
        <p className="max-w-[85%] self-start rounded-2xl bg-muted px-4 py-2 text-sm">
          دوّر لي شركات تقنية مالية في الرياض، وأبي وظائف <span dir="ltr">Backend</span>
        </p>

        <div className="flex flex-col gap-2">
          <Line icon={SearchIcon}>3 شركات · المصدر Tavily · انحفظ البحث</Line>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {COMPANIES.map((c, i) => (
              <li
                key={c.name}
                className={cn("flex-col gap-2 rounded-xl border border-hairline bg-card/50 p-3", i === 0 ? "flex" : "hidden sm:flex")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <BuildingIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate text-sm font-medium">{c.name}</span>
                  </span>
                  <Badge variant="secondary">{c.ats}</Badge>
                </div>
                <span dir="ltr" className="text-end text-xs text-muted-foreground">
                  {c.domain}
                </span>
                <Button variant="outline" size="sm" className="self-start" tabIndex={-1}>
                  وظائفهم الرسمية
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <Line icon={BriefcaseBusinessIcon}>Nakhla Pay · 2 مطابقة من 9 مفتوحة · لوحة greenhouse الرسمية</Line>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-hairline p-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-sm font-medium">
                <span dir="ltr">Senior Backend Engineer (Node.js)</span>
              </p>
              <p className="text-xs text-muted-foreground">
                <span dir="ltr">Riyadh, Saudi Arabia</span> · هجين · <span dir="ltr">Engineering</span>
              </p>
            </div>
            <Button size="sm" tabIndex={-1}>
              <SendIcon data-icon="inline-start" aria-hidden />
              جهّز الطلب
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-card/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm font-medium">
                <span dir="ltr">Senior Backend Engineer (Node.js)</span>
              </p>
              <p className="text-xs text-muted-foreground">Nakhla Pay · الرياض</p>
            </div>
            <Badge>{STATUS_LABELS.ready}</Badge>
          </div>
          <ul className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
            <li className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
              <SparklesIcon className="size-3.5 text-muted-foreground" aria-hidden />
              إجابات النموذج 14 من 14
            </li>
            <li className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
              <FileTextIcon className="size-3.5 text-muted-foreground" aria-hidden />
              خطاب التقديم · PDF و Word
            </li>
            <li className="hidden items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 sm:flex">
              <PaperclipIcon className="size-3.5 text-muted-foreground" aria-hidden />
              <span dir="ltr">cv-faisal.pdf</span>
            </li>
          </ul>
          <Button variant="cta" size="sm" className="self-start" tabIndex={-1}>
            افتح الطلب وراجعه
            <CtaIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** معاينة المنتج تحت الهيرو: تنقص من تحت داخل المسرح وتنطمس تدريجيًا */
export function ProductPreview({ className }: { className?: string }) {
  return (
    <div aria-hidden inert className={cn("relative w-full max-w-5xl select-none", className)}>
      <div className="relative h-[500px] overflow-hidden sm:h-[540px]">
        <BrowserFrame url="/chat" className="rounded-b-none">
          <AppMock />
          <BorderBeam
            size={140}
            duration={10}
            colorFrom="var(--foreground)"
            colorTo="transparent"
            className="motion-reduce:hidden"
          />
        </BrowserFrame>
        <ProgressiveBlur position="bottom" height="30%" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-stage to-transparent" />
      </div>
    </div>
  );
}
