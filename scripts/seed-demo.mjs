// بيانات وهمية لتجربة الواجهة على مشروع InsForge الحقيقي: شركات ووظائف وطلبات بكل
// الحالات، ومحادثتين، وسيرة ذاتية وخطابات (PDF/Word) وصورة تأكيد تقديم.
//
//   pnpm seed:demo                     يمسح البيانات الوهمية ويضيفها من جديد
//   pnpm seed:demo --email you@x.com   لحساب معيّن (الافتراضي: الحساب الوحيد في المشروع)
//   pnpm seed:demo:clean               يمسحها كلها
//
// الأمان:
// - الشركات على نطاقات .example وروابط التقديم على example.com: لو ضغطت «قدّم» على
//   طلب وهمي يفشل عند فتح الصفحة، وما يوصل شي لأي شركة.
// - الملف الشخصي الوهمي اسمه ينتهي بـ"(Demo)"، وما ينكتب فوق ملف شخصي حقيقي.
//   امسح البيانات الوهمية قبل أي تقديم حقيقي.
// - المعرّفات ثابتة (de7e00xx-...) عشان المسح يلمس البيانات الوهمية بس.

import { createAdminClient } from "@insforge/sdk";
import { createElement as h } from "react";
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { coverLetterDocx, coverLetterFileName, coverLetterPdf } from "../src/lib/apply/documents.ts";

process.loadEnvFile(".env.local");

const BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL;
const API_KEY = process.env.INSFORGE_API_KEY;
if (!BASE_URL || !API_KEY) {
  console.error("ناقص NEXT_PUBLIC_INSFORGE_URL أو INSFORGE_API_KEY في .env.local");
  process.exit(1);
}

const admin = createAdminClient({ baseUrl: BASE_URL, apiKey: API_KEY });
const BUCKET = "user-files";
const DEMO_SUFFIX = "(Demo)";

const args = process.argv.slice(2);
const cleanOnly = args.includes("--clean");
const emailArg = args.includes("--email") ? args[args.indexOf("--email") + 1] : undefined;

// ---------------------------------------------------------------------------
// أدوات
// ---------------------------------------------------------------------------

const T = { company: "01", job: "02", app: "03", file: "04", chat: "05", search: "06" };
const uid = (table, n) => `de7e00${table}-0000-4000-8000-${String(n).padStart(12, "0")}`;
/** كل المعرّفات الوهمية الممكنة لجدول (للمسح) */
const allIds = (table) => Array.from({ length: 50 }, (_, i) => uid(table, i + 1));

const now = Date.now();
const ago = (days, hours = 0, minutes = 0) =>
  new Date(now - ((days * 24 + hours) * 60 + minutes) * 60_000).toISOString();

async function must(query, what) {
  const { data, error } = await query;
  if (error) throw new Error(`${what}: ${error.message ?? JSON.stringify(error)}`);
  return data;
}

async function resolveUser() {
  const res = await fetch(`${BASE_URL}/api/auth/users?limit=100`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`ما قدرت أقرأ الحسابات: HTTP ${res.status}`);
  const users = (await res.json()).data ?? [];
  if (emailArg) {
    const user = users.find((u) => u.email?.toLowerCase() === emailArg.toLowerCase());
    if (!user) throw new Error(`ما فيه حساب بالبريد ${emailArg}`);
    return user;
  }
  if (users.length === 1) return users[0];
  throw new Error(users.length === 0 ? "ما فيه حسابات: سجّل في الموقع أول." : "فيه أكثر من حساب: حدد --email.");
}

// ---------------------------------------------------------------------------
// المسح
// ---------------------------------------------------------------------------

async function clean(userId) {
  const jobIds = allIds(T.job);

  // كل الطلبات على وظائف وهمية، حتى الي انضافت من الواجهة بعد البذر، مع ملفاتها المولّدة
  const apps = await must(
    admin.database
      .from("applications")
      .select("id, cover_letter_file_id, cover_letter_docx_file_id, evidence_file_id")
      .in("job_id", jobIds),
    "قراءة الطلبات",
  );
  const generated = apps
    .flatMap((a) => [a.cover_letter_file_id, a.cover_letter_docx_file_id, a.evidence_file_id])
    .filter(Boolean);
  if (apps.length > 0) {
    await must(admin.database.from("applications").delete().in("id", apps.map((a) => a.id)), "حذف الطلبات");
  }

  // الرسائل وuser_jobs وuser_companies تنحذف معها (on delete cascade)
  await must(admin.database.from("chats").delete().in("id", allIds(T.chat)), "حذف المحادثات");
  await must(admin.database.from("searches").delete().in("id", allIds(T.search)), "حذف البحوث");
  await must(admin.database.from("jobs").delete().in("id", jobIds), "حذف الوظائف");
  await must(admin.database.from("companies").delete().in("id", allIds(T.company)), "حذف الشركات");

  const files = await must(
    admin.database.from("files").select("id, kind, bucket, object_key").in("id", [...allIds(T.file), ...generated]),
    "قراءة الملفات",
  );
  // خطاب رفعه المستخدم بنفسه (cover_letter) ما نلمسه
  const removable = files.filter((f) => f.id.startsWith("de7e00") || f.kind === "document" || f.kind === "evidence");
  if (removable.length > 0) {
    await admin.storage.from(BUCKET).remove(removable.map((f) => f.object_key));
    await must(admin.database.from("files").delete().in("id", removable.map((f) => f.id)), "حذف الملفات");
  }

  await must(
    admin.database.from("profiles").delete().eq("user_id", userId).like("full_name", `%${DEMO_SUFFIX}`),
    "حذف الملف الشخصي الوهمي",
  );
}

