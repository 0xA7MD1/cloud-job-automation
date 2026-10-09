import { discardBody } from "@/lib/http";
import type { SupportedAts } from "@/lib/jobs/ats";
import { decodeEntities, htmlToText } from "@/lib/jobs/html";
import type { ApplicationForm, FieldOption, FieldType, FormField } from "./form";

// أسئلة نموذج التقديم من كل نظام توظيف، قبل فتح المتصفح (قاعدة 1).
// - Greenhouse: واجهة عامة موثّقة (?questions=true)
// - Lever: صفحة /apply نفسها (كل سؤال إضافي معه JSON في baseTemplate)
// - Ashby: GraphQL العام الي تستخدمه صفحة التقديم عندهم (غير موثّق: لو تغيّر نرجع للحقول الأساسية)

const TIMEOUT_MS = 20_000;
const UA = "Mozilla/5.0 (compatible; JobApplyBot/1.0)";

export function applyUrlFor(ats: SupportedAts, slug: string, externalId: string): string {
  const s = encodeURIComponent(slug);
  const id = encodeURIComponent(externalId);
  if (ats === "greenhouse") return `https://job-boards.greenhouse.io/embed/job_app?for=${s}&token=${id}`;
  if (ats === "lever") return `https://jobs.lever.co/${s}/${id}/apply`;
  return `https://jobs.ashbyhq.com/${s}/${id}/application`;
}

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const plain = (html: unknown): string | undefined => {
  const t = typeof html === "string" ? htmlToText(html, 2000) : "";
  return t || undefined;
};

function guessTextType(key: string, label: string): FieldType {
  const s = `${key} ${label}`.toLowerCase();
  if (/\be-?mail\b/.test(s)) return "email";
  if (/\bphone\b|mobile/.test(s)) return "phone";
  if (/linkedin|github|portfolio|website|\burl\b/.test(s)) return "url";
  return "text";
}

// ---------------------------------------------------------------------------
// Greenhouse
// ---------------------------------------------------------------------------
interface GhField {
  name: string;
  type: string;
  values?: { label: string; value: string | number }[];
}
interface GhQuestion {
  label: string;
  description?: string | null;
  required: boolean;
  fields: GhField[];
}

function ghField(q: GhQuestion, group: FormField["group"]): FormField | null {
  const fields = q.fields.filter((f) => f.type !== "input_hidden");
  // «Resume/CV» فيه ملف + نص: نرفع الملف دائمًا
  const f = fields.find((x) => x.type === "input_file") ?? fields[0];
  if (!f) return null;
  const label = text(q.label);
  const options = f.values?.map((v): FieldOption => ({ label: text(v.label), value: String(v.value) }));
  let type: FieldType;
  switch (f.type) {
    case "input_file":
      type = "file";
      break;
    case "textarea":
      type = "textarea";
      break;
    case "multi_value_single_select":
      type = "select";
      break;
    case "multi_value_multi_select":
      type = "multiselect";
      break;
    default:
      type = f.name === "location" ? "location" : guessTextType(f.name, label);
  }
  const file =
    type === "file" ? (f.name === "resume" ? "cv" : f.name === "cover_letter" ? "cover_letter" : "other") : undefined;
  return {
    key: f.name,
    label,
    description: plain(q.description),
    type,
    required: !!q.required,
    ...(options?.length ? { options } : {}),
    group: ["first_name", "last_name", "preferred_name", "email", "phone", "resume", "cover_letter", "location"].includes(f.name)
      ? "basic"
      : group,
    ...(file ? { file } : {}),
  };
}

export function parseGreenhouseForm(body: unknown): FormField[] {
  const b = (body ?? {}) as {
    questions?: GhQuestion[];
    location_questions?: GhQuestion[];
    compliance?: { questions?: GhQuestion[] }[] | null;
    demographic_questions?: {
      questions?: {
        id: number | string;
        label: string;
        required: boolean;
        type: string;
        answer_options?: { id: number | string; label: string; decline_to_answer?: boolean }[];
      }[];
    } | null;
  };
  const out: FormField[] = [];
  for (const q of b.questions ?? []) {
    const f = ghField(q, "question");
    if (f) out.push(f);
  }
  for (const q of b.location_questions ?? []) {
    const f = ghField(q, "basic");
    if (f) out.push(f);
  }
  for (const section of b.compliance ?? []) {
    for (const q of section.questions ?? []) {
      const f = ghField(q, "demographic");
      if (f) out.push({ ...f, group: "demographic" });
    }
  }
  for (const q of b.demographic_questions?.questions ?? []) {
    out.push({
      key: String(q.id),
      label: text(q.label),
      type: q.type === "multi_value_multi_select" ? "multiselect" : "select",
      required: !!q.required,
      options: (q.answer_options ?? []).map((o) => ({
        label: text(o.label),
        value: String(o.id),
        ...(o.decline_to_answer ? { decline: true } : {}),
      })),
      group: "demographic",
    });
  }
  // نفس الاسم ممكن يتكرر (compliance وdemographic): الأول يكفي
  const seen = new Set<string>();
  return out.filter((f) => (seen.has(f.key) ? false : (seen.add(f.key), true)));
}

