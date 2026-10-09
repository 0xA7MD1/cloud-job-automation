import type { ApplicationStatus } from "@/lib/db/types";

// نصوص الواجهة لحالات الطلب وخطوات المهام (تنقرأ في المتصفح والخادم)

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: "مسودة",
  preparing: "يتجهّز",
  ready: "جاهز للمراجعة",
  queued: "بالطابور",
  running: "يتقدّم الحين",
  needs_user: "ينتظرك",
  submitted: "انرسل",
  failed: "ما كمل",
  cancelled: "ملغي",
};

export const STATUS_TONE: Record<ApplicationStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  preparing: "secondary",
  ready: "default",
  queued: "secondary",
  running: "secondary",
  needs_user: "destructive",
  submitted: "default",
  failed: "destructive",
  cancelled: "outline",
};

/** حالات فيها مهمة شغّالة (الصفحة تتابعها) */
export const ACTIVE_STATUSES: ApplicationStatus[] = ["preparing", "queued", "running", "needs_user"];

export const STEP_LABELS: Record<string, string> = {
  // التجهيز
  questions: "نقرأ أسئلة النموذج",
  cv: "نقرأ سيرتك",
  answers: "نعبّي من ملفك وبنك إجاباتك",
  ai: "الذكاء يكتب الإجابات وخطاب التقديم",
  documents: "نولّد ملفات الخطاب (PDF وWord)",
  // التقديم
  browser: "نفتح المتصفح",
  open: "نفتح صفحة التقديم",
  fill: "نعبّي النموذج",
  upload: "نرفع الملفات",
  review: "نتأكد من الحقول المطلوبة",
  submit: "نضغط «إرسال»",
  confirm: "ننتظر صفحة التأكيد",
  evidence: "نحفظ الدليل",
  needs_user: "ينتظر تدخلك",
  done: "خلصنا",
};

export const SOURCE_LABELS = {
  profile: "من ملفك",
  bank: "من بنك إجاباتك",
  ai: "كتبها الذكاء",
  user: "عدّلتها",
  decline: "رفض الإفصاح",
} as const;