// ---------------------------------------------------------------------------
// البيانات
// ---------------------------------------------------------------------------

const PERSONA = {
  fullName: `Faisal Al-Harbi ${DEMO_SUFFIX}`,
  first: "Faisal",
  last: "Al-Harbi",
  email: "faisal.demo@example.com",
  phone: "+966 50 000 0000",
  linkedin: "https://linkedin.example/in/faisal-alharbi",
  github: "https://github.example/faisal-alharbi",
  portfolio: "https://faisal.example",
};

const COMPANIES = [
  { n: 1, name: "Nakhla Pay", domain: "nakhlapay.example", ats: "greenhouse", city: "Riyadh", country: "Saudi Arabia", description: "Payments and buy-now-pay-later platform for Saudi merchants." },
  { n: 2, name: "Sahm Analytics", domain: "sahm.example", ats: "lever", city: "Riyadh", country: "Saudi Arabia", description: "Market data and analytics APIs for investors across MENA." },
  { n: 3, name: "Wadi Cloud", domain: "wadicloud.example", ats: "greenhouse", city: "Riyadh", country: "Saudi Arabia", description: "Sovereign cloud and managed Kubernetes for banks and government." },
  { n: 4, name: "Rihla", domain: "rihla.example", ats: "ashby", city: "Jeddah", country: "Saudi Arabia", description: "Travel booking super-app for Umrah, Hajj and leisure trips." },
  { n: 5, name: "Qamar Health", domain: "qamarhealth.example", ats: "lever", city: "Dubai", country: "United Arab Emirates", description: "Telemedicine and digital clinic software." },
  { n: 6, name: "Manara Logistics", domain: "manara.example", ats: "unknown", city: "Dammam", country: "Saudi Arabia", description: "Last-mile delivery and fleet tracking." },
];
const companyById = new Map(COMPANIES.map((c) => [c.n, c]));

// list = تبويب صفحة الوظائف (new / saved / dismissed)
const JOBS = [
  { n: 1, c: 1, title: "Senior Backend Engineer (Node.js)", location: "Riyadh, Saudi Arabia", wp: "hybrid", dept: "Engineering", posted: 9, list: "saved", score: 92, reason: "Node.js + payments experience match your profile." },
  { n: 2, c: 1, title: "Mobile Engineer (React Native)", location: "Riyadh, Saudi Arabia", wp: "onsite", dept: "Engineering", posted: 8, list: "saved", score: 71 },
  { n: 3, c: 1, title: "Data Analyst", location: "Riyadh, Saudi Arabia", wp: "hybrid", dept: "Data", posted: 2, list: "new", score: 58 },
  { n: 4, c: 2, title: "Data Engineer", location: "Remote — Saudi Arabia", wp: "remote", dept: "Data Platform", posted: 6, list: "new", score: 84 },
  { n: 5, c: 2, title: "Analytics Engineer", location: "Remote — MENA", wp: "remote", dept: "Data Platform", posted: 1, list: "new", score: 77 },
  { n: 6, c: 2, title: "Junior Frontend Developer", location: "Riyadh, Saudi Arabia", wp: "onsite", dept: "Product", posted: 5, list: "dismissed" },
  { n: 7, c: 3, title: "Platform Engineer (Kubernetes)", location: "Riyadh, Saudi Arabia", wp: "hybrid", dept: "Infrastructure", posted: 4, list: "saved", score: 88 },
  { n: 8, c: 3, title: "Site Reliability Engineer", location: "Riyadh, Saudi Arabia", wp: "onsite", dept: "Infrastructure", posted: 7, list: "saved", score: 80 },
  { n: 9, c: 3, title: "Cloud Solutions Architect", location: "Riyadh, Saudi Arabia", wp: "hybrid", dept: "Customer Engineering", posted: 0, list: "new", score: 66 },
  { n: 10, c: 4, title: "Product Designer", location: "Jeddah, Saudi Arabia", wp: "hybrid", dept: "Design", posted: 3, list: "saved", score: 74 },
  { n: 11, c: 4, title: "Growth Marketing Manager", location: "Jeddah, Saudi Arabia", wp: "onsite", dept: "Marketing", posted: 10, list: "saved" },
  { n: 12, c: 4, title: "Senior iOS Engineer", location: "Remote", wp: "remote", dept: "Engineering", posted: 20, list: "saved", closed: 2 },
  { n: 13, c: 5, title: "Frontend Engineer (React)", location: "Dubai, UAE", wp: "remote", dept: "Engineering", posted: 12, list: "saved", score: 90 },
  { n: 14, c: 5, title: "QA Automation Engineer", location: "Dubai, UAE", wp: "hybrid", dept: "Quality", posted: 1, list: "new", score: 62 },
  { n: 15, c: 5, title: "Engineering Manager", location: "Dubai, UAE", wp: "onsite", dept: "Engineering", posted: 6, list: "dismissed" },
];
const jobById = new Map(JOBS.map((j) => [j.n, j]));

const SOURCE_BY_ATS = { greenhouse: "greenhouse", lever: "lever", ashby: "ashby", unknown: "manual" };
const jobUrl = (job) => `https://example.com/demo-jobs/${companyById.get(job.c).domain.split(".")[0]}/${job.n}`;

function jobDescription(job, company) {
  return [
    `${company.name} — ${company.description}`,
    `We're hiring a ${job.title} to join our ${job.dept} team in ${job.location}.`,
    "What you'll do:\n- Design, build and own production services end to end\n- Work closely with product and design on customer-facing features\n- Improve reliability, observability and developer experience",
    "What we're looking for:\n- 4+ years of relevant experience\n- Strong communication in English; Arabic is a plus\n- Comfortable with ambiguity and fast iteration",
    "(Demo listing — this job does not exist.)",
  ].join("\n\n");
}

