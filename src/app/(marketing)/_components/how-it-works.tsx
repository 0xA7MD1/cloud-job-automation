import { CheckCheckIcon, KeyRoundIcon, MessageSquareTextIcon } from "lucide-react";
import { BlurFade } from "@/components/ui/blur-fade";
import { SectionHeading } from "./section-heading";

const STEPS = [
  {
    icon: KeyRoundIcon,
    title: "جهّز حسابك",
    body: "أضف مفتاح مزود الذكاء الي تبيه، وارفع سيرتك الذاتية. مرة وحدة بس.",
  },
  {
    icon: MessageSquareTextIcon,
    title: "اسأل في الشات",
    body: "قل له وش تدوّر. يرجع لك شركات وصفحات وظائفها الرسمية، وكل نتيجة تنحفظ بمصدرها وتاريخها.",
  },
  {
    icon: CheckCheckIcon,
    title: "راجع ووافق",
    body: "يجهّز إجابات النموذج وخطاب التقديم (PDF وWord). توافق أنت، وهو يقدّم ويحفظ الدليل.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
      <BlurFade inView direction="up">
        <SectionHeading id="how-title" eyebrow="كيف يشتغل" title="ثلاث خطوات من البحث للتقديم" />
      </BlurFade>
      <ol className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li key={title}>
            <BlurFade inView direction="up" delay={0.08 * (i + 1)} className="h-full">
              <div className="relative flex h-full flex-col gap-5 rounded-2xl border border-hairline bg-card/50 p-6">
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-full border border-hairline bg-(--glass) shadow-(--card-shadow)">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-mono text-sm text-muted-foreground tabular-nums">0{i + 1}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </div>
            </BlurFade>
          </li>
        ))}
      </ol>
    </section>
  );
}
