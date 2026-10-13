"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// كم بكسل من الأسفل نعتبره «تحت»
const THRESHOLD = 64;

/**
 * تمرير الشات: يلحق آخر الرد وهو ينكتب، إلا لو المستخدم طلع لفوق يقرأ.
 * يرجع للّحاق لما ينزل لتحت بنفسه أو يضغط زر النزول أو يرسل رسالة.
 * enabled = عمود الرسائل موجود في الصفحة (فيه رسائل).
 */
export function useStickToBottom(enabled: boolean) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!enabled || !el || !content) return;

    let lastTop = el.scrollTop;
    const measure = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      // طلع لفوق بنفسه ⇒ نوقف اللحاق. (لو المحتوى قصر ونزل التمرير معه، المسافة صفر فنكمل)
      if (el.scrollTop < lastTop - 1 && distance > 1) stuck.current = false;
      else if (distance <= THRESHOLD) stuck.current = true;
      lastTop = el.scrollTop;
      setAtBottom(distance <= THRESHOLD);
    };
    const pin = () => {
      if (stuck.current) el.scrollTop = el.scrollHeight;
      measure();
    };

    // يفتح على آخر رسالة، ويلحق كل ما كبر المحتوى (بث الرد، بطاقات الأدوات) أو تغيّر طول العمود (مربع الكتابة)
    stuck.current = true;
    pin();
    const observer = new ResizeObserver(pin);
    observer.observe(content);
    observer.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [enabled]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    stuck.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  return { scrollRef, contentRef, atBottom, scrollToBottom };
}
