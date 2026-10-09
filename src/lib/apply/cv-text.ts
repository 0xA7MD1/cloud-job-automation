// نص السيرة الذاتية عشان الذكاء يكتب منها. يشتغل في مهام Trigger.dev.
// المحتوى ما يطلع في مدخلات أو مخرجات التشغيل (Trigger.dev يحفظها): يبقى في الذاكرة بس.

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_CHARS = 30_000;

function tidy(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_CHARS);
}

/** يرجّع "" لو الملف صورة ممسوحة أو نوعه غير مدعوم (التجهيز يكمّل بالملف الشخصي بس). */
export async function extractCvText(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    if (mimeType === PDF) {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });
      return tidy(text);
    }
    if (mimeType === DOCX) {
      const mammoth = await import("mammoth");
      const { value } = await (mammoth.default ?? mammoth).extractRawText({ buffer });
      return tidy(value);
    }
  } catch {
    // ملف تالف أو محمي بكلمة مرور
  }
  return "";
}
