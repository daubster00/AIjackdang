import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { ToastProvider } from "@/components/ui";
import { SiteFooter, SiteHeader, NotificationAlert } from "@/components/site";
import { GatingProvider } from "@/contexts/GatingContext";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";
// 사용자 사이트 전역 디자인 시스템 (이 앱 전용)
import "../styles/index.css";
// 아이콘은 Remix Icon 으로 통일
import "remixicon/fonts/remixicon.css";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";
const gscToken = process.env.NEXT_PUBLIC_GSC_VERIFICATION_TOKEN || undefined;

/**
 * 공개 사이트 설정(site_name/seo_title/seo_description)을 API에서 가져온다.
 * GET /api/v1/settings/public — 인증 불필요, 60초 revalidate 캐시.
 * API_INTERNAL_URL 은 서버 사이드에서만 사용하는 내부 URL (클라이언트 노출 없음).
 * 등록 필요: apps/api/src/routes/v1/index.ts 에 registerPublicSiteSettingsRoute 등록.
 */
async function getPublicSiteSettings(): Promise<{
  site_name?: string;
  seo_title?: string;
  seo_description?: string;
}> {
  const apiBase = process.env.API_INTERNAL_URL ?? "http://localhost:4003";
  try {
    const res = await fetch(`${apiBase}/api/v1/settings/public`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return {};
    return (await res.json()) as { site_name?: string; seo_title?: string; seo_description?: string };
  } catch {
    return {};
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const s = await getPublicSiteSettings();
  const siteName = s.site_name ?? "AI작당";
  const description =
    s.seo_description ?? "AI로 만들고, 자동화하고, 돈으로 연결하는 실전 AI 커뮤니티";
  const seoTitle = s.seo_title ?? siteName;

  return {
    title: {
      default: seoTitle,
      template: `%s · ${siteName}`,
    },
    description,
    ...(gscToken ? { verification: { google: gscToken } } : {}),
  };
}

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
          {/* 페이지 이동·새로고침 시 새 알림/쪽지 팝업 — ToastProvider 하위에서만 useToast 동작 */}
          <NotificationAlert />
          {/* 방문 로그 적재 — 라우트 변경 시마다 POST /api/v1/analytics/collect */}
          <PageViewTracker />
        </ToastProvider>
      </body>
    </html>
  );
}

// SITE_URL은 하위 페이지에서 재사용 가능하도록 export
export { SITE_URL };
