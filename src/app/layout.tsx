import type { Metadata } from "next";
import { Geist_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { DirectionProvider } from "@/components/ui/direction";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// IBM Plex Sans Arabic فيه لاتيني بنفس الروح ⇒ خط واحد لكل النصوص
const fontSans = IBM_Plex_Sans_Arabic({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["arabic", "latin"],
  variable: "--font-sans",
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
      className={`${fontSans.variable} ${fontMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <DirectionProvider dir="rtl">
            {children}
            <Toaster position="top-center" />
          </DirectionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
