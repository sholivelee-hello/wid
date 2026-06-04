import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { QuickCaptureProvider } from "@/components/tasks/quick-capture-provider";
import { ContentColumn } from "@/components/layout/content-column";
import { RealtimeBridge } from "@/components/layout/realtime-bridge";

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
  // 창 제목은 군더더기 없이 "WID"만 — 미션 컨트롤/탭 라벨이 곧 식별자.
  // (🟣 마커·"What I Do" 꼬리표는 사용자 결정으로 제거, 2026-06-03)
  title: "WID",
  description: "개인 업무일지 시스템",
  // iOS 홈 화면 추가 시 앱 이름 (아이콘은 apple-icon.png 파일 컨벤션)
  appleWebApp: { title: "WID" },
};

// 설치형 웹앱 타이틀바 / Safari 탭바 / 모바일 주소창을 키컬러로 틴트.
// 앱은 다크 전용이므로 단일 값.
export const viewport: Viewport = {
  themeColor: "#7D74F8",
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
        {/* 다크 전용 앱 — 사용자 결정 (2026-06-03, 100% 다크모드 사용).
          * forcedTheme로 항상 .dark 고정, 라이트 전환 경로 없음. */}
        <ThemeProvider attribute="class" forcedTheme="dark" disableTransitionOnChange>
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
                  {/* 콘텐츠 컬럼 폭은 ContentColumn이 경로별로 결정 — 기본 860px 중앙
                    * 정렬, 돌아보기(/history)만 전폭 예외 (캘린더+패널 2단 레이아웃). */}
                  <ContentColumn>{children}</ContentColumn>
                </main>
              </div>
            </div>
            <Toaster richColors closeButton position="bottom-right" />
            <RealtimeBridge />
          </QuickCaptureProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
