import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
import { DirectionProvider } from "@/components/ui/direction";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const fontSans = Noto_Sans_Arabic({
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
    >
      <body className="flex min-h-full flex-col">
        <DirectionProvider dir="rtl">
          {children}
          <Toaster position="top-center" richColors />
        </DirectionProvider>
      </body>
    </html>
  );
}
