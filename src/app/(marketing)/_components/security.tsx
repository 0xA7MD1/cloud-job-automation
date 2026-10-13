import { EyeOffIcon, HandIcon, LockKeyholeIcon, MonitorPlayIcon, RotateCcwIcon, type LucideIcon } from "lucide-react";
import { SectionHeading } from "./section-heading";

// كل بند هنا قاعدة مطبّقة في الكود (AGENTS.md: تصميم التقديم + الأسرار)
const ITEMS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: HandIcon,
    title: "ما ينرسل شي بدون تأكيدك",
    body: "النموذج ما عنده أداة إرسال أصلًا. الإرسال يبدأ بس لما تضغط أنت تأكيد من صفحة الطلب.",
  },
  {
    icon: RotateCcwIcon,
    title: "ما يعيد الإرسال من نفسه",
    body: "لو انقطع شي بعد الضغط، يتحقق من الدليل بدل ما يرسل الطلب مرة ثانية.",
  },
  {
    icon: LockKeyholeIcon,
    title: "مفاتيحك مشفّرة",
    body: "تنشفّر بـAES-256-GCM قبل الحفظ، وما توصل للنموذج ولا تنكتب في السجلات.",
  },
  {
    icon: MonitorPlayIcon,
    title: "البث الحي لك وحدك",
    body: "رابط المتصفح المباشر يوصل لصاحب الطلب بس، وما ينحفظ في أي مكان.",
  },
  {
    icon: EyeOffIcon,
    title: "ملفاتك خاصة",
    body: "سيرتك وملفاتك في تخزين خاص، وتنزّلها بروابط مؤقتة تنتهي.",
  },
];

export function Security() {
  return (
    <section id="security" aria-labelledby="security-title" className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
        <div className="self-start">
          <SectionHeading
            id="security-title"
            align="start"
            eyebrow="الأمان"
            title="أنت المتحكّم"
            description="يقدّم عنك، بس ما يتصرف من وراك. هذي قواعد ثابتة في النظام، مو إعدادات تنسى تفعّلها."
          />
        </div>
        <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-2">
          {ITEMS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className={i === ITEMS.length - 1 ? "sm:col-span-2" : undefined}>
              <div data-reveal className="flex h-full flex-col gap-3 bg-background p-6">
                <Icon className="size-5 text-muted-foreground" aria-hidden />
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
