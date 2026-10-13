import Link from "next/link";
import { LogInIcon } from "lucide-react";
import { Stage } from "@/components/stage";
import { Button, CtaIcon } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="px-2 py-12 sm:px-3 sm:py-20">
      <div data-reveal>
        <Stage className="mx-auto max-w-[1200px]">
          <div className="flex flex-col items-center gap-6 px-6 py-20 text-center sm:py-28">
            <h2
              id="cta-title"
              data-reveal
              className="max-w-[18ch] bg-linear-to-b from-foreground to-foreground/55 bg-clip-text pb-[0.15em] text-3xl leading-[1.3] font-bold text-balance text-transparent sm:text-5xl lg:text-6xl"
            >
              خلّه يدوّر عنك، وأنت توافق بس
            </h2>
            <p data-reveal className="max-w-lg text-base text-pretty text-muted-foreground sm:text-lg">
              جهّز حسابك بدقايق، واسأله عن أول شركة تبيها.
            </p>
            <div data-reveal className="flex flex-wrap items-center justify-center gap-3">
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
          </div>
        </Stage>
      </div>
    </section>
  );
}
