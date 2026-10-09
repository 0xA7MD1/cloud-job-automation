import type { Locator, Page } from "playwright-core";
import type { SupportedAts } from "@/lib/jobs/ats";
import type { AnswerValue, ApplicationForm, FormField, StoredAnswers } from "../form";

// الأجزاء المشتركة بين محوّلات Greenhouse / Lever / Ashby.

export interface FilePayload {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

export interface FillPlan {
  form: ApplicationForm;
  answers: StoredAnswers;
  files: { cv: FilePayload; coverLetter: FilePayload | null };
  profile: { city: string | null; country: string | null; phone: string | null };
  /** تجربة على نموذج حقيقي بدون رفع ملفات (ما نرسل شي لأي جهة) */
  skipFiles?: boolean;
}

export interface FillReport {
  filled: string[];
  /** حقول ما قدرنا نعبّيها (عنصر مو موجود، خيار مو موجود...) */
  skipped: { key: string; label: string; required: boolean; reason: string }[];
}

export type Outcome =
  | { kind: "submitted"; confirmationRef: string | null; text: string }
  | { kind: "invalid"; messages: string[] }
  | { kind: "captcha" }
  | { kind: "verification" }
  | { kind: "closed" }
  | { kind: "pending" };

export interface AtsAdapter {
  ats: SupportedAts;
  /** يفتح صفحة التقديم وينتظر النموذج. يرجّع false لو الوظيفة مقفلة أو النموذج مو موجود */
  open(page: Page, applyUrl: string): Promise<boolean>;
  fill(page: Page, plan: FillPlan): Promise<FillReport>;
  submit(page: Page): Promise<void>;
  /** فحص واحد سريع لحالة الصفحة بعد الإرسال (أو أثناء انتظار المستخدم) */
  outcome(page: Page): Promise<Outcome>;
}

export const SHORT = 5_000;

/** CSS لسلسلة نصية داخل [attr="..."] */
export function cssString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function byId(page: Page, id: string): Locator {
  return page.locator(`[id="${cssString(id)}"]`);
}

export async function exists(locator: Locator): Promise<boolean> {
  return (await locator.count().catch(() => 0)) > 0;
}

/** نص الخيار المحفوظ (نحفظ قيمة الخيار، والصفحة تعرض نصه) */
export function optionLabel(field: FormField, value: string): string {
  return field.options?.find((o) => o.value === value)?.label ?? value;
}

export function answerOf(plan: FillPlan, field: FormField): AnswerValue | undefined {
  return plan.answers[field.key]?.value;
}

export function asText(value: AnswerValue | undefined): string {
  if (value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return Array.isArray(value) ? value.join(", ") : value;
}

export function asList(field: FormField, value: AnswerValue | undefined): string[] {
  if (value === undefined || typeof value === "boolean") return [];
  const list = Array.isArray(value) ? value : [value];
  return list.filter(Boolean).map((v) => optionLabel(field, v));
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** يختار من قائمة خيارات ظاهرة: نص مطابق أول، ثم يبدأ به، ثم يحتويه */
export async function clickBestOption(options: Locator, label: string): Promise<boolean> {
  const texts = (await options.allTextContents().catch(() => [] as string[])).map(norm);
  const want = norm(label);
  let index = texts.findIndex((t) => t === want);
  if (index < 0) index = texts.findIndex((t) => t.startsWith(want));
  if (index < 0) index = texts.findIndex((t) => t.includes(want));
  if (index < 0) return false;
  await options.nth(index).click();
  return true;
}

export async function setFile(input: Locator, file: FilePayload): Promise<boolean> {
  if (!(await exists(input))) return false;
  // buffer بدل مسار: يشتغل مع متصفح بعيد (Steel) ومحلي
  await input.first().setInputFiles({ name: file.name, mimeType: file.mimeType, buffer: file.buffer });
  return true;
}

export function report(): FillReport {
  return { filled: [], skipped: [] };
}

export function skip(r: FillReport, field: FormField, reason: string) {
  r.skipped.push({ key: field.key, label: field.label, required: field.required, reason });
}

/** العنصر مو في الصفحة أصلًا (سؤال يظهر بشرط): ما ينحسب ناقص مطلوب */
export const NOT_ON_PAGE = "not on page";

/** يعبّي حقل ويحمي من خطأ حقل واحد يوقف الكل */
export async function attempt(r: FillReport, field: FormField, fn: () => Promise<boolean | string>): Promise<void> {
  try {
    const result = await fn();
    if (result === true) r.filled.push(field.key);
    else if (result === NOT_ON_PAGE || result === false) {
      r.skipped.push({ key: field.key, label: field.label, required: false, reason: NOT_ON_PAGE });
    } else skip(r, field, result);
  } catch (error) {
    skip(r, field, (error as Error).message.split("\n")[0]?.slice(0, 160) ?? "error");
  }
}

const CAPTCHA_FRAMES = [
  'iframe[src*="recaptcha/api2/bframe"]',
  'iframe[src*="recaptcha/enterprise/bframe"]',
  'iframe[src*="hcaptcha.com"][src*="challenge"]',
  'iframe[title*="hCaptcha challenge" i]',
  'iframe[src*="challenges.cloudflare.com"]',
];

/** تحدي كابتشا ظاهر للمستخدم (مو الشارة الصغيرة المخفية) */
export async function captchaVisible(page: Page): Promise<boolean> {
  for (const selector of CAPTCHA_FRAMES) {
    const frames = page.locator(selector);
    const n = await frames.count().catch(() => 0);
    for (let i = 0; i < n; i++) {
      const box = await frames.nth(i).boundingBox().catch(() => null);
      if (box && box.width > 50 && box.height > 50) return true;
    }
  }
  return false;
}

export async function bodyText(page: Page): Promise<string> {
  return (await page.locator("body").innerText({ timeout: SHORT }).catch(() => "")).slice(0, 20_000);
}

/** رقم الطلب من صفحة التأكيد لو موجود */
export function confirmationRef(text: string): string | null {
  const m = /(?:application|confirmation|reference|submission)\s*(?:id|number|no\.?|#)\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{3,40})/i.exec(text);
  return m?.[1] ?? null;
}

/** ينتظر الصفحة تهدأ (React يكمّل تحميله ويصفّر أي قيمة انكتبت قبله) */
export async function settle(page: Page, extraMs = 1_000): Promise<void> {
  await page.waitForLoadState("load", { timeout: 20_000 }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(extraMs);
}

export const CLOSED_RE = /no longer (accepting|available|open)|position (has been )?(filled|closed)|job (is )?(closed|not found)|page (you('re| are) looking for )?(was )?not found/i;
