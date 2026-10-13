import { Marquee } from "@/components/ui/marquee";

// تكاملات موجودة فعلًا في الكود (محوّلات التقديم، مزودو الذكاء والبحث، المتصفح السحابي)
const INTEGRATIONS = [
  { name: "Greenhouse", kind: "تقديم" },
  { name: "Lever", kind: "تقديم" },
  { name: "Ashby", kind: "تقديم" },
  { name: "Groq", kind: "ذكاء" },
  { name: "OpenRouter", kind: "ذكاء" },
  { name: "OpenAI", kind: "ذكاء" },
  { name: "Anthropic", kind: "ذكاء" },
  { name: "Google", kind: "ذكاء" },
  { name: "Exa", kind: "بحث" },
  { name: "Tavily", kind: "بحث" },
  { name: "Steel", kind: "متصفح" },
];

export function WorksWith() {
  return (
    <section aria-labelledby="works-with-title" data-pause-offscreen className="py-14 sm:py-20">
      <h2 id="works-with-title" data-reveal className="text-center font-sans text-sm text-muted-foreground">
        يشتغل مع
      </h2>
      <p className="sr-only">{INTEGRATIONS.map((i) => i.name).join("، ")}</p>
      {/* الشريط LTR: حركة marquee مبنية على translateX لليسار */}
      <div
        aria-hidden
        data-reveal
        dir="ltr"
        className="mx-auto mt-6 max-w-6xl [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
      >
        <Marquee pauseOnHover className="[--duration:50s] [--gap:3.5rem]">
          {INTEGRATIONS.map(({ name, kind }) => (
            <div key={name} className="flex items-baseline gap-2 py-2 text-foreground/70 transition-colors hover:text-foreground">
              <span className="text-xl font-semibold">{name}</span>
              <span dir="rtl" className="text-xs text-muted-foreground">
                {kind}
              </span>
            </div>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
