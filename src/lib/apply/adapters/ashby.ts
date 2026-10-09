import type { Locator, Page } from "playwright-core";
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

// Ashby (jobs.ashbyhq.com/<org>/<id>/application): تطبيق React.
// - كل سؤال داخل [data-field-path="<path>"] (المسار نفسه من GraphQL)
// - نعم/لا: أزرار data-option="yes|no". اختيار واحد/متعدد: label لكل خيار، أو قائمة combobox
// - الموقع: كتابة ثم [role=option]
// - الإرسال: زر «Submit Application»

const entryOf = (page: Page, key: string): Locator => page.locator(`[data-field-path="${cssString(key)}"]`).first();

async function pickFromCombobox(page: Page, entry: Locator, label: string): Promise<boolean> {
  const input = entry.locator('input[role="combobox"], input[placeholder*="Start typing" i]').first();
  if (!(await exists(input))) return false;
  await input.click();
  await input.fill("");
  await input.pressSequentially(label.slice(0, 60), { delay: 50 });
  const options = page.locator('[role="option"]');
  await options.first().waitFor({ state: "visible", timeout: 8_000 }).catch(() => undefined);
  if (await clickBestOption(options, label)) return true;
  if ((await options.count()) > 0) {
    await options.first().click();
    return true;
  }
  await page.keyboard.press("Escape");
  return false;
}

async function fillField(page: Page, plan: FillPlan, field: FormField): Promise<boolean | string> {
  const value = answerOf(plan, field);

  if (field.type === "file") {
    if (plan.skipFiles) return "skipped (dry run)";
    const file = field.file === "cv" ? plan.files.cv : field.file === "cover_letter" ? plan.files.coverLetter : null;
    if (!file) return field.required ? "no file for this field" : true;
    const input =
      field.key === "_systemfield_resume"
        ? page.locator('input[type="file"]#_systemfield_resume')
        : entryOf(page, field.key).locator('input[type="file"]');
    return (await setFile(input, file)) || NOT_ON_PAGE;
  }
  if (value === undefined || asText(value) === "") return "no answer";

  const entry = entryOf(page, field.key);
  if (!(await exists(entry))) return NOT_ON_PAGE;

  if (field.type === "boolean") {
    const yes = typeof value === "boolean" ? value : /^y/i.test(asText(value));
    await entry.locator(`button[data-option="${yes ? "yes" : "no"}"]`).first().click();
    return true;
  }
  if (field.type === "location") {
    return (await pickFromCombobox(page, entry, plan.profile.city || asText(value))) || "no location suggestions";
  }
  if (field.type === "select" || field.type === "multiselect") {
    const labels = field.type === "multiselect" ? asList(field, value) : [optionLabel(field, asText(value))];
    if (await exists(entry.locator('input[type="radio"], input[type="checkbox"]'))) {
      let ok = 0;
      for (const label of labels) if (await clickBestOption(entry.locator("label"), label)) ok++;
      return ok > 0 || `option "${labels[0]}" not found`;
    }
    let ok = 0;
    for (const label of labels) if (await pickFromCombobox(page, entry, label)) ok++;
    return ok > 0 || `option "${labels[0]}" not found`;
  }

  const input = entry.locator('textarea, input:not([type="file"]):not([type="checkbox"]):not([type="radio"])').first();
  if (!(await exists(input))) return NOT_ON_PAGE;
  await input.fill(asText(value));
  return true;
}

export const ashbyAdapter: AtsAdapter = {
  ats: "ashby",

  async open(page, applyUrl) {
    await page.goto(applyUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const found = await page
      .locator(".ashby-application-form-field-entry")
      .first()
      .waitFor({ state: "visible", timeout: 25_000 })
      .then(() => true)
      .catch(() => false);
    if (!found) return false;
    await settle(page);
    return true;
  },

  async fill(page, plan) {
    const r = report();
    const ordered = [...plan.form.fields].sort((a, b) => Number(b.type === "file") - Number(a.type === "file"));
    for (const field of ordered) {
      await attempt(r, field, () => fillField(page, plan, field));
      if (field.type === "file" && !plan.skipFiles) await page.waitForTimeout(1_500);
    }
    return r;
  },

  async submit(page) {
    const button = page.getByRole("button", { name: /submit application/i }).first();
    await button.scrollIntoViewIfNeeded().catch(() => undefined);
    await button.click({ timeout: 10_000 });
  },

  async outcome(page) {
    const text = await bodyText(page);
    if (
      (await exists(page.locator(".ashby-application-form-success-container"))) ||
      /application (was )?(successfully )?submitted|thank(s| you) for applying/i.test(text)
    ) {
      return { kind: "submitted", confirmationRef: confirmationRef(text), text: text.slice(0, 600) };
    }
    if (!(await exists(page.locator(".ashby-application-form-field-entry"))) && CLOSED_RE.test(text)) return { kind: "closed" };
    if (await captchaVisible(page)) return { kind: "captcha" };
    if (/flagged as (possible )?spam|couldn'?t submit your application/i.test(text)) {
      return { kind: "invalid", messages: ["Ashby رفض الإرسال كـ«مشبوه». قدّم بنفسك من نفس الصفحة."] };
    }
    const errors = await page
      .locator('.ashby-application-form-field-entry [class*="error" i]:visible')
      .allTextContents()
      .catch(() => [] as string[]);
    const messages = [...new Set(errors.map((e) => e.trim()).filter(Boolean))];
    if (messages.length) return { kind: "invalid", messages: messages.slice(0, 5) };
    return { kind: "pending" };
  },
};
