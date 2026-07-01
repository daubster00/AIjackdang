/**
 * 운영정책 페이지 — /operation-policy
 *
 * SSR 서버 컴포넌트. 비회원(쿠키 없음)도 즉시 열람 가능 (AC #1).
 * force-static: 법무 텍스트는 빌드 시 고정 (Dev Notes).
 * generateMetadata: canonical, BreadcrumbList JSON-LD (AC #2).
 */

import type { Metadata } from "next";
import {
  POLICY_SECTIONS,
  POLICY_VERSION,
  POLICY_EFFECTIVE_DATE,
} from "@/app/(legal)/_content/operation-policy";
import { buildBreadcrumbJsonLd } from "@/lib/seo";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const dynamic = "force-static";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";
const SITE_NAME = "AI작당";

// ── generateMetadata ──────────────────────────────────────────────────────────

export function generateMetadata(): Metadata {
  const canonicalUrl = `${SITE_URL}/operation-policy`;
  const title = "운영정책";
  const description =
    "AI작당 커뮤니티 운영정책. 게시물 작성 규칙, 금지 행위, 제재 기준(경고·정지), 신고 처리 절차, 자료실·Q&A 운영 규칙을 안내합니다.";
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

export default function OperationPolicyPage() {
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "홈", url: SITE_URL },
    { name: "운영정책", url: `${SITE_URL}/operation-policy` },
  ]);

  return (
    <>
      {/* BreadcrumbList JSON-LD (AC #2) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <LegalPageLayout
        title="운영정책"
        sections={POLICY_SECTIONS}
        version={POLICY_VERSION}
        effectiveDate={POLICY_EFFECTIVE_DATE}
      />
    </>
  );
}
