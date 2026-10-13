import type { Metadata } from "next";
import { Geist_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { DirectionProvider } from "@/components/ui/direction";
import "./globals.css";

// خطوط ثمانية تنقرأ من الجهاز (globals.css)، وIBM Plex Sans Arabic بديلها لمن ما عنده ثمانية
const fontPlex = IBM_Plex_Sans_Arabic({
  // الأوزان المستخدمة بس: كل وزن ملفين (عربي ولاتيني) ينحمّلون مسبقًا
  weight: ["400", "500", "600", "700"],
  subsets: ["arabic", "latin"],
  variable: "--font-plex",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: {
    default: "مساعد التقديم",
    template: "%s · مساعد التقديم",
  },
  description: "يبحث عن الشركات ووظائفها الرسمية ويقدّم عنك.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${fontPlex.variable} ${fontMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <DirectionProvider dir="rtl">
            {children}
          </DirectionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
