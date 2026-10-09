import type { LucideIcon } from "lucide-react";

/** حالة فاضية: أيقونة + سطر + إجراء */
export function EmptyState({
  icon: Icon,
  children,
  action,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-hairline bg-card/30 px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl border border-hairline bg-(--glass) shadow-(--card-shadow)">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </span>
      <p className="max-w-sm text-sm text-pretty text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}
