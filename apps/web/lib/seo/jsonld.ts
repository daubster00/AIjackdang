/**
 * Schema.org JSON-LD 객체 빌더
 *
 * Next.js 서버 컴포넌트에서 `<script type="application/ld+json">` 태그로 삽입하기 위한
 * 구조화 데이터 빌더 모음.
 *
 * 삽입 방법 (dangerouslySetInnerHTML 사용):
 *   <script
 *     type="application/ld+json"
 *     dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd(items)) }}
 *   />
 */

import type { BoardMeta, PostDetail } from "@ai-jakdang/contracts";
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE, toAbsoluteUrl } from "./site-url";

// ── 공통 타입 ──────────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  name: string;
  url: string;
}

// ── 빌더 함수 ─────────────────────────────────────────────────────────────────

/**
 * Schema.org BreadcrumbList JSON-LD 객체를 생성한다.
 *
 * @param items - 빵조각 항목 배열 (순서 = 위치)
 */
export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Article 또는 BlogPosting JSON-LD 객체를 생성한다.
 *
 * - `isSystemBoard: true` 게시판(공지) → `Article`
 * - 그 외 게시글 → `BlogPosting`
 *
 * @param post   - `PostDetail` 객체
 * @param urlPath - 게시판 URL 경로 (예: `/vibe-coding/guide`)
 */
export function buildArticleJsonLd(post: PostDetail, urlPath: string) {
  const articleType = post.board === "notice" ? "Article" : "BlogPosting";
  // urlPath 에 쿼리스트링(?board=...)이 섞여 있으면 제거해야 URL 이 깨지지 않는다.
  const cleanPath = urlPath.split("?")[0];
  const postUrl = `${SITE_URL}${cleanPath}/${post.slug}`;
  const imageUrl = toAbsoluteUrl(post.thumbnailUrl) ?? DEFAULT_OG_IMAGE;

  return {
    "@context": "https://schema.org",
    "@type": articleType,
    headline: post.title,
    description: post.seoDescription?.trim() || post.summary || post.title.slice(0, 160),
    image: [imageUrl],
    author: {
      "@type": "Person",
      name: post.authorNickname ?? "익명",
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: DEFAULT_OG_IMAGE,
      },
    },
    datePublished: post.createdAt,
    dateModified: post.updatedAt,
    url: postUrl,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": postUrl,
    },
  };
}

/**
 * DiscussionForumPosting JSON-LD 객체를 생성한다.
 * 일반 커뮤니티 게시글(Q&A·토론)에 사용.
 *
 * @param post    - `PostDetail` 객체
 * @param urlPath - 게시판 URL 경로 (예: `/talk`)
 */
export function buildDiscussionJsonLd(post: PostDetail, urlPath: string) {
  // urlPath 에 쿼리스트링(?board=...)이 섞여 있으면 제거.
  const cleanPath = urlPath.split("?")[0];
  const postUrl = `${SITE_URL}${cleanPath}/${post.slug}`;
  const imageUrl = toAbsoluteUrl(post.thumbnailUrl);

  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: post.title,
    description: post.seoDescription?.trim() || post.summary || post.title.slice(0, 160),
    ...(imageUrl ? { image: [imageUrl] } : {}),
    author: {
      "@type": "Person",
      name: post.authorNickname ?? "익명",
    },
    datePublished: post.createdAt,
    dateModified: post.updatedAt,
    url: postUrl,
  };
}

/**
 * CollectionPage JSON-LD 객체를 생성한다.
 * 게시판 목록 페이지에 사용.
 *
 * @param board - `BoardMeta` 객체
 * @param url   - 게시판 절대 URL
 */
export function buildCollectionPageJsonLd(board: BoardMeta, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: board.label,
    description: board.description,
    url,
  };
}

/**
 * WebSite JSON-LD 객체를 생성한다. (사이트 전역 — 루트 layout 에 1회 삽입)
 *
 * `potentialAction`(SearchAction)을 포함해 구글 사이트링크 검색창(sitelinks searchbox)
 * 노출 후보가 된다. 검색 페이지는 `/search?q=...` 이다.
 *
 * @param opts.name - 사이트명 (관리자 설정 site_name, 없으면 기본값)
 */
export function buildWebSiteJsonLd(opts?: { name?: string }) {
  const name = opts?.name?.trim() || SITE_NAME;
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url: SITE_URL,
    inLanguage: "ko-KR",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Organization JSON-LD 객체를 생성한다. (사이트 전역 — 루트 layout 에 1회 삽입)
 * 브랜드 엔티티 인식용. 로고는 og_image 설정(없으면 기본 OG 이미지)을 사용한다.
 *
 * @param opts.name - 사이트명 (관리자 설정 site_name, 없으면 기본값)
 * @param opts.logo - 로고 절대 URL (관리자 설정 og_image, 없으면 기본 OG 이미지)
 */
export function buildOrganizationJsonLd(opts?: { name?: string; logo?: string | null }) {
  const name = opts?.name?.trim() || SITE_NAME;
  const logo = toAbsoluteUrl(opts?.logo) ?? DEFAULT_OG_IMAGE;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url: SITE_URL,
    logo,
  };
}
