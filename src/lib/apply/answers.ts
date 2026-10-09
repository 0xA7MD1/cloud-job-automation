import type { Profile } from "@/lib/db/types";
import type { Answers } from "@/lib/profile";
import { declineOption, matchOption, type AnswerValue, type FormField, type StoredAnswer, type StoredAnswers } from "./form";

// إجابات بدون ذكاء: من الملف الشخصي وبنك الإجابات. الي ما ينحل هنا يروح للذكاء.

export interface AnswerContext {
  profile: Pick<
    Profile,
    "full_name" | "phone" | "city" | "country" | "headline" | "linkedin_url" | "github_url" | "portfolio_url"
  >;
  bank: Answers;
  email: string;
  coverLetterText?: string | null;
}

function splitName(full: string | null): { first: string; last: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0]!, last: "" };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** تشابه كلمات بسيط بين سؤالين (0..1) لبنك الأسئلة المخصصة */
export function similarity(a: string, b: string): number {
  const wa = new Set(norm(a).split(" ").filter((w) => w.length > 2));
  const wb = new Set(norm(b).split(" ").filter((w) => w.length > 2));
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.max(wa.size, wb.size);
}

/** يحوّل نص إجابة لقيمة تناسب نوع الحقل. null = ما تنطبق على الخيارات. */
export function coerceAnswer(field: FormField, raw: string | string[] | boolean): AnswerValue | null {
  if (field.type === "boolean") {
    if (typeof raw === "boolean") return raw;
    const v = norm(Array.isArray(raw) ? (raw[0] ?? "") : raw);
    if (/^(yes|y|true|نعم)\b/.test(v)) return true;
    if (/^(no|n|false|لا)\b/.test(v)) return false;
    return null;
  }
  if (field.type === "select") {
    const wanted = typeof raw === "boolean" ? (raw ? "Yes" : "No") : Array.isArray(raw) ? (raw[0] ?? "") : raw;
    if (!field.options?.length) return wanted.trim() || null;
    return matchOption(field.options, wanted)?.value ?? null;
  }
  if (field.type === "multiselect") {
    const list = typeof raw === "boolean" ? [] : Array.isArray(raw) ? raw : raw.split(/\s*[|;\n]\s*/);
    if (!field.options?.length) return list.filter(Boolean);
    const values = [...new Set(list.map((item) => matchOption(field.options, item)?.value).filter((v): v is string => !!v))];
    return values.length ? values : null;
  }
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  const value = Array.isArray(raw) ? raw.join(", ") : raw;
  return value.trim() ? value.trim() : null;
}

const has = (re: RegExp, field: FormField) => re.test(`${field.key} ${field.label}`);

/** قيمة من الملف الشخصي (بيانات التواصل والروابط) */
function fromProfile(field: FormField, ctx: AnswerContext): string | null {
  const p = ctx.profile;
  const { first, last } = splitName(p.full_name);
  const key = field.key;
  const label = norm(field.label);

  if (key === "first_name" || /^(legal )?first name$/.test(label)) return first || null;
  if (key === "last_name" || /^(legal )?(last name|surname|family name)$/.test(label)) return last || null;
  if (key === "preferred_name" || /preferred (first )?name/.test(label)) return first || null;
  if (key === "name" || key === "_systemfield_name" || /^(full|legal) name$|^name$/.test(label)) return p.full_name;
  if (field.type === "email" || key === "_systemfield_email") return ctx.email || null;
  if (field.type === "phone" || /\b(phone|mobile)\b/.test(label)) return p.phone;
  if (field.type === "location" || /current location|where are you (currently )?(located|based)|^location$|^city$/.test(label)) {
    return [p.city, p.country].filter(Boolean).join(", ") || null;
  }
  // روابط بس في حقول قصيرة (مو سؤال طويل يذكر GitHub)
  const linkField = (field.type === "url" || field.type === "text") && field.label.length <= 60;
  if (linkField && has(/linkedin/i, field)) return p.linkedin_url;
  if (linkField && has(/github/i, field)) return p.github_url;
  if (linkField && has(/portfolio|personal (website|site)|other website|^website$|urls\[(portfolio|other)\]/i, field)) {
    return p.portfolio_url;
  }
  if (key === "comments") return ctx.coverLetterText?.trim() || null;
  return null;
}

/** قيمة من بنك الإجابات (الأسئلة المتكررة + الأسئلة المخصصة) */
function fromBank(field: FormField, bank: Answers): string | null {
  const q = `${field.label} ${field.description ?? ""}`;
  const yesNo = (v: "" | "yes" | "no") => (v ? (v === "yes" ? "Yes" : "No") : null);

  if (/sponsor/i.test(q)) return yesNo(bank.requires_sponsorship);
  if (/relocat/i.test(q)) return yesNo(bank.willing_to_relocate);
  if (/notice period/i.test(q)) return bank.notice_period || null;
  if (/(earliest|soonest|when).{0,30}start|start date|available to start/i.test(q)) return bank.earliest_start_date || null;
  if (/salary|compensation expectation|expected (pay|compensation|salary)|desired (pay|salary)/i.test(q)) {
    return bank.expected_salary || null;
  }
  if (/how (did )?you (hear|heard|find|found|learn)|where did you (hear|find)|referral source/i.test(q)) return bank.how_did_you_hear || null;
  if (field.type !== "select" && field.type !== "boolean" && /\blanguages?\b/i.test(field.label)) return bank.languages || null;
  // «يحق لك العمل» نعم/لا يعتمد على بلد الوظيفة: بنك الإجابات نص حر، فنتركها للذكاء

  let best: { answer: string; score: number } | null = null;
  for (const item of bank.custom) {
    const score = similarity(item.question, field.label);
    if (score >= 0.75 && (!best || score > best.score)) best = { answer: item.answer, score };
  }
  return best?.answer || null;
}

/**
 * يعبّي الي يقدر عليه بدون ذكاء. يرجّع الإجابات والحقول الباقية للذكاء.
 * حقول الملفات ما تدخل هنا: تنعبّى من ملفات الطلب.
 */
export function autoAnswer(fields: readonly FormField[], ctx: AnswerContext): { answers: StoredAnswers; pending: FormField[] } {
  const answers: StoredAnswers = {};
  const pending: FormField[] = [];

  for (const field of fields) {
    if (field.type === "file") continue;

    if (field.group === "demographic") {
      if (ctx.bank.decline_voluntary_disclosures) {
        const decline = declineOption(field.options);
        if (decline) {
          answers[field.key] = { value: field.type === "multiselect" ? [decline.value] : decline.value, source: "decline" };
        }
      }
      // ما نخمّن هوية أحد: لو ما فيه خيار رفض، تبقى للمستخدم
      continue;
    }

    let stored: StoredAnswer | null = null;
    const profileValue = fromProfile(field, ctx);
    if (profileValue) {
      const v = coerceAnswer(field, profileValue);
      if (v !== null) stored = { value: v, source: "profile" };
    }
    if (!stored) {
      const bankValue = fromBank(field, ctx.bank);
      if (bankValue) {
        const v = coerceAnswer(field, bankValue);
        if (v !== null) stored = { value: v, source: "bank" };
      }
    }
    if (stored) answers[field.key] = stored;
    else pending.push(field);
  }
  return { answers, pending };
}
