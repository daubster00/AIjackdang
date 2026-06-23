/**
 * 빵조각(Breadcrumb) 항목 빌더
 *
 * 홈 > 카테고리 > 게시판 > (글제목) 구조의 빵조각 배열을 반환한다.
 * `buildBreadcrumbJsonLd` 와 함께 사용한다.
 */

import type { BreadcrumbItem } from "./jsonld";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";

// ── 카테고리 한국어 이름 매핑 ─────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  "vibe-coding": "바이브 코딩",
  "ai-automation": "AI 자동화",
  "ai-monetization": "AI 수익화",
  "ai-creation": "AI 창작",
  lounge: "커뮤니티",
  system: "안내",
};

/**
 * 카테고리 슬러그를 한국어 이름으로 변환한다.
 * 매핑에 없는 경우 원본 슬러그를 그대로 반환한다.
 */
function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/**
 * 카테고리 대표 URL을 반환한다.
 * 카테고리 전용 페이지가 없는 경우 `#` 반환.
 */
function getCategoryUrl(category: string): string {
  const categoryUrlMap: Record<string, string> = {
    "vibe-coding": `${SITE_URL}/vibe-coding`,
    "ai-automation": `${SITE_URL}/automation`,
    "ai-monetization": `${SITE_URL}/monetization`,
    "ai-creation": `${SITE_URL}/ai-creation`,
    lounge: `${SITE_URL}/talk`,
    system: `${SITE_URL}/notice`,
  };
  return categoryUrlMap[category] ?? `${SITE_URL}/#`;
}

// ── 빌더 함수 ─────────────────────────────────────────────────────────────────

/**
 * 게시판 목록 페이지용 빵조각 배열을 반환한다.
 * 홈 > 카테고리 > 게시판
 *
 * @param category  - 게시판 카테고리 슬러그 (예: `"vibe-coding"`)
 * @param boardLabel - 게시판 한국어 이름 (예: `"바이브 코딩 가이드"`)
 * @param boardUrl   - 게시판 절대 URL (예: `"https://aijakdang.com/vibe-coding/guide"`)
 */
export function buildBoardBreadcrumb(
  category: string,
  boardLabel: string,
  boardUrl: string
): BreadcrumbItem[] {
  return [
    { name: "홈", url: SITE_URL },
    { name: getCategoryLabel(category), url: getCategoryUrl(category) },
    { name: boardLabel, url: boardUrl },
  ];
}

/**
 * 게시글 상세 페이지용 빵조각 배열을 반환한다.
 * 홈 > 카테고리 > 게시판 > 글제목(50자 truncate)
 *
 * @param category   - 게시판 카테고리 슬러그
 * @param boardLabel - 게시판 한국어 이름
 * @param boardUrl   - 게시판 절대 URL
 * @param postTitle  - 게시글 제목 (50자 초과 시 `...` 추가)
 * @param postUrl    - 게시글 절대 URL
 */
export function buildPostBreadcrumb(
  category: string,
  boardLabel: string,
  boardUrl: string,
  postTitle: string,
  postUrl: string
): BreadcrumbItem[] {
  const truncatedTitle =
    postTitle.length > 50 ? `${postTitle.slice(0, 50)}...` : postTitle;

  return [
    { name: "홈", url: SITE_URL },
    { name: getCategoryLabel(category), url: getCategoryUrl(category) },
    { name: boardLabel, url: boardUrl },
    { name: truncatedTitle, url: postUrl },
  ];
}
