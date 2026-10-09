"use client";

import { MotionConfig } from "motion/react";

/** حركات motion تحترم «تقليل الحركة» في نظام المستخدم */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