// ---------------------------------------------------------------------------
// Lever: الحقول الثابتة من HTML، والأسئلة الإضافية من JSON في cards[...][baseTemplate]
// ---------------------------------------------------------------------------
const LEVER_BASIC: Record<string, { type: FieldType; file?: FormField["file"] }> = {
  name: { type: "text" },
  email: { type: "email" },
  phone: { type: "phone" },
  location: { type: "location" },
  org: { type: "text" },
  resume: { type: "file", file: "cv" },
  "urls[LinkedIn]": { type: "url" },
  "urls[GitHub]": { type: "url" },
  "urls[Twitter]": { type: "url" },
  "urls[Portfolio]": { type: "url" },
  "urls[Other]": { type: "url" },
  comments: { type: "textarea" },
};

const stripTags = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export function parseLeverForm(html: string): FormField[] {
  const out: FormField[] = [];

  // كل سؤال ثابت داخل <li class="application-question ..."> فيه عنوان وعنصر إدخال
  const items = html.split(/<li class="application-question/).slice(1);
  for (const item of items) {
    const end = item.indexOf("</li>");
    const chunk = end > 0 ? item.slice(0, end) : item.slice(0, 3000);
    const name = /<(?:input|textarea|select)[^>]*\bname="([^"]+)"/.exec(chunk)?.[1];
    if (!name || !(name in LEVER_BASIC)) continue;
    const labelHtml = /<div class="application-label[^"]*">([\s\S]*?)<\/div>/.exec(chunk)?.[1] ?? "";
    const spec = LEVER_BASIC[name]!;
    out.push({
      key: name,
      label: stripTags(labelHtml).replace(/✱/g, "").trim() || name,
      type: spec.type,
      required: /class="required"/.test(labelHtml) || new RegExp(`name="${name.replace(/[[\]]/g, "\\$&")}"[^>]*\\brequired\\b`).test(chunk),
      group: "basic",
      ...(spec.file ? { file: spec.file } : {}),
    });
  }
  if (/name="comments"/.test(html) && !out.some((f) => f.key === "comments")) {
    out.push({ key: "comments", label: "Additional information", type: "textarea", required: false, group: "basic" });
  }

  const cardRe = /<input[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = cardRe.exec(html))) {
    const tag = m[0];
    const cardId = /name="cards\[([^\]]+)\]\[baseTemplate\]"/.exec(tag)?.[1];
    const raw = /value="([^"]*)"/.exec(tag)?.[1];
    if (!cardId || !raw) continue;
    let card: { text?: string; fields?: { type: string; text: string; description?: string; required?: boolean; options?: { text: string }[] }[] };
    try {
      card = JSON.parse(decodeEntities(raw));
    } catch {
      continue;
    }
    (card.fields ?? []).forEach((f, i) => {
      const type: FieldType =
        f.type === "multiple-choice" || f.type === "dropdown"
          ? "select"
          : f.type === "multiple-select"
            ? "multiselect"
            : f.type === "textarea"
              ? "textarea"
              : f.type === "file-upload"
                ? "file"
                : guessTextType("", f.text ?? "");
      const options = (f.options ?? []).map((o) => ({ label: text(o.text), value: text(o.text) }));
      out.push({
        key: `cards[${cardId}][field${i}]`,
        label: text(f.text),
        description: text(f.description) || undefined,
        type,
        required: !!f.required,
        ...(options.length ? { options } : {}),
        group: "question",
        ...(type === "file" ? { file: "other" as const } : {}),
      });
    });
  }

  // أسئلة EEO (وظائف أمريكا): <select name="eeo[...]">
  const selectRe = /<select[^>]*name="(eeo\[[^\]]+\])"[^>]*>([\s\S]*?)<\/select>/g;
  while ((m = selectRe.exec(html))) {
    const options = [...m[2]!.matchAll(/<option[^>]*value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/g)]
      .filter((o) => o[1])
      .map((o) => ({ label: stripTags(o[2]!), value: decodeEntities(o[1]!) }));
    out.push({
      key: m[1]!,
      label: m[1]!.slice(4, -1),
      type: "select",
      required: false,
      options,
      group: "demographic",
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ashby
// ---------------------------------------------------------------------------
interface AshbyEntry {
  isRequired?: boolean;
  isHidden?: boolean;
  field?: {
    path?: string;
    title?: string;
    type?: string;
    selectableValues?: { label: string; value: string }[];
  };
}
interface AshbySection {
  fieldEntries?: AshbyEntry[];
}

const ASHBY_TYPES: Record<string, FieldType> = {
  String: "text",
  Email: "email",
  Phone: "phone",
  LongText: "textarea",
  File: "file",
  Boolean: "boolean",
  ValueSelect: "select",
  MultiValueSelect: "multiselect",
  Location: "location",
  Date: "date",
  Number: "number",
  SocialLink: "url",
};

export function parseAshbyForm(body: unknown): FormField[] {
  const posting = (body as { data?: { jobPosting?: Record<string, unknown> | null } })?.data?.jobPosting;
  if (!posting) return [];
  const app = (posting.applicationForm as { sections?: AshbySection[] } | null)?.sections ?? [];
  const surveys = ((posting.surveyForms as { sections?: AshbySection[] }[] | null) ?? []).flatMap((f) => f.sections ?? []);

  const toField = (entry: AshbyEntry, survey: boolean): FormField | null => {
    const f = entry.field;
    if (!f?.path || entry.isHidden) return null;
    const label = text(f.title);
    let type = ASHBY_TYPES[f.type ?? ""] ?? "text";
    if (type === "text") type = guessTextType(f.path, label);
    const file =
      type === "file" ? (f.path === "_systemfield_resume" ? "cv" : /cover/i.test(label) ? "cover_letter" : "other") : undefined;
    const options = f.selectableValues?.map((v) => ({ label: text(v.label), value: String(v.value) }));
    const basic = /^_systemfield_(name|email|resume|location|phone)/.test(f.path) || type === "email" || type === "phone";
    return {
      key: f.path,
      label,
      type,
      required: !!entry.isRequired,
      ...(options?.length ? { options } : {}),
      group: survey || f.path.startsWith("_systemfield_eeoc") ? "demographic" : basic || file ? "basic" : "question",
      ...(file ? { file } : {}),
    };
  };

  const out: FormField[] = [];
  for (const s of app) for (const e of s.fieldEntries ?? []) {
    const f = toField(e, false);
    if (f) out.push(f);
  }
  for (const s of surveys) for (const e of s.fieldEntries ?? []) {
    const f = toField(e, true);
    if (f) out.push(f);
  }
  return out;
}

const ASHBY_QUERY = `query ApiJobPosting($organizationHostedJobsPageName: String!, $jobPostingId: String!) {
  jobPosting(organizationHostedJobsPageName: $organizationHostedJobsPageName, jobPostingId: $jobPostingId) {
    id
    applicationForm { sections { fieldEntries { ... on FormFieldEntry { id field isRequired isHidden } } } }
    surveyForms { sections { fieldEntries { ... on FormFieldEntry { id field isRequired isHidden } } } }
  }
}`;

// ---------------------------------------------------------------------------
// الجلب
// ---------------------------------------------------------------------------

/** لو الأسئلة ما وصلت: الحقول الي تكون في كل نموذج تقريبًا */
export function basicFields(ats: SupportedAts): FormField[] {
  const names =
    ats === "greenhouse"
      ? { name: ["first_name", "last_name"], email: "email", phone: "phone", cv: "resume" }
      : ats === "lever"
        ? { name: ["name"], email: "email", phone: "phone", cv: "resume" }
        : { name: ["_systemfield_name"], email: "_systemfield_email", phone: "phone", cv: "_systemfield_resume" };
  return [
    ...names.name.map((key) => ({ key, label: key.replace(/_/g, " "), type: "text" as const, required: true, group: "basic" as const })),
    { key: names.email, label: "Email", type: "email", required: true, group: "basic" },
    { key: names.phone, label: "Phone", type: "phone", required: false, group: "basic" },
    { key: names.cv, label: "Resume/CV", type: "file", required: true, group: "basic", file: "cv" },
  ];
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch {
    return null;
  }
}

async function readJson(response: Response | null): Promise<unknown> {
  if (!response?.ok) {
    discardBody(response);
    return null;
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function readText(response: Response | null): Promise<string | null> {
  if (!response?.ok) {
    discardBody(response);
    return null;
  }
  try {
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * أسئلة نموذج التقديم لوظيفة. ما يرمي: لو فشل الجلب يرجّع الحقول الأساسية
 * مع complete: false، والباقي ينكشف وقت التعبئة (ويطلب تدخل المستخدم لو لزم).
 */
export async function fetchApplicationForm(ats: SupportedAts, slug: string, externalId: string): Promise<ApplicationForm> {
  const applyUrl = applyUrlFor(ats, slug, externalId);
  let fields: FormField[] = [];

  if (ats === "greenhouse") {
    const body = await readJson(
      await fetchWithTimeout(
        `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(externalId)}?questions=true`,
        { headers: { Accept: "application/json" } },
      ),
    );
    fields = body ? parseGreenhouseForm(body) : [];
  } else if (ats === "lever") {
    const html = await readText(await fetchWithTimeout(applyUrl, { headers: { "User-Agent": UA, Accept: "text/html" } }));
    fields = html ? parseLeverForm(html) : [];
  } else {
    const body = await readJson(
      await fetchWithTimeout("https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobPosting", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          operationName: "ApiJobPosting",
          variables: { organizationHostedJobsPageName: slug, jobPostingId: externalId },
          query: ASHBY_QUERY,
        }),
      }),
    );
    fields = body ? parseAshbyForm(body) : [];
  }

  const complete = fields.some((f) => f.file === "cv") && fields.some((f) => f.type === "email");
  return {
    ats,
    applyUrl,
    fetchedAt: new Date().toISOString(),
    complete,
    fields: complete ? fields : basicFields(ats),
  };
}
