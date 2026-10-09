import { cn } from "@/lib/utils";

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = "center",
}: {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "center" | "start";
}) {
  return (
    <div className={cn("flex flex-col gap-4", align === "center" ? "items-center text-center" : "items-start text-start")}>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span aria-hidden className="h-px w-6 bg-foreground/25" />
        {eyebrow}
      </p>
      <h2
        id={id}
        className="max-w-[20ch] bg-linear-to-b from-foreground to-foreground/60 bg-clip-text pb-[0.15em] text-3xl leading-[1.2] font-semibold text-balance text-transparent sm:text-5xl"
      >
        {title}
      </h2>
      {description && <p className="max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">{description}</p>}
    </div>
  );
}
