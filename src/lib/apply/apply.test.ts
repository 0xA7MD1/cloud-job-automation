import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { answersSchema } from "@/lib/profile";
import { detectLanguage } from "./ai";
import { autoAnswer, coerceAnswer, similarity } from "./answers";
import { extractCvText } from "./cv-text";
import { coverLetterDocx, coverLetterFileName, coverLetterPdf } from "./documents";
import { declineOption, matchOption, missingRequired, type FormField } from "./form";
import { applyUrlFor, basicFields, parseAshbyForm, parseGreenhouseForm, parseLeverForm } from "./forms";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const fixture = (name: string) => readFileSync(path.join(dir, name), "utf8");

const byKey = (fields: FormField[], key: string) => fields.find((f) => f.key === key);

describe("form parsers (real boards)", () => {
  it("reads Greenhouse questions, files, EEOC and demographic sections", () => {
    const fields = parseGreenhouseForm(JSON.parse(fixture("greenhouse-form.json")));
    expect(byKey(fields, "first_name")).toMatchObject({ type: "text", required: true, group: "basic" });
    expect(byKey(fields, "email")).toMatchObject({ type: "email", required: true });
    expect(byKey(fields, "resume")).toMatchObject({ type: "file", file: "cv", required: true });
    expect(byKey(fields, "cover_letter")).toMatchObject({ type: "file", file: "cover_letter", required: false });
    expect(byKey(fields, "location")).toMatchObject({ type: "location", group: "basic" });
    expect(fields.some((f) => f.key === "latitude")).toBe(false);

    const why = fields.find((f) => /why do you want/i.test(f.label));
    expect(why).toMatchObject({ type: "textarea", required: true, group: "question" });
    const authorized = fields.find((f) => /legally authorized/i.test(f.label));
    expect(authorized?.type).toBe("select");
    expect(authorized?.options?.map((o) => o.label)).toEqual(["Yes", "No"]);

    expect(byKey(fields, "veteran_status")?.group).toBe("demographic");
    const gender = fields.find((f) => f.group === "demographic" && f.label === "Gender" && /^\d+$/.test(f.key));
    expect(declineOption(gender?.options)?.label).toMatch(/don't wish/i);
  });

  it("reads Lever standard fields and custom cards", () => {
    const fields = parseLeverForm(fixture("lever-form.html"));
    expect(byKey(fields, "name")).toMatchObject({ type: "text", required: true });
    expect(byKey(fields, "phone")).toMatchObject({ type: "phone", required: false });
    expect(byKey(fields, "location")).toMatchObject({ type: "location", required: true });
    expect(byKey(fields, "resume")).toMatchObject({ type: "file", file: "cv", required: true });
    expect(byKey(fields, "urls[LinkedIn]")?.type).toBe("url");
    expect(byKey(fields, "comments")?.type).toBe("textarea");

    const cards = fields.filter((f) => f.key.startsWith("cards["));
    expect(cards.length).toBeGreaterThanOrEqual(10);
    const languages = cards.find((f) => /language skill/i.test(f.label));
    expect(languages).toMatchObject({ type: "multiselect", required: true });
    const sponsor = cards.find((f) => /sponsorship/i.test(f.label));
    expect(sponsor).toMatchObject({ type: "select", required: true });
    expect(sponsor?.key).toMatch(/^cards\[[0-9a-f-]+\]\[field1\]$/);
  });

  it("reads Ashby application form fields", () => {
    const fields = parseAshbyForm(JSON.parse(fixture("ashby-form.json")));
    expect(byKey(fields, "_systemfield_name")).toMatchObject({ type: "text", required: true, group: "basic" });
    expect(byKey(fields, "_systemfield_email")?.type).toBe("email");
    expect(byKey(fields, "_systemfield_resume")).toMatchObject({ type: "file", file: "cv" });
    expect(fields.find((f) => f.type === "file" && /cover/i.test(f.label))?.file).toBe("cover_letter");
    expect(fields.filter((f) => f.type === "boolean").length).toBeGreaterThan(0);
    expect(fields.find((f) => f.type === "location")?.required).toBe(true);
  });

  it("builds apply URLs and a safe fallback form", () => {
    expect(applyUrlFor("greenhouse", "stripe", "123")).toBe("https://job-boards.greenhouse.io/embed/job_app?for=stripe&token=123");
    expect(applyUrlFor("lever", "palantir", "abc")).toBe("https://jobs.lever.co/palantir/abc/apply");
    expect(applyUrlFor("ashby", "ramp", "x-y")).toBe("https://jobs.ashbyhq.com/ramp/x-y/application");
    expect(basicFields("lever").map((f) => f.key)).toEqual(["name", "email", "phone", "resume"]);
  });
});

describe("answers without AI", () => {
  const fields = parseGreenhouseForm(JSON.parse(fixture("greenhouse-form.json")));
  const ctx = {
    profile: {
      full_name: "Ahmed Al Test",
      phone: "+966500000000",
      city: "Riyadh",
      country: "Saudi Arabia",
      headline: "Software Engineer",
      linkedin_url: "https://linkedin.com/in/test",
      github_url: null,
      portfolio_url: null,
    },
    bank: answersSchema.parse({
      requires_sponsorship: "yes",
      willing_to_relocate: "no",
      how_did_you_hear: "LinkedIn",
      custom: [{ question: "Why do you want to work at Discord?", answer: "I use it every day." }],
    }),
    email: "ahmed@example.com",
  };
  const { answers, pending } = autoAnswer(fields, ctx);

  it("fills contact data from the profile", () => {
    expect(answers.first_name?.value).toBe("Ahmed");
    expect(answers.last_name?.value).toBe("Al Test");
    expect(answers.email).toEqual({ value: "ahmed@example.com", source: "profile" });
    expect(answers.phone?.value).toBe("+966500000000");
    expect(answers.location?.value).toBe("Riyadh, Saudi Arabia");
    const linkedin = fields.find((f) => /linkedin/i.test(f.label))!;
    expect(answers[linkedin.key]?.value).toBe("https://linkedin.com/in/test");
  });

  it("maps saved answers onto the form's options", () => {
    const relocate = fields.find((f) => /relocate/i.test(f.label))!;
    expect(answers[relocate.key]).toEqual({
      value: relocate.options!.find((o) => o.label === "No")!.value,
      source: "bank",
    });
    const why = fields.find((f) => /why do you want/i.test(f.label))!;
    expect(answers[why.key]).toEqual({ value: "I use it every day.", source: "bank" });
  });

  it("declines voluntary disclosures and leaves the rest for AI", () => {
    const veteran = byKey(fields, "veteran_status")!;
    expect(answers.veteran_status).toEqual({ value: declineOption(veteran.options)!.value, source: "decline" });
    expect(pending.some((f) => /legally authorized/i.test(f.label))).toBe(true);
    expect(pending.some((f) => f.type === "file")).toBe(false);
  });

  it("reports missing required fields including files", () => {
    const missing = missingRequired({ fields }, answers, { cv: false, coverLetter: false });
    expect(missing.some((f) => f.key === "resume")).toBe(true);
    expect(missing.some((f) => /legally authorized/i.test(f.label))).toBe(true);
    expect(missing.some((f) => f.key === "email")).toBe(false);
  });
});

describe("answer helpers", () => {
  const yesNo: FormField = {
    key: "q",
    label: "Q",
    type: "select",
    required: true,
    group: "question",
    options: [
      { label: "Yes", value: "1" },
      { label: "No", value: "2" },
    ],
  };
  it("coerces text into field types", () => {
    expect(coerceAnswer(yesNo, "yes")).toBe("1");
    expect(coerceAnswer(yesNo, true)).toBe("1");
    expect(coerceAnswer(yesNo, "maybe")).toBeNull();
    expect(coerceAnswer({ ...yesNo, type: "boolean", options: undefined }, "No, I don't")).toBe(false);
    expect(coerceAnswer({ ...yesNo, type: "multiselect" }, "Yes | No")).toEqual(["1", "2"]);
    expect(coerceAnswer({ ...yesNo, type: "text", options: undefined }, "  hi ")).toBe("hi");
  });
  it("matches options loosely but not wrongly", () => {
    const opts = [
      { label: "English (ENG)", value: "English (ENG)" },
      { label: "Arabic (ARA)", value: "Arabic (ARA)" },
    ];
    expect(matchOption(opts, "arabic")?.value).toBe("Arabic (ARA)");
    expect(matchOption(opts, "French")).toBeNull();
    expect(similarity("Why do you want to join us?", "Why do you want to join Figma?")).toBeGreaterThan(0.5);
  });
  it("detects the job language", () => {
    expect(detectLanguage("نبحث عن مهندس برمجيات في الرياض")).toBe("ar");
    expect(detectLanguage("We are hiring a backend engineer")).toBe("en");
  });
});

describe("cover letter documents", () => {
  const base = {
    fullName: "Ahmed Test",
    contact: ["ahmed@example.com · +966500000000"],
    company: "Acme",
    jobTitle: "Backend Engineer",
    date: new Date("2026-10-09T00:00:00Z"),
  };

  it("renders an English PDF and Word file whose text reads back", async () => {
    const input = { ...base, body: "I build reliable payment systems.\n\nI would love to join Acme.", language: "en" as const };
    const pdf = await coverLetterPdf(input);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(await extractCvText(pdf, "application/pdf")).toContain("reliable payment systems");

    const docx = await coverLetterDocx(input);
    expect(docx.subarray(0, 2).toString()).toBe("PK");
    expect(
      await extractCvText(docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ).toContain("I would love to join Acme.");
  }, 30_000);

  it("renders Arabic right-to-left without failing", async () => {
    const pdf = await coverLetterPdf({ ...base, body: "أتقدم لوظيفة مهندس برمجيات بخبرة 5 سنوات.", language: "ar" });
    expect(pdf.byteLength).toBeGreaterThan(1000);
    const docx = await coverLetterDocx({ ...base, body: "أتقدم لوظيفة مهندس برمجيات.", language: "ar" });
    expect(
      await extractCvText(docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ).toContain("مهندس برمجيات");
  }, 30_000);

  it("names files safely", () => {
    expect(coverLetterFileName("Acme, Inc.", "Sr. Engineer / Payments", "pdf")).toBe("CoverLetter-Acme-Inc-Sr-Engineer-Payments.pdf");
    expect(coverLetterFileName("شركة أ", "مهندس", "docx")).toBe("CoverLetter-شركة-أ-مهندس.docx");
  });

  it("returns empty text for unreadable files", async () => {
    expect(await extractCvText(Buffer.from("not a pdf"), "application/pdf")).toBe("");
    expect(await extractCvText(Buffer.from("x"), "image/png")).toBe("");
  });
});
