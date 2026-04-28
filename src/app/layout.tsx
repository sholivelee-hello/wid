import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { QuickCaptureProvider } from "@/components/tasks/quick-capture-provider";

// Mono — code-shaped UI (kbd, source-id snippets).
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Body / UI — Pretendard Variable, self-hosted.
// 한국 IT 업계 사실상 표준 (Toss·당근·채널톡·Line).
// 100~900 전 weight, 한/영/숫자 동일 디자이너. variable font 단일 파일.
// heading·display 포함 전체 위계를 Pretendard 단일 시스템으로 처리.
// weight·tracking·optical scale로 만드는 위계가 serif보다 모던하고 단단.
const pretendard = localFont({
  src: "../../public/fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "WID — What I Do",
  description: "개인 업무일지 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${pretendard.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QuickCaptureProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-background focus:text-foreground focus:px-4 focus:py-2 focus:rounded focus:border focus:shadow-lg"
            >
              본문으로 건너뛰기
            </a>
            <div className="flex h-screen">
              <div className="hidden lg:flex">
                <Sidebar />
              </div>
              <div className="flex-1 flex flex-col overflow-hidden">
                <Header />
                <main id="main-content" className="flex-1 overflow-y-auto">
                  <div className="px-4 md:px-6 py-4 md:py-6 animate-fade-in">
                    {children}
                  </div>
                </main>
              </div>
            </div>
            <Toaster richColors closeButton position="bottom-right" />
          </QuickCaptureProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