// --- نماذج التقديم -----------------------------------------------------------

const YES_NO = [
  { label: "Yes", value: "Yes" },
  { label: "No", value: "No" },
];

const basicFields = () => [
  { key: "first_name", label: "First Name", type: "text", required: true, group: "basic" },
  { key: "last_name", label: "Last Name", type: "text", required: true, group: "basic" },
  { key: "email", label: "Email", type: "email", required: true, group: "basic" },
  { key: "phone", label: "Phone", type: "phone", required: true, group: "basic" },
  { key: "resume", label: "Resume/CV", type: "file", required: true, group: "basic", file: "cv" },
  { key: "cover_letter", label: "Cover Letter", type: "file", required: false, group: "basic", file: "cover_letter" },
];

const basicAnswers = () => ({
  first_name: { value: PERSONA.first, source: "profile" },
  last_name: { value: PERSONA.last, source: "profile" },
  email: { value: PERSONA.email, source: "profile" },
  phone: { value: PERSONA.phone, source: "profile" },
});

const form = (ats, job, fields, complete = true) => ({
  ats,
  applyUrl: `${jobUrl(job)}/apply`,
  fetchedAt: ago(job.posted > 1 ? job.posted - 1 : 0),
  complete,
  fields,
});

function greenhouseForm(job, company) {
  return form("greenhouse", job, [
    ...basicFields(),
    { key: "question_linkedin", label: "LinkedIn Profile", type: "url", required: false, group: "question" },
    { key: "question_auth", label: "Are you legally authorized to work in Saudi Arabia?", type: "select", required: true, group: "question", options: YES_NO },
    { key: "question_sponsor", label: "Will you now or in the future require visa sponsorship?", type: "select", required: true, group: "question", options: YES_NO },
    { key: "question_salary", label: "What are your salary expectations (SAR / month)?", type: "text", required: true, group: "question" },
    { key: "question_why", label: `Why do you want to join ${company.name}?`, type: "textarea", required: true, group: "question" },
    { key: "question_notice", label: "What is your notice period?", type: "text", required: false, group: "question" },
    {
      key: "gender",
      label: "Gender",
      type: "select",
      required: false,
      group: "demographic",
      options: [
        { label: "Male", value: "1" },
        { label: "Female", value: "2" },
        { label: "Decline To Self Identify", value: "3", decline: true },
      ],
    },
  ]);
}

function greenhouseAnswers(company, why) {
  return {
    ...basicAnswers(),
    question_linkedin: { value: PERSONA.linkedin, source: "profile" },
    question_auth: { value: "Yes", source: "bank" },
    question_sponsor: { value: "No", source: "bank" },
    question_salary: { value: "28,000 SAR / month", source: "bank" },
    question_why: { value: why ?? `I've followed ${company.name} for a while and want to work on systems that real merchants depend on every day.`, source: "ai", review: true },
    question_notice: { value: "30 days", source: "bank" },
    gender: { value: "3", source: "decline" },
  };
}

function leverForm(job) {
  return form("lever", job, [
    { key: "name", label: "Full name", type: "text", required: true, group: "basic" },
    { key: "email", label: "Email", type: "email", required: true, group: "basic" },
    { key: "phone", label: "Phone", type: "phone", required: false, group: "basic" },
    { key: "org", label: "Current company", type: "text", required: false, group: "basic" },
    { key: "urls[LinkedIn]", label: "LinkedIn URL", type: "url", required: false, group: "basic" },
    { key: "urls[GitHub]", label: "GitHub URL", type: "url", required: false, group: "basic" },
    { key: "resume", label: "Resume/CV", type: "file", required: true, group: "basic", file: "cv" },
    { key: "cards[q1]", label: "How many years of professional experience do you have with the main stack of this role?", type: "text", required: true, group: "question" },
    { key: "comments", label: "Additional information", type: "textarea", required: false, group: "question" },
  ]);
}

function leverAnswers(extra) {
  return {
    name: { value: `${PERSONA.first} ${PERSONA.last}`, source: "profile" },
    email: { value: PERSONA.email, source: "profile" },
    phone: { value: PERSONA.phone, source: "profile" },
    org: { value: "Tabadul Digital (demo)", source: "profile" },
    "urls[LinkedIn]": { value: PERSONA.linkedin, source: "profile" },
    "urls[GitHub]": { value: PERSONA.github, source: "profile" },
    "cards[q1]": { value: "5 years", source: "ai" },
    comments: { value: extra, source: "ai", review: true },
  };
}

function ashbyForm(job) {
  return form(
    "ashby",
    job,
    [
      { key: "_systemfield_name", label: "Name", type: "text", required: true, group: "basic" },
      { key: "_systemfield_email", label: "Email", type: "email", required: true, group: "basic" },
      { key: "_systemfield_resume", label: "Resume", type: "file", required: true, group: "basic", file: "cv" },
      { key: "phone", label: "Phone number", type: "phone", required: false, group: "basic" },
      { key: "portfolio", label: "Portfolio link", type: "url", required: true, group: "question" },
      { key: "proud_project", label: "Tell us about a product you designed that you're proud of.", type: "textarea", required: true, group: "question" },
      { key: "arabic", label: "Do you speak Arabic fluently?", type: "boolean", required: false, group: "question" },
      {
        key: "location_pref",
        label: "Preferred work location",
        type: "select",
        required: true,
        group: "question",
        options: [
          { label: "Jeddah office", value: "Jeddah office" },
          { label: "Riyadh office", value: "Riyadh office" },
          { label: "Remote (KSA)", value: "Remote (KSA)" },
        ],
      },
    ],
    false,
  );
}

