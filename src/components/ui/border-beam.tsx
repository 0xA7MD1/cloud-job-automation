import type { CSSProperties } from "react"

import { cn } from "@/lib/utils"

/**
 * شعاع يمشي على حدود العنصر (مبني على Magic UI border-beam).
 * الأصل يحرّك offset-distance بـmotion (JS كل فريم)؛ هنا keyframes في CSS (globals.css: border-beam)
 * ⇒ بدون مكتبة ولا شغل على الـmain thread. «تقليل الحركة» يوقفه من globals.css.
 */
interface BorderBeamProps {
  /** طول الشعاع بالبكسل */
  size?: number
  /** مدة اللفة بالثواني */
  duration?: number
  /** تأخير البداية بالثواني */
  delay?: number
  colorFrom?: string
  colorTo?: string
  className?: string
  style?: CSSProperties
  reverse?: boolean
  /** نقطة البداية (0-100) */
  initialOffset?: number
  borderWidth?: number
}

export const BorderBeam = ({
  className,
  size = 50,
  delay = 0,
  duration = 6,
  colorFrom = "#ffaa40",
  colorTo = "#9c40ff",
  style,
  reverse = false,
  initialOffset = 0,
  borderWidth = 1,
}: BorderBeamProps) => {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-(length:--border-beam-width) border-transparent mask-[linear-gradient(transparent,transparent),linear-gradient(#000,#000)] mask-intersect [mask-clip:padding-box,border-box]"
      style={
        {
          "--border-beam-width": `${borderWidth}px`,
        } as CSSProperties
      }
    >
      <div
        className={cn(
          // طبقة لحالها: حركة offset-distance تتحدّث كل فريم، والطبقة تتحرك بدون إعادة رسم ما حولها
          "animate-border-beam absolute aspect-square will-change-transform",
          "bg-linear-to-l from-(--color-from) via-(--color-to) to-transparent",
          className
        )}
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            "--color-from": colorFrom,
            "--color-to": colorTo,
            "--beam-from": `${initialOffset}%`,
            "--beam-to": `${100 + initialOffset}%`,
            animationDuration: `${duration}s`,
            animationDelay: `${-delay}s`,
            animationDirection: reverse ? "reverse" : undefined,
            ...style,
          } as CSSProperties
        }
      />
    </div>
  )
}
