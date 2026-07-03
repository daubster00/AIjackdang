/**
 * SEO 사이트 URL·경로 중앙 헬퍼
 *
 * 그동안 SITE_URL 상수가 metadata/jsonld/breadcrumb/sitemap-helpers/layout 에
 * 제각각 정의돼(심지어 fallback 도메인도 aijakdang.com / www.ai-jakdang.com 로 불일치)
 * canonical·OG·sitemap URL 이 서로 어긋났다. 이 파일이 단일 진실 소스다.
 *
 * ⚠️ 운영에서는 반드시 NEXT_PUBLIC_SITE_URL 을 실제 도메인으로 주입해야 한다.
 *    (Next.js 는 NEXT_PUBLIC_* 을 빌드타임에 인라인하므로 web 이미지 빌드 ARG 로 전달.)
 *    미주입 시 아래 fallback(운영 실도메인 aijackdang.com)이 쓰인다.
 */

import { BOARDS } from "@ai-jakdang/contracts";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijackdang.com";

/** 사이트 표시명 (JSON-LD·OG siteName 등에서 사용) */
export const SITE_NAME = "AI작당";

/**
 * 게시판 상세 URL의 기준 경로.
 * BOARDS[board].urlPath 에서 쿼리스트링(`?board=...`)을 제거한다.
 * 예) "vibe-coding-tips" → "/vibe-coding?board=vibe-coding-tips" → "/vibe-coding"
 *     "ai-products"     → "/lounge/products"
 * 하위 게시판 글도 상세 라우트는 카테고리 기준 경로 하나로 모이므로 이 값이 곧 상세 base 다.
 */
export function boardDetailBase(board: string): string {
  const urlPath = BOARDS[board]?.urlPath ?? "";
  return urlPath.split("?")[0];
}

/** 게시글 상세 상대 경로 (예: "/vibe-coding/my-slug") */
export function buildPostPath(board: string, slug: string): string {
  return `${boardDetailBase(board)}/${slug}`;
}

/** 게시글 상세 절대 URL */
export function buildPostUrl(board: string, slug: string): string {
  return `${SITE_URL}${buildPostPath(board, slug)}`;
}

/**
 * 자산 URL(썸네일 등)을 절대 URL로 정규화한다.
 * OG·JSON-LD image 는 반드시 절대 URL 이어야 한다(상대경로면 크롤러가 못 읽음).
 * 이미 http(s) 로 시작하면 그대로, 아니면 SITE_URL 을 붙인다.
 */
export function toAbsoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** 기본 OG 이미지 절대 URL */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;
