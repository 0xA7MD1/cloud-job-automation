import { describe, expect, it } from "vitest";
import { buildObjectKey, isOwnedObjectKey, sanitizeFileName, validateUpload } from "./storage";

const USER = "11111111-1111-1111-1111-111111111111";

describe("sanitizeFileName", () => {
  it("keeps Arabic letters and the extension", () => {
    expect(sanitizeFileName("سيرة أحمد 2026.PDF")).toBe("سيرة-أحمد-2026.pdf");
  });

  it("strips path tricks and odd characters", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\Users\\me\\cv.pdf")).toBe("cv.pdf");
    expect(sanitizeFileName("cv (final)!!.docx")).toBe("cv-final.docx");
  });

  it("falls back when nothing is left", () => {
    expect(sanitizeFileName("###.pdf")).toBe("file.pdf");
  });
});

describe("buildObjectKey / isOwnedObjectKey", () => {
  it("builds a key inside the owner's folder", () => {
    const key = buildObjectKey(USER, "cv", "My CV.pdf", "abc");
    expect(key).toBe(`${USER}/cv/abc-My-CV.pdf`);
    expect(isOwnedObjectKey(key, USER, "cv")).toBe(true);
  });

  it("rejects keys of another user, another kind, or with traversal", () => {
    const other = "22222222-2222-2222-2222-222222222222";
    expect(isOwnedObjectKey(`${other}/cv/x.pdf`, USER, "cv")).toBe(false);
    expect(isOwnedObjectKey(`${USER}/other/x.pdf`, USER, "cv")).toBe(false);
    expect(isOwnedObjectKey(`${USER}/cv/../x.pdf`, USER, "cv")).toBe(false);
    expect(isOwnedObjectKey(`${USER}/cv/a/b.pdf`, USER, "cv")).toBe(false);
  });
});

describe("validateUpload", () => {
  it("accepts a small PDF CV", () => {
    expect(validateUpload("cv", { size: 1000, type: "application/pdf" })).toBeNull();
  });

  it("rejects images as CV, empty files and big files", () => {
    expect(validateUpload("cv", { size: 1000, type: "image/png" })).not.toBeNull();
    expect(validateUpload("cv", { size: 0, type: "application/pdf" })).not.toBeNull();
    expect(validateUpload("cv", { size: 6 * 1024 * 1024, type: "application/pdf" })).not.toBeNull();
  });
});
