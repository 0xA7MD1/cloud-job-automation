import type { Page } from "playwright-core";
import type { FormField } from "../form";
import {
  CLOSED_RE,
  NOT_ON_PAGE,
  answerOf,
  asList,
  asText,
  attempt,
  bodyText,
  captchaVisible,
  confirmationRef,
  cssString,
  exists,
  optionLabel,
  report,
  setFile,
  settle,
  type AtsAdapter,
  type FillPlan,
} from "./common";

// Lever (jobs.lever.co/<site>/<id>/apply): نموذج HTML عادي.
// - الحقول بالاسم: name, email, phone, org, urls[...], comments, cards[<id>][fieldN], eeo[...]
// - الأسئلة الإضافية: radio / checkbox (القيمة = نص الخيار) أو <select>
// - الموقع: #location-input مع اقتراحات .dropdown-location
// - رفع السيرة يعبّي الاسم والبريد تلقائيًا: نرفعها أول ونكتب فوقها
// - الإرسال: #btn-submit (عليه hCaptcha غالبًا)

const byName = (page: Page, name: string) => page.locator(`[name="${cssString(name)}"]`);

async function fillField(page: Page, plan: FillPlan, field: FormField): Promise<boolean | string> {
  const value = answerOf(plan, field);

  if (field.type === "file") {
    if (plan.skipFiles) return "skipped (dry run)";
    if (field.file !== "cv") return field.required ? "unsupported file" : true;
    return (await setFile(page.locator('input[type="file"][name="resume"]'), plan.files.cv)) || NOT_ON_PAGE;
  }
  if (value === undefined || asText(value) === "") return "no answer";

  const elements = byName(page, field.key);
  if (!(await exists(elements))) return NOT_ON_PAGE;

  if (field.type === "location") {
    const input = page.locator("#location-input");
    await input.fill("");
    await input.pressSequentially(plan.profile.city || asText(value), { delay: 60 });
    const option = page.locator(".dropdown-location").first();
    if (await option.waitFor({ state: "visible", timeout: 8_000 }).then(() => true).catch(() => false)) {
      await option.click();
    }
    return true;
  }

  const tag = await elements.first().evaluate((el) => `${el.tagName}:${(el as HTMLInputElement).type}`);
  if (field.type === "select" || field.type === "multiselect" || field.type === "boolean") {
    const labels =
      typeof value === "boolean" ? [value ? "Yes" : "No"] : field.type === "multiselect" ? asList(field, value) : [optionLabel(field, asText(value))];
    if (tag.startsWith("SELECT")) {
      // EEO: قيمة الخيار، والأسئلة الإضافية: نص الخيار
      const selected = await elements
        .first()
        .selectOption(field.key.startsWith("eeo[") ? { value: asText(value) } : { label: labels[0]! })
        .catch(() => [] as string[]);
      return selected.length > 0 || `option "${labels[0]}" not found`;
    }
    let ok = 0;
    for (const label of labels) {
      const box = page.locator(`input[name="${cssString(field.key)}"][value="${cssString(label)}"]`);
      if (await exists(box)) {
        await box.first().check({ force: true });
        ok++;
      }
    }
    return ok > 0 || `option "${labels[0]}" not found`;
  }

  await elements.first().fill(asText(value));
  return true;
}

export const leverAdapter: AtsAdapter = {
  ats: "lever",

  async open(page, applyUrl) {
    await page.goto(applyUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const found = await page
      .locator("#btn-submit, form#application-form, .application-form")
      .first()
      .waitFor({ state: "visible", timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    if (!found) return false;
    await settle(page);
    // شريط الكوكيز يغطي زر الإرسال أحيانًا: نرفض غير الضروري
    await page.locator(".cc-deny").first().click({ timeout: 2_000 }).catch(() => undefined);
    return true;
  },

  async fill(page, plan) {
    const r = report();
    const files = plan.form.fields.filter((f) => f.type === "file");
    for (const field of files) await attempt(r, field, () => fillField(page, plan, field));
    // قراءة السيرة عند Lever تعبّي الحقول بعد ثواني: ننتظرها قبل ما نكتب
    if (!plan.skipFiles && files.length) await page.waitForTimeout(4_000);
    for (const field of plan.form.fields) {
      if (field.type !== "file") await attempt(r, field, () => fillField(page, plan, field));
    }
    return r;
  },

  async submit(page) {
    const button = page.locator("#btn-submit").first();
    await button.scrollIntoViewIfNeeded().catch(() => undefined);
    await button.click({ timeout: 10_000 });
  },

  async outcome(page) {
    const text = await bodyText(page);
    if (/\/thanks\b/.test(page.url()) || /application (was )?submitted|thanks for applying|thank you for applying/i.test(text)) {
      return { kind: "submitted", confirmationRef: confirmationRef(text), text: text.slice(0, 600) };
    }
    if (!(await exists(page.locator("#btn-submit"))) && CLOSED_RE.test(text)) return { kind: "closed" };
    if (await captchaVisible(page)) return { kind: "captcha" };
    const errors = await page
      .locator(".error-message:visible, .application-error:visible, .error:visible")
      .allTextContents()
      .catch(() => [] as string[]);
    const messages = [...new Set(errors.map((e) => e.trim()).filter(Boolean))];
    if (messages.length) return { kind: "invalid", messages: messages.slice(0, 5) };
    return { kind: "pending" };
  },
};
