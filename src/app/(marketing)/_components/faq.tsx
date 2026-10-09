import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BlurFade } from "@/components/ui/blur-fade";
import { SectionHeading } from "./section-heading";

// الأجوبة من AGENTS.md بس. التسعير: «ابدأ مجانًا» من الصفحة القديمة، وتكلفة المزودين على حساب المستخدم.
const FAQ = [
  {
    q: "وش أحتاج عشان أبدأ؟",
    a: "حساب، وسيرتك الذاتية، ومفتاح مزود ذكاء اصطناعي، ومفتاح بحث (Exa أو Tavily). Groq وTavily عندهم خطط مجانية. وللتقديم من المتصفح السحابي تحتاج مفتاح Steel.",
  },
  {
    q: "هل يرسل طلب بدون علمي؟",
    a: "لا. يجهّز الإجابات وخطاب التقديم وتراجعها أنت، والإرسال ما يبدأ إلا لما تضغط تأكيد من صفحة الطلب. وما يعيد المحاولة من نفسه.",
  },
  {
    q: "كم يكلّف؟",
    a: "البداية مجانية. استهلاك المزودين (الذكاء، البحث، المتصفح السحابي) ينحسب على حسابك عندهم لأنه بمفاتيحك أنت.",
  },
  {
    q: "وش يصير لو طلعت كابتشا أو كود بالبريد؟",
    a: "لو فعّلت حل الكابتشا في حسابك عند Steel يحاول يحلها. وإذا ما انحلت، أو طلب الموقع كود، يوقف ويعرض لك البث الحي تكمّل منه، وبعدها يكمّل هو.",
  },
  {
    q: "على أي مواقع يقدّم؟",
    a: "يجيب الوظائف من الصفحات الرسمية للشركات، ويعبّي نماذج التقديم في Greenhouse وLever وAshby.",
  },
  {
    q: "وين تروح بياناتي؟",
    a: "ملفاتك في تخزين خاص وتنزّلها بروابط مؤقتة. مفاتيحك تنشفّر قبل الحفظ وما تشوف منها الواجهة إلا آخر 4 أحرف. وكل جدول فيه بياناتك محمي بحيث ما يقرأه غيرك.",
  },
];

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="mx-auto max-w-3xl px-4 py-20 sm:py-28">
      <BlurFade inView direction="up">
        <SectionHeading id="faq-title" eyebrow="الأسئلة" title="أسئلة تتكرر" />
      </BlurFade>
      <BlurFade inView direction="up" delay={0.1} className="mt-12">
        <Accordion type="single" collapsible className="rounded-2xl border border-hairline bg-card/40 px-6">
          {FAQ.map(({ q, a }, i) => (
            <AccordionItem key={q} value={`q${i}`} className="border-hairline">
              <AccordionTrigger className="py-5 text-base">{q}</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </BlurFade>
    </section>
  );
}
