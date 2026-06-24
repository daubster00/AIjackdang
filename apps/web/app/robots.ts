/**
 * Next.js 동적 robots.txt 생성 — Story 8.7 (Story 2.2 골격 완성)
 *
 * Allow: /  (기본 공개 크롤링 허용)
 * Disallow: 개인화 페이지 (마이페이지·알림·쪽지·설정·문의·검색)
 * Sitemap: https://www.ai-jakdang.com/sitemap.xml
 *
 * FR-11.4, FR-11.9
 */

import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://www.ai-jakdang.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/mypage",
        "/notifications",
        "/messages",
        "/settings/",
        "/inquiries",
        "/search",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
