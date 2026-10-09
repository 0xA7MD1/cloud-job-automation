import type { CSSProperties, HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

/**
 * شبكة نقاط للخلفية (مبنية على Magic UI dot-pattern).
 * الأصل يرسم دائرة motion لكل نقطة بعد التحميل؛ هنا خلفية CSS وحدة ⇒ تنرسم من الخادم بدون JS ولا قفزة.
 * لون النقاط من text-* (currentColor)، والتلاشي بـmask-* من الأب.
 */
interface DotPatternProps extends HTMLAttributes<HTMLDivElement> {
  /** المسافة الأفقية بين النقاط */
  width?: number
  /** المسافة العمودية بين النقاط */
  height?: number
  /** إزاحة الشبكة كلها */
  x?: number
  y?: number
  /** نصف قطر النقطة */
  cr?: number
}

export function DotPattern({
  width = 16,
  height = 16,
  x = 0,
  y = 0,
  cr = 1,
  className,
  style,
  ...props
}: DotPatternProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 size-full text-foreground/20",
        className
      )}
      style={
        {
          backgroundImage: `radial-gradient(circle at ${cr}px ${cr}px, currentColor ${cr}px, transparent ${cr + 0.5}px)`,
          backgroundSize: `${width}px ${height}px`,
          backgroundPosition: `${x}px ${y}px`,
          ...style,
        } as CSSProperties
      }
      {...props}
    />
  )
}
