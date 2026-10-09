"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// سكربت next-themes يشتغل من HTML الخادم قبل أول رسم. على المتصفح نعلّمه text/plain
// عشان React ما يحذّر من وسم script داخل مكوّن (الطريقة الي توصي فيها وثائق Next).
const scriptProps = {
  type: typeof window === "undefined" ? "text/javascript" : "text/plain",
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      scriptProps={scriptProps}
    >
      {children}
    </NextThemesProvider>
  );
}
