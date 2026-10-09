"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import {
  CameraIcon,
  CheckIcon,
  GlobeIcon,
  HandIcon,
  HourglassIcon,
  ListChecksIcon,
  Loader2Icon,
  PaperclipIcon,
  SendIcon,
  TextCursorInputIcon,
} from "lucide-react";
import { STEP_LABELS } from "@/lib/apply/labels";
import { cn } from "@/lib/utils";
import { BrowserFrame } from "./browser-frame";

// خطوات تشغيل التقديم الحقيقية (STEP_LABELS) ومعها لحظة تدخّل وحدة. الشركة والشخص خياليين.
const STEPS = [
  { key: "open", icon: GlobeIcon, detail: "صفحة التقديم الرسمية للوظيفة", ms: 1500 },
  { key: "fill", icon: TextCursorInputIcon, detail: "من ملفك وبنك إجاباتك", ms: 1900 },
  { key: "upload", icon: PaperclipIcon, detail: "السيرة الذاتية وخطاب التقديم", ms: 1500 },
  { key: "review", icon: ListChecksIcon, detail: "كل الحقول المطلوبة معبّاة", ms: 1400 },
  { key: "submit", icon: SendIcon, detail: "بعد ما وافقت أنت", ms: 1300 },
  { key: "needs_user", icon: HandIcon, detail: "الموقع طلب كود من بريدك. كمّله من البث الحي", ms: 3000 },
  { key: "confirm", icon: HourglassIcon, detail: "تأكيد من الموقع نفسه", ms: 1500 },
  { key: "evidence", icon: CameraIcon, detail: "لقطة صفحة التأكيد ورقم الطلب", ms: 3600 },
] as const;

const LAST = STEPS.length - 1;
const at = (key: (typeof STEPS)[number]["key"]) => STEPS.findIndex((s) => s.key === key);

const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribeReduce = (onChange: () => void) => {
  const mql = window.matchMedia(REDUCE);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
};

/** «تقليل الحركة» بدون اختلاف عن HTML الخادم: false وقت الـhydration، وبعدها القيمة الحقيقية */
function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeReduce, () => window.matchMedia(REDUCE).matches, () => false);
}

/** يمشي على الخطوات بس والقسم ظاهر، ويعيد من الأول بعد الدليل */
function useStepLoop(active: boolean) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setStep((s) => (s >= LAST ? 0 : s + 1)), STEPS[step]?.ms ?? 1500);
    return () => clearTimeout(t);
  }, [active, step]);
  return step;
}

