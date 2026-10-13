import { DotPattern } from "@/components/ui/dot-pattern";
import { cn } from "@/lib/utils";

/** «المسرح»: إطار مدوّر بخلفية أفتح شوي، شبكة نقاط تتلاشى لتحت، وتوهّج خفيف من فوق (على طريقة sndr.sh) */
export function Stage({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("relative isolate overflow-clip rounded-[28px] border border-hairline bg-stage", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem] bg-[radial-gradient(60%_70%_at_50%_0%,var(--stage-glow),transparent)]"
      />
      <DotPattern
        width={20}
        height={20}
        className="-z-10 text-foreground/15 [mask-image:radial-gradient(ellipse_80%_70%_at_50%_0%,black,transparent_75%)]"
      />
      {children}
    </div>
  );
}
