// كوكيز مؤقتة لتدفق OAuth (PKCE). httpOnly، وتنحذف بعد الرجوع.
export const OAUTH_VERIFIER_COOKIE = "insforge_code_verifier";
export const OAUTH_NEXT_COOKIE = "oauth_next";

export const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 600,
} as const;
