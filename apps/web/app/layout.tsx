import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import Script from "next/script";
import { ToastProvider } from "@/components/ui";
import { SiteFooter, SiteHeader, NotificationAlert } from "@/components/site";
import { GatingProvider } from "@/contexts/GatingContext";
import { NotificationCountProvider } from "@/contexts/NotificationCountContext";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";
import {
  SITE_URL,
  DEFAULT_OG_IMAGE,
  toAbsoluteUrl,
  buildWebSiteJsonLd,
  buildOrganizationJsonLd,
} from "@/lib/seo";
// 사용자 사이트 전역 디자인 시스템 (이 앱 전용)
import "../styles/index.css";
// 아이콘은 Remix Icon 으로 통일
import "remixicon/fonts/remixicon.css";

const gscToken = process.env.NEXT_PUBLIC_GSC_VERIFICATION_TOKEN || undefined;
// 네이버 서치어드바이저 사이트 소유확인 토큰 (<meta name="naver-site-verification">).
// 값이 고정이므로 상수로 둔다. 필요 시 env(NEXT_PUBLIC_NAVER_SITE_VERIFICATION)로 덮어쓴다.
const naverToken =
  process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION ||
  "778c7a54092c8f5033b3fe50979063309684551f";

/**
 * 공개 사이트 설정(site_name/seo_title/seo_description)을 API에서 가져온다.
 * GET /api/v1/settings/public — 인증 불필요, 60초 revalidate 캐시.
 * API_INTERNAL_URL 은 서버 사이드에서만 사용하는 내부 URL (클라이언트 노출 없음).
 * 등록 필요: apps/api/src/routes/v1/index.ts 에 registerPublicSiteSettingsRoute 등록.
 */
interface PublicSiteSettings {
  site_name?: string;
  seo_title?: string;
  seo_description?: string;
  favicon_url?: string;
  og_image?: string;
}

async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  const apiBase = process.env.API_INTERNAL_URL ?? "http://localhost:4003";
  try {
    const res = await fetch(`${apiBase}/api/v1/settings/public`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return {};
    return (await res.json()) as PublicSiteSettings;
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
  // 기본 OG 이미지: 관리자 og_image 설정 > 기본 이미지. (절대 URL 로 정규화)
  const defaultOgImage = toAbsoluteUrl(s.og_image) ?? DEFAULT_OG_IMAGE;

  return {
    // metadataBase: 상대 OG/canonical 을 절대 URL 로 해석하기 위한 기준. 미설정 시 빌드 경고.
    metadataBase: new URL(SITE_URL),
    title: {
      default: seoTitle,
      template: `%s · ${siteName}`,
    },
    description,
    // 하위 페이지가 자체 openGraph 를 지정하면 병합/덮어쓰므로, 여기 값은 OG 없는
    // 정적/약관 페이지의 기본값이 된다(예전엔 그런 페이지에 OG 태그가 전무했다).
    openGraph: {
      type: "website",
      siteName,
      locale: "ko_KR",
      url: SITE_URL,
      title: seoTitle,
      description,
      images: [{ url: defaultOgImage, width: 1200, height: 630, alt: siteName }],
    },
    twitter: {
      card: "summary_large_image",
      title: seoTitle,
      description,
      images: [defaultOgImage],
    },
    // 소유확인: 구글(gscToken) + 네이버(naver-site-verification). verification.other 로 임의 meta 출력.
    verification: {
      ...(gscToken ? { google: gscToken } : {}),
      ...(naverToken ? { other: { "naver-site-verification": naverToken } } : {}),
    },
    ...(s.favicon_url
      ? { icons: { icon: s.favicon_url, shortcut: s.favicon_url } }
      : {}),
  };
}

const ga4Id = process.env.NEXT_PUBLIC_GA4_ID || undefined;

export default async function RootLayout({ children }: { children: ReactNode }) {
  // 사이트 전역 구조화 데이터(WebSite·Organization) — 브랜드 엔티티 + 사이트링크 검색창 후보.
  const s = await getPublicSiteSettings();
  const websiteJsonLd = buildWebSiteJsonLd({ name: s.site_name });
  const organizationJsonLd = buildOrganizationJsonLd({
    name: s.site_name,
    logo: s.og_image,
  });

  return (
    <html lang="ko">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
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
          {/* 미읽음 알림 카운트 전역 공유 — SiteHeader 와 NotificationsPage 가
              동일 컨텍스트를 consume 해 읽음 처리 시 헤더 배지가 즉시 감소한다. */}
          <NotificationCountProvider>
            <GatingProvider>
              <SiteHeader />
              {children}
              <SiteFooter />
            </GatingProvider>
            {/* 페이지 이동·새로고침 시 새 알림/쪽지 팝업 — ToastProvider 하위에서만 useToast 동작 */}
            <NotificationAlert />
          </NotificationCountProvider>
          {/* 방문 로그 적재 — 라우트 변경 시마다 POST /api/v1/analytics/collect.
              useSearchParams 사용 → 정적 프리렌더 CSR bailout 방지 위해 Suspense 래핑. */}
          <Suspense fallback={null}>
            <PageViewTracker />
          </Suspense>
        </ToastProvider>
      </body>
    </html>
  );
}

// SITE_URL은 하위 페이지에서 재사용 가능하도록 export
export { SITE_URL };
