"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// السكرول الناعم: كم ملّي ثانية تاخذ الصفحة عشان تلحق عجلة الماوس (ثابت زمني لمنحنى أسّي:
// 63% من المسافة بعده، و95% بعد ثلاثة أضعافه). أكبر ⇒ أنعم وأبطأ
const WHEEL_SMOOTH_MS = 190;

// الظهور يبدأ قبل ما يوصل العنصر أسفل الشاشة بـ10% منها: لما يطلع يكون بدأ يبان، فما فيه
// لحظة فراغ تحسّسك إن الصفحة معلّقة
const REVEAL_MARGIN = "0px 0px 10% 0px";
const REVEAL_MS = 550;
const STAGGER_MS = 60;
const STAGGER_MAX_MS = 300;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * حركة الصفحة كلها. العناصر تعلن عن نفسها بخصائص data بدل ما تصير مكوّنات عميل:
 * - data-reveal: يظهر (شفافية + صعود) أول ما يدخل الشاشة. حالته الأولى مخفية في globals.css
 * - data-tilt: مائل وأصغر شوي، ويعتدل مع السكرول
 * - data-pause-offscreen: حركاته اللانهائية (CSS) توقف وهو برّا الشاشة (globals.css)
 *
 * - كمبيوتر (ماوس/تراكباد): عجلة الماوس ناعمة (smoothWheel)، والسكرول نفسه سكرول المتصفح.
 * - لمس (جوال/تابلت): سكرول المتصفح كما هو.
 * - «تقليل الحركة»: لا سكرول ناعم ولا حركات، والعناصر ظاهرة من البداية.
 * - روابط الأقسام (#features …): scroll-behavior: smooth وscroll-margin-top في globals.css.
 *
 * الظهور بـWeb Animations (opacity + translate) ⇒ على الـcompositor، فما يزاحم السكرول.
 *
 * مكانه آخر الصفحة (مو الـlayout): الـlayout يكمل الـhydration قبل الصفحة، ولو تعدّلت
 * عناصرها قبل ما تكمل يطلع hydration mismatch.
 */
export function LandingMotion() {
  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add(
      {
        motion: "(prefers-reduced-motion: no-preference)",
        fine: "(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)",
      },
      (context) => {
        if (!context.conditions?.motion) return;
        // الميلان (GSAP) يرجع لحاله مع الـcontext؛ الباقي مستمعين نشيلهم بأنفسنا
        tiltOnScroll();
        const cleanups = [revealOnScroll(), pauseOffscreen()];
        if (context.conditions.fine) cleanups.push(smoothWheel());
        return () => {
          for (const fn of cleanups) fn();
        };
      },
    );
  });

  return null;
}

function revealOnScroll() {
  const observer = new IntersectionObserver((entries) => {
    const entering: Element[] = [];
    for (const entry of entries) {
      if (entry.isIntersecting) entering.push(entry.target);
      // فوق الشاشة (الصفحة انفتحت على رابط قسم): يظهر بدون حركة
      else if (entry.boundingClientRect.bottom < 0) {
        observer.unobserve(entry.target);
        entry.target.setAttribute("data-revealed", "");
      }
    }
    // القفزة الطويلة (رابط قسم، End) تجيب عناصر كثير مرة وحدة ⇒ التتابع كله له سقف
    const step = Math.min(STAGGER_MS, STAGGER_MAX_MS / entering.length);
    entering.forEach((el, i) => {
      observer.unobserve(el);
      el.setAttribute("data-revealed", "");
      el.animate([{ opacity: 0, translate: "0 16px" }, { opacity: 1, translate: "0 0" }], {
        duration: REVEAL_MS,
        delay: i * step,
        easing: EASE,
        fill: "backwards",
      });
    });
  }, { rootMargin: REVEAL_MARGIN });
  for (const el of document.querySelectorAll("[data-reveal]:not([data-revealed])")) observer.observe(el);
  return () => observer.disconnect();
}

