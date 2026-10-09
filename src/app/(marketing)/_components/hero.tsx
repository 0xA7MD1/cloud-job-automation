import Link from "next/link";
import { ArrowLeftIcon, LogInIcon } from "lucide-react";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { Stage } from "@/components/stage";
import { Button, CtaIcon } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProductPreview } from "./product-preview";

// دخول الهيرو بـCSS (بدون JS) ⇒ يظهر من أول رسم حتى قبل التحميل الكامل
const enter =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:fill-mode-both";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="px-2 pt-2 sm:px-3 sm:pt-3">
      <Stage>
        <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-32 text-center sm:pt-40">
          <a
            href="#watch"
            className={cn(
              "group inline-flex items-center gap-2 rounded-full border border-hairline bg-(--glass) py-1 ps-3 pe-2.5 text-xs shadow-(--card-shadow) outline-none transition-colors hover:border-(--border-strong) focus-visible:ring-3 focus-visible:ring-foreground/55 sm:text-sm",
              enter,
            )}
          >
            <span aria-hidden className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-foreground/50 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-foreground" />
            </span>
            <AnimatedShinyText className="mx-0 text-foreground/65 dark:text-foreground/65">
              شوفه وهو يقدّم، خطوة بخطوة
            </AnimatedShinyText>
            <ArrowLeftIcon
              aria-hidden
              className="size-3.5 text-muted-foreground transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none"
            />
          </a>

          <h1
            id="hero-title"
            className={cn(
              "mt-6 max-w-[16ch] bg-linear-to-b from-foreground to-foreground/55 bg-clip-text pb-[0.15em] text-4xl leading-[1.2] font-semibold text-balance text-transparent sm:text-6xl lg:text-7xl",
              enter,
              "motion-safe:delay-75",
            )}
          >
            مساعد يبحث ويقدّم على الوظائف عنك
          </h1>

          <p
            className={cn(
              "mt-4 max-w-xl text-base text-balance text-muted-foreground sm:text-lg",
              enter,
              "motion-safe:delay-150",
            )}
          >
            تضيف مفاتيحك، ترفع سيرتك، وتقول له وش تدوّر. هو يجهّز الطلب، وأنت توافق قبل أي إرسال.
          </p>

          <div className={cn("mt-8 flex flex-wrap items-center justify-center gap-3", enter, "motion-safe:delay-200")}>
            <Button asChild variant="cta" size="lg">
              <Link href="/sign-up">
                ابدأ مجانًا
                <CtaIcon />
              </Link>
            </Button>
            <Button asChild variant="glass" size="lg">
              <Link href="/sign-in">
                <LogInIcon data-icon="inline-start" aria-hidden />
                عندي حساب
              </Link>
            </Button>
          </div>

          <ProductPreview className={cn("mt-14 sm:mt-20", enter, "motion-safe:delay-300 motion-safe:duration-1000")} />
        </div>
      </Stage>
    </section>
  );
}
