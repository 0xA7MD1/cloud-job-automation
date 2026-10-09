import {
  BadgeCheckIcon,
  BriefcaseBusinessIcon,
  CameraIcon,
  FileTextIcon,
  HistoryIcon,
  KeyRoundIcon,
  MonitorPlayIcon,
  type LucideIcon,
} from "lucide-react";
import { BlurFade } from "@/components/ui/blur-fade";
import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";

function Card({
  icon: Icon,
  title,
  body,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group relative flex h-full flex-col gap-6 overflow-hidden rounded-2xl border border-hairline bg-card/50 p-6 transition-colors duration-300 hover:bg-card/80",
        className,
      )}
    >
      <ShineBorder
        shineColor={["var(--foreground)", "transparent"]}
        className="opacity-0 transition-opacity duration-500 group-hover:opacity-60"
      />
      <span className="grid size-10 place-items-center rounded-xl border border-hairline bg-(--glass) shadow-(--card-shadow)">
        <Icon className="size-5" aria-hidden />
      </span>
      {children && <div aria-hidden className="flex-1">{children}</div>}
      <div className="mt-auto flex flex-col gap-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-hairline bg-background/60 px-2.5 py-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
      <BlurFade inView direction="up">
        <SectionHeading
          id="features-title"
          eyebrow="المميزات"
          title="كل شي يحتاجه الطلب، في مكان واحد"
          description="من أول بحث لين صفحة التأكيد، وكل خطوة لها أثر تقدر ترجع له."
        />
      </BlurFade>

      <ul className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <li className="md:col-span-2">
          <BlurFade inView direction="up" delay={0.05} className="h-full">
            <Card
              icon={BriefcaseBusinessIcon}
              title="الوظائف الرسمية بس"
              body="يقرأ لوحات التوظيف الرسمية للشركات وصفحات careers، مو إعلانات منسوخة من مواقع ثانية."
            >
              <div className="flex flex-col gap-2">
                {[
                  ["Senior Backend Engineer", "Nakhla Pay", "Greenhouse"],
                  ["Data Engineer", "Sahm Analytics", "Lever"],
                  ["Product Designer", "Rihla", "Ashby"],
                ].map(([title, company, board]) => (
                  <div
                    key={title}
                    className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-background/60 px-3 py-2"
                  >
                    <span className="min-w-0 truncate text-sm">
                      <span dir="ltr">{title}</span>
                      <span className="text-muted-foreground"> · {company}</span>
                    </span>
                    <Chip className="shrink-0">لوحة {board} الرسمية</Chip>
                  </div>
                ))}
              </div>
            </Card>
          </BlurFade>
        </li>

        <li>
          <BlurFade inView direction="up" delay={0.1} className="h-full">
            <Card
              icon={KeyRoundIcon}
              title="مفتاحك، ومزودك"
              body="تختار مزود الذكاء وتضيف مفتاحك أنت. ينحفظ مشفّر، وما تشوف منه إلا آخر 4 أحرف."
            >
              <div className="flex flex-wrap gap-1.5">
                {["Groq", "OpenRouter", "OpenAI", "Anthropic", "Google"].map((p) => (
                  <Chip key={p}>{p}</Chip>
                ))}
                <Chip className="font-mono">
                  <span dir="ltr">••••••••a9F2</span>
                </Chip>
              </div>
            </Card>
          </BlurFade>
        </li>

        <li>
          <BlurFade inView direction="up" delay={0.05} className="h-full">
            <Card
              icon={FileTextIcon}
              title="سيرة وخطاب تقديم"
              body="يستخدم سيرتك، ويكتب خطاب تقديم لكل وظيفة. تعدّله وتنزّله PDF أو Word."
            >
              <div className="flex flex-wrap gap-1.5">
                <Chip>
                  <FileTextIcon className="size-3" /> PDF
                </Chip>
                <Chip>
                  <FileTextIcon className="size-3" /> Word
                </Chip>
              </div>
            </Card>
          </BlurFade>
        </li>

        <li>
          <BlurFade inView direction="up" delay={0.1} className="h-full">
            <Card
              icon={HistoryIcon}
              title="ذاكرة للبحث"
              body="كل نتيجة تنحفظ بمصدرها وتاريخها، والشات يرجع لها بدل ما يعيد اختراعها."
            />
          </BlurFade>
        </li>

        <li>
          <BlurFade inView direction="up" delay={0.15} className="h-full">
            <Card
              icon={MonitorPlayIcon}
              title="بث حي، والتحكم بيدك"
              body="تشوف المتصفح وهو يقدّم، وتكمّل بنفسك لو احتاج كود أو كابتشا. وبعدها يكمّل هو."
            />
          </BlurFade>
        </li>

        <li className="md:col-span-2 lg:col-span-3">
          <BlurFade inView direction="up" delay={0.05} className="h-full">
            <Card
              icon={BadgeCheckIcon}
              title="النجاح = دليل محفوظ"
              body="ضغطة «إرسال» مو نجاح. الطلب ما ينحسب انرسل إلا بدليل: صفحة التأكيد أو رقم الطلب، ينحفظ في ملفاتك."
            >
              <div className="flex flex-wrap gap-1.5">
                <Chip>
                  <CameraIcon className="size-3" /> لقطة صفحة التأكيد
                </Chip>
                <Chip>
                  رقم الطلب <span dir="ltr">NP-20481</span>
                </Chip>
              </div>
            </Card>
          </BlurFade>
        </li>
      </ul>
    </section>
  );
}