const COVER_EN = (company, title) =>
  `I'm excited to apply for the ${title} role at ${company}. Over the last five years I've built and operated backend and data systems for payment and e-commerce products in Riyadh, most recently leading a small team that moved a monolith to event-driven services handling around two million transactions a day.

What draws me to ${company} is the focus on products people rely on daily. I enjoy owning services end to end — from design reviews to on-call — and I care a lot about clear APIs, good observability and boring, reliable deployments.

I'd welcome the chance to talk about how I can help the team ship faster without trading off reliability. Thank you for your time and consideration.`;

const COVER_AR = `يسعدني التقديم على وظيفة مصمم منتجات في رحلة. خلال السنوات الخمس الماضية صمّمت تجارب حجز ودفع لتطبيقات يستخدمها مئات الآلاف في السعودية، وآخرها إعادة تصميم رحلة الحجز التي رفعت نسبة إتمام الطلبات بنسبة ١٨٪.

أكثر ما يجذبني في رحلة هو التركيز على تجربة المعتمرين والزوار، وهي تجربة فيها تفاصيل كثيرة تحتاج فهمًا عميقًا للمستخدم. أحب العمل القريب من فرق الهندسة والمنتج، وأؤمن بالاختبار المبكر مع المستخدمين الحقيقيين.

أتطلع لفرصة الحديث معكم عن كيف أقدر أساهم في الفريق. شكرًا لوقتكم.`;

const OUTREACH_NAKHLA = {
  subject: "Senior Backend Engineer — Faisal Al-Harbi",
  email: `Hi Nakhla Pay team,

I just applied for the Senior Backend Engineer role. I've spent five years building payment backends in Node.js and would love to bring that experience to Nakhla Pay.

My CV is attached. Happy to share more about the services I've built.

Best regards,
Faisal Al-Harbi`,
  message: "السلام عليكم، قدّمت على وظيفة Senior Backend Engineer في نخلة باي. عندي خبرة ٥ سنوات في أنظمة الدفع بـNode.js، ويسعدني أتكلم معكم لو مناسب.",
};

// ---------------------------------------------------------------------------
// الملفات
// ---------------------------------------------------------------------------

async function cvPdf() {
  const text = (value, style = {}) => h(Text, { style }, value);
  const heading = (value) =>
    text(value, {
      fontFamily: "Helvetica-Bold",
      fontSize: 11.5,
      marginTop: 14,
      marginBottom: 5,
      paddingBottom: 2,
      borderBottomWidth: 1,
      borderBottomColor: "#bbbbbb",
    });
  const role = (title, place, dates, bullets) =>
    h(
      View,
      { style: { marginBottom: 8 } },
      text(`${title} — ${place}`, { fontFamily: "Helvetica-Bold" }),
      text(dates, { color: "#666666", fontSize: 9.5 }),
      ...bullets.map((b) => text(`•  ${b}`, { marginTop: 2 })),
    );

  const doc = h(
    Document,
    { title: "CV — Faisal Al-Harbi (Demo)", author: PERSONA.fullName },
    h(
      Page,
      { size: "A4", style: { padding: 48, fontFamily: "Helvetica", fontSize: 10.5, lineHeight: 1.45 } },
      text(PERSONA.fullName, { fontFamily: "Helvetica-Bold", fontSize: 20, lineHeight: 1.3 }),
      text("Senior Backend Engineer · Riyadh, Saudi Arabia", { fontSize: 11, color: "#444444" }),
      text(`${PERSONA.email} · ${PERSONA.phone} · ${PERSONA.linkedin}`, { fontSize: 9.5, color: "#666666", marginTop: 4 }),
      heading("Summary"),
      text(
        "Backend engineer with 5 years of experience building payment and e-commerce systems in Node.js and TypeScript. Led the move from a monolith to event-driven services processing ~2M transactions a day. (Demo CV — this person does not exist.)",
      ),
      heading("Experience"),
      role("Senior Backend Engineer", "Tabadul Digital (demo)", "2023 – present", [
        "Led a team of 4 rebuilding the payments ledger on PostgreSQL and Kafka.",
        "Cut p95 checkout latency from 900ms to 280ms.",
        "Owned on-call and incident reviews for the payments platform.",
      ]),
      role("Backend Engineer", "Souq Alyoum (demo)", "2021 – 2023", [
        "Built order and inventory APIs used by 3,000+ merchants.",
        "Introduced contract tests and OpenAPI-first development.",
      ]),
      heading("Skills"),
      text("TypeScript, Node.js, PostgreSQL, Redis, Kafka, Docker, Kubernetes, AWS, OpenTelemetry"),
      heading("Education"),
      text("B.Sc. Computer Science — King Saud University (demo), 2020"),
      heading("Languages"),
      text("Arabic (native), English (professional)"),
    ),
  );
  return renderToBuffer(doc);
}