/** كل الخطوات ظاهرة من البداية، وتنوّر وحدة وحدة مع التشغيل */
function Timeline({ step }: { step: number }) {
  return (
    <ol aria-label="خطوات التقديم" className="flex flex-col gap-2">
      {STEPS.map(({ key, icon: Icon, detail }, i) => {
        const state = i < step || step === LAST ? "done" : i === step ? "current" : "next";
        const attention = key === "needs_user" && state === "current";
        return (
          <li
            key={key}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2 transition-[opacity,border-color,background-color] duration-500 motion-reduce:transition-none",
              state === "next" ? "border-dashed border-hairline text-muted-foreground" : "border-hairline bg-background/60",
              state === "current" && "border-foreground/25 bg-foreground/[0.04]",
              attention && "border-foreground/40 bg-foreground/[0.08]",
            )}
          >
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full border border-hairline transition-colors duration-500",
                state === "next" && "opacity-50",
                attention && "border-transparent bg-foreground text-background",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">{STEP_LABELS[key]}</span>
              <span className="truncate text-xs text-muted-foreground">{detail}</span>
            </div>
            {state === "current" && (
              <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" aria-label="شغّالة" />
            )}
            {state === "done" && <CheckIcon className="size-4 shrink-0 text-muted-foreground" aria-label="تمت" />}
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, value, filled, ok }: { label: string; value: string; filled: boolean; ok: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div
        className={cn(
          "flex h-8 items-center justify-between rounded-md border border-hairline bg-background px-2.5 text-xs transition-colors duration-500",
          ok && "border-foreground/30",
        )}
      >
        <motion.span animate={{ opacity: filled ? 1 : 0 }} transition={{ duration: 0.4 }} className="truncate">
          {value}
        </motion.span>
        {ok && <CheckIcon className="size-3 shrink-0 text-muted-foreground" />}
      </div>
    </div>
  );
}

/** نموذج Greenhouse وهمي يتعبّى مع الخطوات */
function FormMock({ step }: { step: number }) {
  const filled = step >= at("fill");
  const uploaded = step >= at("upload");
  const reviewed = step >= at("review");
  const submitted = step >= at("submit");
  const needsUser = step === at("needs_user");
  const confirmed = step >= at("confirm");
  const evidence = step >= at("evidence");

  return (
    <BrowserFrame url="job-boards.greenhouse.io/nakhlapay" className="h-full">
      <div dir="ltr" className="relative h-[462px] overflow-hidden text-left">
        <AnimatePresence mode="wait" initial={false}>
          {!confirmed ? (
            <motion.div
              key="form"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-3 p-5"
            >
              <div>
                <p className="text-sm font-semibold">Senior Backend Engineer (Node.js)</p>
                <p className="text-xs text-muted-foreground">Nakhla Pay · Riyadh, Saudi Arabia</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name *" value="Faisal" filled={filled} ok={reviewed} />
                <Field label="Last name *" value="Al-Harbi" filled={filled} ok={reviewed} />
                <Field label="Email *" value="faisal@mail.example" filled={filled} ok={reviewed} />
                <Field label="Phone *" value="+966 50 000 0000" filled={filled} ok={reviewed} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">Resume/CV *</span>
                <div className="flex h-8 items-center gap-2 rounded-md border border-dashed border-hairline px-2.5 text-xs">
                  <PaperclipIcon className="size-3 text-muted-foreground" />
                  <motion.span animate={{ opacity: uploaded ? 1 : 0.4 }}>
                    {uploaded ? "cv-faisal.pdf · cover-letter.pdf" : "Attach"}
                  </motion.span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">Why Nakhla Pay? *</span>
                <div className="h-14 rounded-md border border-hairline bg-background p-2.5 text-xs leading-relaxed">
                  <motion.span animate={{ opacity: filled ? 1 : 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
                    I have spent four years building payment APIs in Node.js…
                  </motion.span>
                </div>
              </div>
              <span
                className={cn(
                  "mt-1 inline-flex h-8 w-fit items-center rounded-md border border-hairline px-4 text-xs font-medium transition-colors duration-300",
                  submitted && "bg-foreground text-background",
                )}
              >
                Submit application
              </span>

              <AnimatePresence>
                {needsUser && (
                  <motion.div
                    key="otp"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 grid place-items-center bg-background/70 p-6 backdrop-blur-sm"
                  >
                    <div className="flex w-full max-w-64 flex-col gap-3 rounded-xl border border-hairline bg-background p-4 shadow-xl">
                      <p dir="rtl" className="flex items-center gap-1.5 text-start text-[11px] font-medium">
                        <span className="size-1.5 animate-pulse rounded-full bg-foreground" />
                        البث الحي · أنت تكمّل الحين
                      </p>
                      <p className="text-xs">Enter the 8-digit code sent to faisal@mail.example</p>
                      <div className="grid grid-cols-8 gap-1">
                        {"48213706".split("").map((d, i) => (
                          <motion.span
                            key={i}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6 + i * 0.18 }}
                            className="grid h-7 place-items-center rounded border border-hairline font-mono text-xs"
                          >
                            {d}
                          </motion.span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="done"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
            >
              <span className="grid size-12 place-items-center rounded-full border border-hairline">
                <CheckIcon className="size-6" />
              </span>
              <p className="text-base font-semibold">Thank you for applying!</p>
              <p className="text-xs text-muted-foreground">Application reference: NP-20481</p>
              <AnimatePresence>
                {evidence && (
                  <motion.span
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    dir="rtl"
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-hairline bg-(--glass) px-3 py-1.5 text-xs shadow-(--card-shadow)"
                  >
                    <CameraIcon className="size-3.5" />
                    انحفظ الدليل في ملفاتك
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </BrowserFrame>
  );
}

export function WatchDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const reduce = usePrefersReducedMotion();
  const looped = useStepLoop(inView && !reduce);
  // تقليل الحركة ⇒ لقطة ثابتة لآخر حالة
  const step = reduce ? LAST : looped;

  return (
    <div ref={ref} className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-6">
      <div className="rounded-2xl border border-hairline bg-card/40 p-3 sm:p-4">
        <Timeline step={step} />
      </div>
      <div aria-hidden inert>
        <FormMock step={step} />
      </div>
    </div>
  );
}
