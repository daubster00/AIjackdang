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

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";

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
  const postUrl = `${SITE_URL}${urlPath}/${post.slug}`;

  return {
    "@context": "https://schema.org",
    "@type": articleType,
    headline: post.title,
    description: post.summary ?? post.title.slice(0, 160),
    author: {
      "@type": "Person",
      name: post.authorNickname ?? "익명",
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
  const postUrl = `${SITE_URL}${urlPath}/${post.slug}`;

  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: post.title,
    description: post.summary ?? post.title.slice(0, 160),
    author: {
      "@type": "Person",
      name: post.authorNickname ?? "익명",
    },
    datePublished: post.createdAt,
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
