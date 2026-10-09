import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { ArrowUpLeftIcon } from "lucide-react"
import { Slot } from "radix-ui"

// سطح glass مشترك بين variant="glass" وsize="icon-pill" (ألوانه في globals.css)
const glassSurface =
  "relative border-border bg-(--glass) text-foreground shadow-(--card-shadow) transition-[transform,background-color,border-color,box-shadow] duration-220 ease-out before:absolute before:-inset-1.5 hover:-translate-y-0.5 hover:border-(--border-strong) hover:bg-(--glass-hover) hover:text-foreground aria-expanded:bg-(--glass-hover) motion-reduce:transition-none motion-reduce:hover:translate-y-0 [&_svg]:transition-transform [&_svg]:duration-220 hover:[&_svg[data-icon=inline-start]]:rotate-12"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
        // حبّة بلمعة + دائرة أيقونة (<CtaIcon />) في آخرها: الإجراء الرئيسي في كل صفحة
        cta: "relative isolate gap-3 rounded-full border-(--cta-border) bg-(image:--cta-bg) font-semibold text-(--cta-fg) shadow-(--cta-shadow) transition-[transform,box-shadow,filter] duration-220 ease-out before:pointer-events-none before:absolute before:inset-px before:-z-10 before:rounded-[inherit] before:bg-linear-to-b before:from-white/8 before:to-transparent before:to-58% hover:-translate-y-0.5 hover:shadow-(--cta-shadow-hover) focus-visible:border-(--cta-border) focus-visible:shadow-(--cta-shadow-hover) active:not-aria-[haspopup]:translate-y-0 active:shadow-(--cta-shadow-active) motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        // حبّة ثانوية شفافة
        glass: cn(glassSurface, "rounded-full"),
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
        // دائرة 40px بسطح glass (تبديل الثيم، قائمة الجوال)
        "icon-pill": cn(
          glassSurface,
          "size-10 rounded-full p-0 active:not-aria-[haspopup]:scale-95 [&_svg:not([class*='size-'])]:size-[1.125rem]"
        ),
      },
    },
    compoundVariants: [
      { variant: "cta", size: "lg", className: "h-11 rounded-full px-5 text-sm has-data-[slot=cta-icon]:pe-2" },
      { variant: "cta", size: "default", className: "h-10 rounded-full px-4 text-sm has-data-[slot=cta-icon]:pe-1.5" },
      { variant: "cta", size: "sm", className: "h-9 gap-2 rounded-full px-3 text-xs has-data-[slot=cta-icon]:pe-1" },
      { variant: "glass", size: "lg", className: "h-11 gap-2 rounded-full px-4" },
      { variant: "glass", size: "default", className: "h-10 gap-2 rounded-full px-4" },
      { variant: "glass", size: "sm", className: "h-9 gap-1.5 rounded-full px-3 text-xs" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

/** دائرة السهم في آخر زر cta: ألوانها معكوسة عن الزر، والسهم يتحرك لزاويته عند المرور */
function CtaIcon({ className, children, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="cta-icon"
      aria-hidden
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full bg-(--cta-fg) text-(--cta-icon-fg)",
        className
      )}
      {...props}
    >
      {children ?? (
        <ArrowUpLeftIcon className="size-4 transition-transform duration-220 group-hover/button:-translate-x-0.5 group-hover/button:-translate-y-0.5 motion-reduce:transition-none" />
      )}
    </span>
  )
}

export { Button, CtaIcon, buttonVariants }
