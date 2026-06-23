import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui";
import { SiteFooter, SiteHeader } from "@/components/site";
import { GatingProvider } from "@/contexts/GatingContext";
// 사용자 사이트 전역 디자인 시스템 (이 앱 전용)
import "../styles/index.css";
// 아이콘은 Remix Icon 으로 통일
import "remixicon/fonts/remixicon.css";

export const metadata: Metadata = {
  title: {
    default: "AI작당",
    template: "%s · AI작당",
  },
  description: "AI로 만들고, 자동화하고, 돈으로 연결하는 실전 AI 커뮤니티",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <a className="skip-link" href="#main">
          본문 바로가기
        </a>
        <ToastProvider>
          <GatingProvider>
            <SiteHeader />
            {children}
            <SiteFooter />
          </GatingProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
