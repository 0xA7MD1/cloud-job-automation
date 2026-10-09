import type { Page } from "playwright-core";
import { declineOption, type FormField } from "../form";
import {
  CLOSED_RE,
  NOT_ON_PAGE,
  SHORT,
  answerOf,
  asList,
  asText,
  attempt,
  bodyText,
  byId,
  captchaVisible,
  clickBestOption,
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

// Greenhouse (نموذج job-boards.greenhouse.io/embed/job_app):
// - كل حقل id = اسمه في الواجهة العامة (first_name, question_123...)، وأسئلة الهوية id = رقم السؤال
// - القوائم react-select: نكتب ونختار من [id^="react-select-<id>-option"]
// - الموقع: candidate-location (اقتراحات بعد الكتابة)، ورمز الجوال: #country
// - الصفحة تكمّل تحميل React بعد ما يظهر النموذج وتصفّر الي انكتب قبلها:
//   ننتظرها تهدأ، وبعد التعبئة نتحقق من كل حقل ونعيد الي انمسح

const DOM_ID: Record<string, string> = { location: "candidate-location" };
const TEXT_TYPES = new Set(["text", "textarea", "email", "phone", "url", "number", "date"]);

const domId = (field: FormField) => DOM_ID[field.key] ?? field.key;

async function selectedText(page: Page, id: string): Promise<string> {
  return page
    .evaluate((elementId) => {
      const el = document.getElementById(elementId);
      return el?.closest("[class*='control']")?.textContent?.trim() ?? "";
    }, id)
    .catch(() => "");
}

async function pickReactSelect(page: Page, id: string, label: string): Promise<boolean | string> {
  const input = byId(page, id);
  if (!(await exists(input))) return NOT_ON_PAGE;
  await input.click();
  await input.fill(label.slice(0, 80));
  const options = page.locator(`[id^="react-select-${cssString(id)}-option"]`);
  await options.first().waitFor({ state: "visible", timeout: SHORT }).catch(() => undefined);
  if (await clickBestOption(options, label)) return true;
  await page.keyboard.press("Escape");
  return `option "${label}" not found`;
}

async function pickLocation(page: Page, id: string, city: string, hint: string): Promise<boolean | string> {
  const input = byId(page, id);
  if (!(await exists(input))) return NOT_ON_PAGE;
  await input.click();
  await input.fill("");
  await input.pressSequentially(city, { delay: 60 });
  const options = page.locator(`[id^="react-select-${cssString(id)}-option"]`);
  await options.first().waitFor({ state: "visible", timeout: 8_000 }).catch(() => undefined);
  if (hint && (await clickBestOption(options, hint))) return true;
  if ((await options.count()) > 0) {
    await options.first().click();
    return true;
  }
  await page.keyboard.press("Escape");
  return "no location suggestions";
}

/** نص الخيار المطلوب لحقل قائمة، أو null */
function wantedLabel(plan: FillPlan, field: FormField): string | null {
  const value = answerOf(plan, field);
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const text = asText(value);
  return text ? optionLabel(field, text) : null;
}

async function fillField(page: Page, plan: FillPlan, field: FormField): Promise<boolean | string> {
  const id = domId(field);
  const value = answerOf(plan, field);

  if (field.type === "file") {
    if (plan.skipFiles) return "skipped (dry run)";
    const file = field.file === "cv" ? plan.files.cv : field.file === "cover_letter" ? plan.files.coverLetter : null;
    if (!file) return field.file === "cover_letter" && !field.required ? true : "no file for this field";
    return (await setFile(page.locator(`input[type="file"][id="${cssString(id)}"]`), file)) || NOT_ON_PAGE;
  }
  if (value === undefined || asText(value) === "") return "no answer";

  if (field.type === "location") {
    const city = plan.profile.city || asText(value).split(",")[0]!.trim();
    return pickLocation(page, id, city, asText(value));
  }
  if (field.type === "select" || field.type === "boolean") {
    return pickReactSelect(page, id, wantedLabel(plan, field) ?? "");
  }
  if (field.type === "multiselect") {
    let ok = 0;
    for (const label of asList(field, value)) if ((await pickReactSelect(page, id, label)) === true) ok++;
    return ok > 0 || "options not found";
  }
  const input = byId(page, id);
  if (!(await exists(input))) return NOT_ON_PAGE;
  await input.fill(asText(value));
  return true;
}

/** هل الحقل فعلًا فيه القيمة بعد التعبئة؟ (React ممكن مسحها) */
async function holdsValue(page: Page, plan: FillPlan, field: FormField): Promise<boolean> {
  const id = domId(field);
  if (TEXT_TYPES.has(field.type)) {
    const expected = asText(answerOf(plan, field));
    const actual = await byId(page, id).inputValue({ timeout: SHORT }).catch(() => null);
    return actual === null || actual.trim() === expected.trim() || field.type === "phone";
  }
  if (field.type === "select" || field.type === "boolean") {
    const label = wantedLabel(plan, field);
    if (!label) return true;
    return (await selectedText(page, id)).toLowerCase().includes(label.toLowerCase().slice(0, 30));
  }
  if (field.type === "location") return (await selectedText(page, id)).length > 0;
  return true;
}

export const greenhouseAdapter: AtsAdapter = {
  ats: "greenhouse",

  async open(page, applyUrl) {
    await page.goto(applyUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const form = page.locator("#application-form, form#application_form, form[action*='job_app']");
    const found = await form.first().waitFor({ state: "visible", timeout: 20_000 }).then(() => true).catch(() => false);
    if (!found) return false;
    await settle(page);
    return true;
  },

  async fill(page, plan) {
    const r = report();
    // الملفات أول: بعض اللوحات تعبّي الحقول من السيرة، ونكتب فوقها بعدين
    const ordered = [...plan.form.fields].sort((a, b) => Number(b.type === "file") - Number(a.type === "file"));
    for (const field of ordered) {
      await attempt(r, field, () => fillField(page, plan, field));
    }

    // «هل أنت من أصل لاتيني؟» يظهر بدل/قبل سؤال العرق، وما يجي في الواجهة العامة:
    // لو المستخدم يرفض الإفصاح نختار الرفض فيه بعد
    const race = plan.form.fields.find((f) => f.key === "race");
    if (race && plan.answers.race?.source === "decline" && (await exists(byId(page, "hispanic_ethnicity")))) {
      await pickReactSelect(page, "hispanic_ethnicity", "Decline").catch(() => false);
      if (await exists(byId(page, "race"))) {
        const decline = declineOption(race.options);
        if (decline) await pickReactSelect(page, "race", decline.label).catch(() => false);
      }
      r.skipped = r.skipped.filter((s) => s.key !== "race" || !(s.reason.includes("not found")));
    }

    // رمز دولة الجوال (مو من أسئلة الواجهة العامة، لكنه مطلوب في بعض النماذج).
    // اختيار الدولة يعدّل حقل الجوال، فنكتب الرقم بعده من جديد
    const phone = plan.form.fields.find((f) => f.key === "phone");
    if (plan.profile.country && (await exists(byId(page, "country")))) {
      await pickReactSelect(page, "country", plan.profile.country).catch(() => false);
      const value = phone ? asText(answerOf(plan, phone)) : "";
      if (value) await byId(page, "phone").fill(value).catch(() => undefined);
    }

    // تحقق: أي حقل انمسح نعبّيه مرة ثانية
    for (const field of plan.form.fields) {
      if (!r.filled.includes(field.key) || field.type === "file") continue;
      if (await holdsValue(page, plan, field)) continue;
      const again = await fillField(page, plan, field).catch(() => false);
      if (again !== true || !(await holdsValue(page, plan, field))) {
        r.filled = r.filled.filter((k) => k !== field.key);
        r.skipped.push({ key: field.key, label: field.label, required: field.required, reason: "value did not stick" });
      }
    }
    return r;
  },

  async submit(page) {
    const button = page.locator('button[type="submit"]', { hasText: /submit/i }).first();
    await button.scrollIntoViewIfNeeded().catch(() => undefined);
    await button.click({ timeout: 10_000 });
  },

  async outcome(page) {
    const url = page.url();
    const text = await bodyText(page);
    if (
      /\/confirmation\b/.test(url) ||
      /thank you for applying|application (has been |was )?(received|submitted)|we('ve| have) received your application/i.test(text)
    ) {
      return { kind: "submitted", confirmationRef: confirmationRef(text), text: text.slice(0, 600) };
    }
    if (!(await exists(page.locator("#application-form, form"))) && CLOSED_RE.test(text)) return { kind: "closed" };
    if (/security code|verification code|enter the code|code (was|has been) sent/i.test(text)) return { kind: "verification" };
    if (await captchaVisible(page)) return { kind: "captcha" };
    const errors = await page
      .locator('.helper-text--error, [id$="-error"]:not(:empty)')
      .allTextContents()
      .catch(() => [] as string[]);
    const messages = [...new Set(errors.map((e) => e.trim()).filter(Boolean))];
    if (messages.length > 0) return { kind: "invalid", messages: messages.slice(0, 5) };
    return { kind: "pending" };
  },
};
