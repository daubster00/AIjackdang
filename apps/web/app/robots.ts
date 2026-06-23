/**
 * Next.js 동적 robots.txt 생성 (FR-11.4 골격)
 *
 * - Allow: /  (기본 공개 크롤링 허용)
 * - Disallow: 개인화 페이지 (마이페이지·알림·쪽지·설정)
 * - Sitemap: https://aijakdang.com/sitemap.xml
 */

import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/mypage",
        "/mypage/",
        "/notifications",
        "/messages",
        "/settings/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
