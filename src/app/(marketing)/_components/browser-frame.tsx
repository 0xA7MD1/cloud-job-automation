import { LockIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * إطار متصفح بأسلوب Magic UI «safari»، لكنه مرن (ارتفاعه من محتواه) عشان يحمل واجهة JSX
 * تنقرأ على الجوال. safari الأصلي SVG بنسبة ثابتة يقبل صورة أو فيديو بس.
 */
export function BrowserFrame({
  url,
  className,
  children,
}: {
  url: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-hairline bg-background shadow-[0_30px_80px_-20px_rgb(0_0_0/0.45)]",
        className,
      )}
    >
      <div dir="ltr" className="flex h-10 items-center gap-3 border-b border-hairline bg-muted/40 px-4">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
        </div>
        <div className="mx-auto flex h-6 w-full max-w-60 items-center justify-center gap-1.5 rounded-md bg-foreground/5 px-3 text-[11px] text-muted-foreground">
          <LockIcon className="size-3" />
          <span className="truncate">{url}</span>
        </div>
        <div className="w-10" />
      </div>
      {children}
    </div>
  );
}