async function evidencePng(company, title, ref) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;font-family:Segoe UI,Arial,sans-serif;background:#f4f6f8;color:#1d2433}
    header{background:#0f766e;color:#fff;padding:18px 40px;font-size:20px;font-weight:600}
    main{max-width:640px;margin:60px auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 12px #0001}
    h1{font-size:26px;margin:0 0 12px} p{font-size:16px;line-height:1.6;color:#4a5568}
    .ref{display:inline-block;margin-top:12px;padding:8px 14px;border-radius:8px;background:#ecfdf5;color:#065f46;font-weight:600}
    .demo{margin-top:28px;font-size:12px;color:#a0aec0}
  </style></head><body><header>${company} · Careers</header><main>
    <h1>Thank you for applying!</h1>
    <p>We've received your application for <b>${title}</b>. Our team will review it and get back to you soon.</p>
    <span class="ref">Application ID: ${ref}</span>
    <p class="demo">Demo confirmation page — not a real application.</p>
  </main></body></html>`;
  try {
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({ channel: process.env.LOCAL_BROWSER_CHANNEL || "chrome", headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1100, height: 640 } });
      await page.setContent(html);
      return await page.screenshot({ type: "png" });
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.warn(`  تخطّيت صورة التأكيد (ما قدرت أشغّل Chrome): ${error.message.split("\n")[0]}`);
    return null;
  }
}

async function uploadFile(userId, n, kind, fileName, mimeType, content, createdAt) {
  const id = uid(T.file, n);
  const objectKey = `${userId}/${kind}/${id}-${fileName}`;
  // بقايا تشغيل سابق انقطع قبل ما يسجّل الملف
  await admin.storage.from(BUCKET).remove(objectKey);
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(objectKey, new Blob([new Uint8Array(content)], { type: mimeType }));
  if (error) throw new Error(`رفع ${fileName}: ${error.message}`);
  return {
    id,
    user_id: userId,
    kind,
    bucket: BUCKET,
    object_key: objectKey,
    file_name: fileName,
    mime_type: mimeType,
    size_bytes: content.byteLength,
    created_at: createdAt,
  };
}

// ---------------------------------------------------------------------------
// البذر
// ---------------------------------------------------------------------------

async function seed(userId) {
  const PDF = "application/pdf";
  const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const contact = [PERSONA.email, PERSONA.phone, PERSONA.linkedin];
  const letter = (jobN, body, language) => {
    const job = jobById.get(jobN);
    return { body, fullName: PERSONA.fullName, contact, company: companyById.get(job.c).name, jobTitle: job.title, date: new Date(), language };
  };

  console.log("- الملفات (سيرة، خطابات، صورة تأكيد)");
  const nakhla = letter(1, COVER_EN("Nakhla Pay", jobById.get(1).title), "en");
  const rihla = letter(10, COVER_AR, "ar");
  const qamar = letter(13, COVER_EN("Qamar Health", jobById.get(13).title), "en");
  const evidence = await evidencePng("Qamar Health", jobById.get(13).title, "QH-48213");

  const files = [
    await uploadFile(userId, 1, "cv", "Faisal-Al-Harbi-CV.pdf", PDF, await cvPdf(), ago(12)),
    await uploadFile(userId, 2, "document", coverLetterFileName(nakhla.company, nakhla.jobTitle, "pdf"), PDF, await coverLetterPdf(nakhla), ago(1, 3)),
    await uploadFile(userId, 3, "document", coverLetterFileName(nakhla.company, nakhla.jobTitle, "docx"), DOCX, await coverLetterDocx(nakhla), ago(1, 3)),
    await uploadFile(userId, 4, "document", coverLetterFileName(rihla.company, rihla.jobTitle, "pdf"), PDF, await coverLetterPdf(rihla), ago(0, 20)),
    await uploadFile(userId, 5, "document", coverLetterFileName(rihla.company, rihla.jobTitle, "docx"), DOCX, await coverLetterDocx(rihla), ago(0, 20)),
    await uploadFile(userId, 6, "document", coverLetterFileName(qamar.company, qamar.jobTitle, "pdf"), PDF, await coverLetterPdf(qamar), ago(3, 2)),
  ];
  if (evidence) files.push(await uploadFile(userId, 7, "evidence", "confirmation-qamar-health.png", "image/png", evidence, ago(3)));
  await must(admin.database.from("files").insert(files), "تسجيل الملفات");
  const cvId = uid(T.file, 1);
  const evidenceId = evidence ? uid(T.file, 7) : null;

  console.log("- الملف الشخصي");
  const existing = await must(
    admin.database.from("profiles").select("user_id").eq("user_id", userId).maybeSingle(),
    "قراءة الملف الشخصي",
  );
  if (existing) {
    console.log("  عندك ملف شخصي حقيقي: ما لمسته");
  } else {
    await must(
      admin.database.from("profiles").insert([
        {
          user_id: userId,
          full_name: PERSONA.fullName,
          phone: PERSONA.phone,
          city: "Riyadh",
          country: "Saudi Arabia",
          headline: "Senior Backend Engineer — payments & data",
          summary:
            "Backend engineer with 5 years in Node.js/TypeScript building payment and e-commerce systems. Led a monolith-to-events migration handling ~2M transactions/day.",
          years_experience: 5,
          linkedin_url: PERSONA.linkedin,
          github_url: PERSONA.github,
          portfolio_url: PERSONA.portfolio,
          answers: {
            work_authorization: "Saudi Arabia (citizen)",
            requires_sponsorship: "no",
            willing_to_relocate: "yes",
            notice_period: "30 days",
            earliest_start_date: "Within 1 month of offer",
            expected_salary: "28,000 SAR / month",
            languages: "Arabic (native), English (professional)",
            how_did_you_hear: "Company careers page",
            decline_voluntary_disclosures: true,
            custom: [{ question: "Are you open to on-call rotations?", answer: "Yes, one week per month." }],
          },
          preferences: {
            target_roles: ["Backend Engineer", "Platform Engineer", "Data Engineer"],
            locations: ["Riyadh", "Remote"],
            workplace: "any",
            exclude_keywords: ["Intern", "Junior"],
          },
          default_cv_file_id: cvId,
          created_at: ago(12),
        },
      ]),
      "الملف الشخصي",
    );
  }

  console.log("- المحادثات والبحوث");
  const [chat1, chat2] = [uid(T.chat, 1), uid(T.chat, 2)];
  await must(
    admin.database.from("chats").insert([
      { id: chat1, user_id: userId, title: "شركات تقنية مالية في الرياض", created_at: ago(6), updated_at: ago(6) },
      { id: chat2, user_id: userId, title: "وظائف تصميم في جدة", created_at: ago(1), updated_at: ago(1) },
    ]),
    "المحادثات",
  );

  const companyResult = (n, snippet) => {
    const c = companyById.get(n);
    return { companyId: uid(T.company, n), name: c.name, domain: c.domain, url: `https://${c.domain}`, snippet, ats: c.ats };
  };
  const jobResult = (n) => {
    const j = jobById.get(n);
    return { jobId: uid(T.job, n), title: j.title, location: j.location, workplaceType: j.wp, department: j.dept, url: jobUrl(j), postedAt: ago(j.posted) };
  };
  const foundCompanies = [
    companyResult(1, "Nakhla Pay lets Saudi shoppers split payments into four, with instant settlement for merchants."),
    companyResult(2, "Sahm provides real-time Tadawul market data and analytics APIs."),
    companyResult(3, "Wadi Cloud runs sovereign cloud regions for regulated industries, including banks and fintechs."),
  ];
  const nakhlaJobs = [1, 2, 3].map(jobResult);
  const rihlaJobs = [10].map(jobResult);
  const [s1, s2, s3] = [uid(T.search, 1), uid(T.search, 2), uid(T.search, 3)];

  await must(
    admin.database.from("searches").insert([
      { id: s1, user_id: userId, chat_id: chat1, kind: "companies", provider: "tavily", query: "fintech companies", params: { location: "Riyadh", limit: 8 }, results: foundCompanies, result_count: 3, created_at: ago(6) },
      { id: s2, user_id: userId, chat_id: chat1, kind: "jobs", provider: "greenhouse", query: "Nakhla Pay", params: { companyId: uid(T.company, 1), keywords: [], location: null }, results: nakhlaJobs, result_count: 3, created_at: ago(6) },
      { id: s3, user_id: userId, chat_id: chat2, kind: "jobs", provider: "ashby", query: "Rihla: designer", params: { companyId: uid(T.company, 4), keywords: ["designer"], location: "Jeddah" }, results: rihlaJobs, result_count: 1, created_at: ago(1) },
    ]),
    "البحوث",
  );

  console.log("- الشركات والوظائف");
  await must(
    admin.database.from("companies").insert(
      COMPANIES.map((c) => ({
        id: uid(T.company, c.n),
        name: c.name,
        domain: c.domain,
        website_url: `https://${c.domain}`,
        careers_url: `https://${c.domain}/careers`,
        ats: c.ats,
        ats_slug: c.ats === "unknown" ? null : `demo-${c.domain.split(".")[0]}`,
        country: c.country,
        city: c.city,
        description: c.description,
        source: "manual",
        last_scanned_at: c.n === 1 ? ago(0, 3) : c.n === 3 ? ago(0, 5) : null,
        created_at: ago(14),
        updated_at: ago(0, 3),
      })),
    ),
    "الشركات",
  );

  await must(
    admin.database.from("jobs").insert(
      JOBS.map((j) => {
        const c = companyById.get(j.c);
        return {
          id: uid(T.job, j.n),
          company_id: uid(T.company, j.c),
          source: SOURCE_BY_ATS[c.ats],
          external_id: `demo-${j.n}`,
          title: j.title,
          location: j.location,
          workplace_type: j.wp,
          employment_type: "Full-time",
          department: j.dept,
          description: jobDescription(j, c),
          url: jobUrl(j),
          apply_url: `${jobUrl(j)}/apply`,
          posted_at: ago(j.posted),
          first_seen_at: ago(j.posted),
          last_seen_at: ago(0, 3),
          closed_at: j.closed ? ago(j.closed) : null,
          raw: { demo: true },
        };
      }),
    ),
    "الوظائف",
  );

  await must(
    admin.database.from("user_companies").insert([
      { user_id: userId, company_id: uid(T.company, 1), keywords: ["backend", "engineer"], created_at: ago(6) },
      { user_id: userId, company_id: uid(T.company, 3), keywords: [], created_at: ago(5) },
      { user_id: userId, company_id: uid(T.company, 6), keywords: ["engineer"], created_at: ago(4) },
    ]),
    "الشركات المتابعة",
  );

  await must(
    admin.database.from("user_jobs").insert(
      JOBS.map((j) => ({
        user_id: userId,
        job_id: uid(T.job, j.n),
        status: j.list,
        match_score: j.score ?? null,
        match_reason: j.reason ?? null,
        search_id: j.c === 1 ? s2 : j.n === 10 ? s3 : null,
        created_at: ago(j.posted),
        updated_at: ago(j.posted),
      })),
    ),
    "وظائفك",
  );

  console.log("- الطلبات (كل الحالات)");
  const app = (jobN, fields) => ({
    id: uid(T.app, jobN),
    user_id: userId,
    job_id: uid(T.job, jobN),
    cv_file_id: cvId,
    answers: {},
    form: {},
    outreach: {},
    ...fields,
  });
  const company = (n) => companyById.get(jobById.get(n).c);

  const apps = [
    // جاهز للمراجعة، كل شي مكتمل، وفيه مسودات تواصل
    app(1, {
      status: "ready",
      form: greenhouseForm(jobById.get(1), company(1)),
      answers: greenhouseAnswers(
        company(1),
        "Nakhla Pay is solving a problem I've worked on for years: making payments simple for Saudi merchants. I want to help scale the platform's backend while keeping it reliable.",
      ),
      cover_letter_text: nakhla.body,
      cover_letter_file_id: uid(T.file, 2),
      cover_letter_docx_file_id: uid(T.file, 3),
      outreach: OUTREACH_NAKHLA,
      prepared_at: ago(1, 3),
      created_at: ago(1, 4),
      updated_at: ago(1, 3),
    }),
    // جاهز لكن فيه سؤال مطلوب بدون إجابة، وخطاب بالعربي
    app(10, {
      status: "ready",
      form: ashbyForm(jobById.get(10)),
      answers: {
        _systemfield_name: { value: `${PERSONA.first} ${PERSONA.last}`, source: "profile" },
        _systemfield_email: { value: PERSONA.email, source: "profile" },
        phone: { value: PERSONA.phone, source: "profile" },
        portfolio: { value: PERSONA.portfolio, source: "profile" },
        arabic: { value: true, source: "bank" },
        location_pref: { value: "Jeddah office", source: "ai", review: true },
      },
      cover_letter_text: COVER_AR,
      cover_letter_file_id: uid(T.file, 4),
      cover_letter_docx_file_id: uid(T.file, 5),
      prepared_at: ago(0, 20),
      created_at: ago(1),
      updated_at: ago(0, 20),
    }),
    // ينتظرك (كابتشا) في متصفح جهازك
    app(4, {
      status: "needs_user",
      browser_provider: "local",
      form: leverForm(jobById.get(4)),
      answers: leverAnswers("I've built streaming pipelines on Kafka and dbt models for financial data; happy to share examples."),
      submit_attempted_at: ago(0, 0, 12),
      status_detail: "الموقع طلب تحقق (كابتشا): حلّه، والإرسال يكمل لحاله أو اضغط «إرسال».",
      prepared_at: ago(0, 2),
      created_at: ago(0, 3),
      updated_at: ago(0, 0, 11),
    }),
    // انرسل، مع رقم طلب ودليل
    app(13, {
      status: "submitted",
      browser_provider: "local",
      form: leverForm(jobById.get(13)),
      answers: leverAnswers("Most of my recent frontend work is React + TypeScript dashboards for internal payments tools."),
      cover_letter_text: qamar.body,
      cover_letter_file_id: uid(T.file, 6),
      submit_attempted_at: ago(3, 0, 5),
      submitted_at: ago(3),
      confirmation_ref: "QH-48213",
      evidence_file_id: evidenceId,
      prepared_at: ago(3, 2),
      created_at: ago(3, 3),
      updated_at: ago(3),
    }),
    // ما كمل: الصفحة ما فتحت (تقدر تعيد المحاولة)
    app(8, {
      status: "failed",
      browser_provider: "local",
      form: greenhouseForm(jobById.get(8), company(8)),
      answers: greenhouseAnswers(company(8)),
      error: "صفحة التقديم ما فتحت. جرّب مرة ثانية.",
      prepared_at: ago(2, 5),
      created_at: ago(2, 6),
      updated_at: ago(2, 4),
    }),
    // ما كمل بعد ما انضغط «إرسال»: ممكن انرسل (يطلب منك تأكيد يدوي)
    app(2, {
      status: "failed",
      browser_provider: "local",
      form: greenhouseForm(jobById.get(2), company(2)),
      answers: greenhouseAnswers(company(2)),
      submit_attempted_at: ago(2, 1),
      error: "انتهت مهلة الانتظار وما ظهرت صفحة تأكيد. ممكن الطلب انرسل: شيك بريدك قبل ما تعيد التقديم.",
      prepared_at: ago(2, 3),
      created_at: ago(2, 4),
      updated_at: ago(2),
    }),
    // ملغي قبل الإرسال
    app(11, {
      status: "cancelled",
      form: ashbyForm(jobById.get(11)),
      answers: {
        _systemfield_name: { value: `${PERSONA.first} ${PERSONA.last}`, source: "profile" },
        _systemfield_email: { value: PERSONA.email, source: "profile" },
      },
      prepared_at: ago(9),
      created_at: ago(9, 1),
      updated_at: ago(8),
    }),
    // مسودة ما تجهّزت
    app(5, { status: "draft", created_at: ago(0, 1), updated_at: ago(0, 1) }),
  ];
  await must(admin.database.from("applications").insert(apps), "الطلبات");

  const events = [];
  const event = (jobN, type, at, data = {}) =>
    events.push({ application_id: uid(T.app, jobN), user_id: userId, type, data, created_at: at });
  event(1, "created", ago(1, 4));
  event(1, "prepared", ago(1, 3));
  event(10, "created", ago(1));
  event(10, "prepared", ago(0, 20));
  event(4, "created", ago(0, 3));
  event(4, "prepared", ago(0, 2));
  event(4, "queued", ago(0, 0, 15), { provider: "local" });
  event(4, "started", ago(0, 0, 14));
  event(4, "submit_attempted", ago(0, 0, 12), { reason: "auto" });
  event(4, "needs_user", ago(0, 0, 11), { reason: "captcha" });
  event(13, "created", ago(3, 3));
  event(13, "prepared", ago(3, 2));
  event(13, "queued", ago(3, 0, 8), { provider: "local" });
  event(13, "started", ago(3, 0, 7));
  event(13, "submit_attempted", ago(3, 0, 5), { reason: "auto" });
  event(13, "submitted", ago(3), { confirmationRef: "QH-48213" });
  if (evidenceId) event(13, "evidence_saved", ago(3), { fileId: evidenceId });
  event(8, "created", ago(2, 6));
  event(8, "prepared", ago(2, 5));
  event(8, "queued", ago(2, 4, 5), { provider: "local" });
  event(8, "failed", ago(2, 4), { stage: "open", attempted: false });
  event(2, "created", ago(2, 4));
  event(2, "prepared", ago(2, 3));
  event(2, "queued", ago(2, 1, 5), { provider: "local" });
  event(2, "submit_attempted", ago(2, 1), { reason: "auto" });
  event(2, "failed", ago(2), { stage: "submit", attempted: true });
  event(11, "created", ago(9, 1));
  event(11, "prepared", ago(9));
  event(11, "cancelled", ago(8));
  event(5, "created", ago(0, 1));
  await must(admin.database.from("application_events").insert(events), "سجل الطلبات");

  console.log("- رسائل الشات");
  const tool = (name, callId, input, output) => ({ type: `tool-${name}`, toolCallId: callId, state: "output-available", input, output });
  const textPart = (text) => ({ type: "text", text, state: "done" });
  const userMsg = (chatId, id, at, text) => ({ id, chat_id: chatId, user_id: userId, role: "user", parts: [textPart(text)], created_at: at });
  const botMsg = (chatId, id, at, parts) => ({
    id,
    chat_id: chatId,
    user_id: userId,
    role: "assistant",
    parts: parts.flatMap((p) => [{ type: "step-start" }, p]),
    metadata: { provider: "groq", model: "llama-3.3-70b-versatile" },
    created_at: at,
  });
  const nakhlaRef = { id: uid(T.company, 1), name: "Nakhla Pay", domain: "nakhlapay.example", ats: "Greenhouse", boardUrl: "https://example.com/demo-jobs/nakhlapay" };
  const rihlaRef = { id: uid(T.company, 4), name: "Rihla", domain: "rihla.example", ats: "Ashby", boardUrl: "https://example.com/demo-jobs/rihla" };

  await must(
    admin.database.from("messages").insert([
      userMsg(chat1, "demo-c1-m1", ago(6), "أبي شركات تقنية مالية في الرياض"),
      botMsg(chat1, "demo-c1-m2", ago(6, 0, -1), [
        tool("searchCompanies", "demo-call-1", { query: "fintech companies", location: "Riyadh", limit: 8 }, { ok: true, searchId: s1, provider: "tavily", companies: foundCompanies }),
        textPart("لقيت 3 شركات في الرياض. **Nakhla Pay** و**Wadi Cloud** يستخدمون Greenhouse، و**Sahm** يستخدم Lever، فنقدر نقدّم عليهم تلقائيًا. تبي أعرض وظائف وحدة منهم؟"),
      ]),
      userMsg(chat1, "demo-c1-m3", ago(6, 0, -3), `اعرض الوظائف الرسمية في Nakhla Pay (companyId: ${uid(T.company, 1)})`),
      botMsg(chat1, "demo-c1-m4", ago(6, 0, -4), [
        tool("searchOfficialJobs", "demo-call-2", { companyId: uid(T.company, 1), limit: 10 }, { ok: true, searchId: s2, company: nakhlaRef, totalOpen: 3, matched: 3, jobs: nakhlaJobs }),
        textPart("عندهم 3 وظائف مفتوحة. الأقرب لملفك **Senior Backend Engineer (Node.js)**. أضفتها لصفحة الوظائف، وتقدر تضغط «جهّز الطلب» عليها."),
      ]),
      userMsg(chat1, "demo-c1-m5", ago(6, 0, -6), "تابع الشركة وبلغني بوظائف الباك إند"),
      botMsg(chat1, "demo-c1-m6", ago(6, 0, -7), [
        tool("followCompany", "demo-call-3", { companyId: uid(T.company, 1), keywords: ["backend", "engineer"] }, { ok: true, companyId: uid(T.company, 1) }),
        textPart("تم. بنفحص Nakhla Pay مرتين باليوم، وأي وظيفة فيها backend أو engineer تنضاف لصفحة الوظائف."),
      ]),
      userMsg(chat2, "demo-c2-m1", ago(1), "فيه وظائف تصميم منتجات في جدة؟"),
      botMsg(chat2, "demo-c2-m2", ago(1, 0, -1), [
        tool("searchOfficialJobs", "demo-call-4", { domain: "rihla.example", keywords: ["designer"], location: "Jeddah", limit: 10 }, { ok: true, searchId: s3, company: rihlaRef, totalOpen: 4, matched: 1, jobs: rihlaJobs }),
        textPart("لقيت وظيفة وحدة في **Rihla**: Product Designer في جدة (هجين). أجهّز لك الطلب؟"),
      ]),
      userMsg(chat2, "demo-c2-m3", ago(1, 0, -2), "ايه جهّزه"),
      botMsg(chat2, "demo-c2-m4", ago(1, 0, -3), [
        tool("prepareApplication", "demo-call-5", { jobId: uid(T.job, 10) }, { ok: true, applicationId: uid(T.app, 10), url: `/applications/${uid(T.app, 10)}` }),
        textPart("بدأ التجهيز. لما يخلص راجع الإجابات وخطاب التقديم، وفيه سؤال مطلوب عن مشروع تفتخر فيه لازم تكتبه بنفسك."),
      ]),
    ]),
    "الرسائل",
  );

  return { files: files.length, apps: apps.length, events: events.length };
}

// ---------------------------------------------------------------------------

const user = await resolveUser();
console.log(`الحساب: ${user.email}`);
console.log("مسح البيانات الوهمية القديمة…");
await clean(user.id);

if (cleanOnly) {
  console.log("خلاص: انمسحت.");
} else {
  console.log("إضافة البيانات الوهمية…");
  const counts = await seed(user.id);
  console.log(
    `خلاص: ${COMPANIES.length} شركات، ${JOBS.length} وظيفة، ${counts.apps} طلبات، ${counts.events} حدث، ${counts.files} ملفات، محادثتين.`,
  );
  console.log("امسحها قبل أي تقديم حقيقي: pnpm seed:demo:clean");
}
