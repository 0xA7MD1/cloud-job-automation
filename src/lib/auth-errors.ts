interface ErrorLike {
  statusCode?: number;
  error?: string;
  message?: string;
}

/** رسالة عربية مفهومة من خطأ InsForge، بدون تفاصيل داخلية. */
export function authErrorMessage(error: ErrorLike | null | undefined): string {
  if (!error) return "صار خطأ غير متوقع. جرّب مرة ثانية.";
  const text = `${error.error ?? ""} ${error.message ?? ""}`.toLowerCase();

  if (text.includes("verif")) return "بريدك ما تأكّد للحين. أدخل الرمز الي وصلك أو اطلب رمز جديد.";
  if (text.includes("already") || text.includes("exist") || error.statusCode === 409) {
    return "فيه حساب بهذا البريد. سجّل دخول أو استرجع كلمة المرور.";
  }
  if (text.includes("password") && (text.includes("weak") || text.includes("least") || text.includes("short"))) {
    return "كلمة المرور ضعيفة. استخدم 8 أحرف أو أكثر.";
  }
  if (text.includes("expired") || text.includes("invalid code") || text.includes("otp")) {
    return "الرمز غلط أو انتهت صلاحيته. اطلب رمز جديد.";
  }
  if (error.statusCode === 401 || text.includes("invalid") || text.includes("credentials")) {
    return "البريد أو كلمة المرور غلط.";
  }
  if (error.statusCode === 429) return "محاولات كثيرة. انتظر شوي وجرّب.";
  return "صار خطأ غير متوقع. جرّب مرة ثانية.";
}

export function needsEmailVerification(error: ErrorLike | null | undefined): boolean {
  if (!error) return false;
  const text = `${error.error ?? ""} ${error.message ?? ""}`.toLowerCase();
  // InsForge يرجّع 403 لبريد ما تأكّد. نعتمد على النص بعد عشان ما نخلط مع 403 ثانية.
  return text.includes("verif") && (error.statusCode === 403 || error.statusCode === 401);
}
