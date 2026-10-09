import path from "node:path";
import { AlignmentType, Document as DocxDocument, Packer, Paragraph, TextRun } from "docx";
import { createElement as h } from "react";
import { Document, Font, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";

// خطاب التقديم كملف Word وPDF. يشتغل داخل مهام Trigger.dev (مو في Vercel).
// الخط في assets/fonts ينسخه additionalFiles في trigger.config.ts. العربي
// انجرّب: الحروف متصلة والاتجاه صحيح مع direction: rtl.

export interface CoverLetterInput {
  body: string;
  fullName: string;
  contact: string[];
  company: string;
  jobTitle: string;
  date: Date;
  language: "en" | "ar";
}

const FONT_FAMILY = "NotoNaskhArabic";
let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered) return;
  const dir = path.join(process.cwd(), "assets", "fonts");
  Font.register({
    family: FONT_FAMILY,
    fonts: [
      { src: path.join(dir, "NotoNaskhArabic-Regular.ttf") },
      { src: path.join(dir, "NotoNaskhArabic-Bold.ttf"), fontWeight: "bold" },
    ],
  });
  // بدون تقطيع كلمات بشَرطات
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

function paragraphs(body: string): string[] {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

function formatDate(date: Date, language: "en" | "ar"): string {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function labels(language: "en" | "ar", input: CoverLetterInput) {
  return language === "ar"
    ? { re: `الموضوع: التقديم على وظيفة ${input.jobTitle} — ${input.company}`, closing: "مع خالص التحية،" }
    : { re: `Re: ${input.jobTitle} — ${input.company}`, closing: "Sincerely," };
}

export async function coverLetterPdf(input: CoverLetterInput): Promise<Buffer> {
  registerFonts();
  const rtl = input.language === "ar";
  const align = rtl ? "right" : "left";
  const l = labels(input.language, input);
  const line = (text: string, style: Record<string, unknown> = {}) =>
    h(Text, { style: { textAlign: align, ...style } }, text);

  const doc = h(
    Document,
    { title: `Cover letter — ${input.jobTitle}`, author: input.fullName, language: input.language },
    h(
      Page,
      { size: "A4", style: { paddingVertical: 56, paddingHorizontal: 60, fontFamily: FONT_FAMILY, fontSize: 11, lineHeight: 1.5 } },
      h(
        View,
        { style: { direction: rtl ? "rtl" : "ltr" } },
        line(input.fullName, { fontSize: 16, fontWeight: "bold" }),
        ...input.contact.map((c) => line(c, { fontSize: 9.5, color: "#555555" })),
        line(formatDate(input.date, input.language), { marginTop: 18, fontSize: 10, color: "#555555" }),
        line(l.re, { marginTop: 10, fontWeight: "bold" }),
        ...paragraphs(input.body).map((p) => line(p, { marginTop: 10 })),
        line(l.closing, { marginTop: 18 }),
        line(input.fullName, { fontWeight: "bold" }),
      ),
    ),
  );
  return renderToBuffer(doc);
}

export async function coverLetterDocx(input: CoverLetterInput): Promise<Buffer> {
  const rtl = input.language === "ar";
  const font = rtl ? "Arial" : "Calibri";
  const l = labels(input.language, input);
  const para = (text: string, opts: { bold?: boolean; size?: number; before?: number; color?: string } = {}) =>
    new Paragraph({
      bidirectional: rtl,
      alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
      spacing: { before: opts.before ?? 0, after: 0, line: 300 },
      children: [
        new TextRun({
          text,
          bold: opts.bold,
          size: opts.size ?? 22,
          color: opts.color,
          font,
          rightToLeft: rtl,
        }),
      ],
    });

  const doc = new DocxDocument({
    creator: input.fullName,
    title: `Cover letter — ${input.jobTitle}`,
    sections: [
      {
        properties: { page: { margin: { top: 1100, bottom: 1100, left: 1200, right: 1200 } } },
        children: [
          para(input.fullName, { bold: true, size: 32 }),
          ...input.contact.map((c) => para(c, { size: 19, color: "555555" })),
          para(formatDate(input.date, input.language), { before: 360, size: 20, color: "555555" }),
          para(l.re, { before: 200, bold: true }),
          ...paragraphs(input.body).map((p) => para(p, { before: 200 })),
          para(l.closing, { before: 360 }),
          para(input.fullName, { bold: true }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

/** اسم ملف آمن: CoverLetter-Company-Title */
export function coverLetterFileName(company: string, jobTitle: string, ext: "pdf" | "docx"): string {
  const clean = (s: string) =>
    s
      .normalize("NFC")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  return `CoverLetter-${clean(company) || "Company"}-${clean(jobTitle) || "Role"}.${ext}`;
}
