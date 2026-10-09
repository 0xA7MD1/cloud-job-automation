/** رأس الصفحة: عنوان + سطر + الإجراء الرئيسي (زر cta) في آخر السطر */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="text-2xl leading-[1.25] font-semibold sm:text-3xl">{title}</h1>
        {description && <p className="max-w-2xl text-pretty text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
