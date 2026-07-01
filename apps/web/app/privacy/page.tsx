/**
 * 개인정보처리방침 페이지 — /privacy
 *
 * SSR 서버 컴포넌트. 비회원(쿠키 없음)도 즉시 열람 가능 (AC #1).
 * force-static: 법무 텍스트는 빌드 시 고정 (Dev Notes).
 * generateMetadata: canonical, BreadcrumbList JSON-LD (AC #2).
 * PIPA(개인정보보호법) 필수 항목 포함 (Story 10.1 요구사항).
 */

import type { Metadata } from "next";
import {
  PRIVACY_SECTIONS,
  PRIVACY_VERSION,
  PRIVACY_EFFECTIVE_DATE,
} from "@/app/(legal)/_content/privacy";
import { buildBreadcrumbJsonLd } from "@/lib/seo";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const dynamic = "force-static";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";
const SITE_NAME = "AI작당";

// ── generateMetadata ──────────────────────────────────────────────────────────

export function generateMetadata(): Metadata {
  const canonicalUrl = `${SITE_URL}/privacy`;
  const title = "개인정보처리방침";
  const description =
    "AI작당 개인정보처리방침. 수집 항목·이용 목적·보유 기간·제3자 제공·정보주체 권리 등 개인정보보호법 기준 필수 사항을 안내합니다.";
  const ogTitle = `${title} | ${SITE_NAME}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: ogTitle,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: ogTitle,
      description,
    },
    // robots 미설정 → 기본 색인 허용 (AC #6)
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PrivacyPage() {
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "홈", url: SITE_URL },
    { name: "개인정보처리방침", url: `${SITE_URL}/privacy` },
  ]);

  return (
    <>
      {/* BreadcrumbList JSON-LD (AC #2) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <LegalPageLayout
        title="개인정보처리방침"
        sections={PRIVACY_SECTIONS}
        version={PRIVACY_VERSION}
        effectiveDate={PRIVACY_EFFECTIVE_DATE}
      />
    </>
  );
}
