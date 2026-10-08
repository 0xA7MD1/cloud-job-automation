import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
}

/**
 * المستخدم الحالي من InsForge (يتحقق من التوكن عند الخادم، مو بس من الكوكي).
 * cache() يخلي الطلب الواحد يسأل InsForge مرة وحدة مهما تكرر الاستدعاء.
 * يقرأ الكوكيز ⇒ استدعه داخل <Suspense>.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const insforge = await createInsForgeServerClient();
  const { data, error } = await insforge.auth.getCurrentUser();
  if (error || !data.user) return null;

  const { id, email, emailVerified, profile } = data.user;
  const name = typeof profile?.name === "string" && profile.name.trim() ? profile.name : null;
  return { id, email, name, emailVerified };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}
