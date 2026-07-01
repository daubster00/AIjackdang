/**
 * 이용약관 페이지 — /terms
 *
 * SSR 서버 컴포넌트. 비회원(쿠키 없음)도 즉시 열람 가능 (AC #1).
 * force-static: 법무 텍스트는 빌드 시 고정 (Dev Notes).
 * generateMetadata: canonical, BreadcrumbList JSON-LD (AC #2).
 */

import type { Metadata } from "next";
import { TERMS_SECTIONS, TERMS_VERSION, TERMS_EFFECTIVE_DATE } from "@/app/(legal)/_content/terms";
import { buildBreadcrumbJsonLd } from "@/lib/seo";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const dynamic = "force-static";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";
const SITE_NAME = "AI작당";

// ── generateMetadata ──────────────────────────────────────────────────────────

export function generateMetadata(): Metadata {
  const canonicalUrl = `${SITE_URL}/terms`;
  const title = "이용약관";
  const description =
    "AI작당 서비스 이용약관. 서비스 이용 조건, 회원 권리·의무, 포인트·등급 정책, 이용 제한 기준을 안내합니다.";
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

export default function TermsPage() {
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "홈", url: SITE_URL },
    { name: "이용약관", url: `${SITE_URL}/terms` },
  ]);

  return (
    <>
      {/* BreadcrumbList JSON-LD (AC #2) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <LegalPageLayout
        title="이용약관"
        sections={TERMS_SECTIONS}
        version={TERMS_VERSION}
        effectiveDate={TERMS_EFFECTIVE_DATE}
      />
    </>
  );
}
