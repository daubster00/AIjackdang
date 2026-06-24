import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { ToastProvider } from "@/components/ui";
import { SiteFooter, SiteHeader } from "@/components/site";
import { GatingProvider } from "@/contexts/GatingContext";
// 사용자 사이트 전역 디자인 시스템 (이 앱 전용)
import "../styles/index.css";
// 아이콘은 Remix Icon 으로 통일
import "remixicon/fonts/remixicon.css";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";
const gscToken = process.env.NEXT_PUBLIC_GSC_VERIFICATION_TOKEN || undefined;

export const metadata: Metadata = {
  title: {
    default: "AI작당",
    template: "%s · AI작당",
  },
  description: "AI로 만들고, 자동화하고, 돈으로 연결하는 실전 AI 커뮤니티",
  ...(gscToken ? { verification: { google: gscToken } } : {}),
};

const ga4Id = process.env.NEXT_PUBLIC_GA4_ID || undefined;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {ga4Id && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${ga4Id}');
            `}</Script>
          </>
        )}
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

// SITE_URL은 하위 페이지에서 재사용 가능하도록 export
export { SITE_URL };