/**
 * الحركات اللانهائية (شعاع الإطار، لمعة النص) ترسم على الـmain thread كل فريم حتى وهي برّا
 * الشاشة، والسكرول الناعم يحتاج نفس الـthread كل فريم ⇒ نوقفها لين يرجع قسمها.
 */
function pauseOffscreen() {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.toggleAttribute("data-offscreen", !entry.isIntersecting);
  });
  for (const el of document.querySelectorAll("[data-pause-offscreen]")) observer.observe(el);
  return () => {
    observer.disconnect();
    for (const el of document.querySelectorAll("[data-offscreen]")) el.removeAttribute("data-offscreen");
  };
}

function tiltOnScroll() {
  for (const el of gsap.utils.toArray<HTMLElement>("[data-tilt]")) {
    gsap.fromTo(
      el,
      { rotateX: 16, scale: 0.94, transformPerspective: 1400, transformOrigin: "50% 0%" },
      {
        rotateX: 0,
        scale: 1,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "top 25%", scrub: true },
      },
    );
  }
}

/**
 * عجلة الماوس الناعمة: نمسك الـwheel ونحرّك سكرول الصفحة نفسه بالتدريج (طريقة Lenis).
 * ScrollSmoother كان يحرّك المحتوى كله بـtransform، فالمتصفح ما يرسم القسم الجاي قبل ما يوصله
 * ⇒ تعليق أول كل قسم. هنا السكرول سكرول المتصفح: يرسم مسبقًا، وsticky وIntersectionObserver
 * وروابط الأقسام تشتغل عادي.
 */
function smoothWheel() {
  const root = document.documentElement;
  let target = 0;
  let current = 0;
  // آخر موضع كتبناه. null أول فريم: نكتب فوق أي سكرول ناعم شغّال (رابط قسم) ونوقفه
  let written: number | null = null;
  let active = false;

  const stop = () => {
    active = false;
    written = null;
    gsap.ticker.remove(tick);
  };

  function tick(_time: number, deltaMs: number) {
    // أحد غيرنا حرّك الصفحة (الكيبورد، شريط السكرول، رابط قسم، البحث في الصفحة) ⇒ نتركه له
    if (written !== null && Math.abs(window.scrollY - written) > 2) return stop();
    current += (target - current) * (1 - Math.exp(-deltaMs / WHEEL_SMOOTH_MS));
    if (Math.abs(target - current) < 0.5) current = target;
    // instant: يتجاوز scroll-behavior: smooth حق روابط الأقسام
    window.scrollTo({ top: current, behavior: "instant" });
    written = current;
    ScrollTrigger.update();
    if (current === target) stop();
  }

  const onWheel = (e: WheelEvent) => {
    // تكبير (Ctrl)، سكرول أفقي، أو أحد ثاني تكفّل فيه (القائمة الجانبية تقفل السكرول)
    if (e.defaultPrevented || e.ctrlKey || e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (pageLocked(root) || scrollsInside(e.target, e.deltaY)) return;
    e.preventDefault();
    if (!active) target = current = window.scrollY;
    // deltaMode: 0 بكسل، 1 أسطر (Firefox)، 2 صفحات
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
    target = gsap.utils.clamp(0, root.scrollHeight - window.innerHeight, target + e.deltaY * unit);
    if (!active) {
      active = true;
      gsap.ticker.add(tick);
    }
  };

  window.addEventListener("wheel", onWheel, { passive: false });
  return () => {
    window.removeEventListener("wheel", onWheel);
    stop();
  };
}

function pageLocked(root: HTMLElement) {
  return getComputedStyle(root).overflowY === "hidden" || getComputedStyle(document.body).overflowY === "hidden";
}

/** العجلة فوق عنصر يتمرّر بنفسه في نفس الاتجاه ⇒ نخليه يتمرّر هو */
function scrollsInside(target: EventTarget | null, deltaY: number) {
  for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
    if (el.scrollHeight <= el.clientHeight) continue;
    const { overflowY } = getComputedStyle(el);
    if (overflowY !== "auto" && overflowY !== "scroll") continue;
    if (deltaY > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
  }
  return false;
}
