/**
 * SEO 메타데이터 헬퍼
 *
 * Next.js App Router `generateMetadata` 함수에서 재사용할 수 있는 빌더 모음.
 * 공개 페이지의 title·description·canonical·openGraph·robots 를 일관되게 생성한다.
 */

import type { Metadata } from "next";
import type { BoardMeta } from "@ai-jakdang/contracts";
import type { PostDetail } from "@ai-jakdang/contracts";
import { BOARDS } from "@ai-jakdang/contracts";
import {
  SITE_URL,
  SITE_NAME,
  DEFAULT_OG_IMAGE,
  buildPostUrl,
  toAbsoluteUrl,
} from "./site-url";

/**
 * 게시판 목록 페이지 메타데이터를 생성한다.
 *
 * @param board - `BoardMeta` 객체 (`BOARDS[slug]`)
 * @param opts  - 선택 옵션. `page`가 2 이상이면 제목에 페이지 번호 포함.
 */
export function buildPageMeta(
  board: BoardMeta,
  opts?: { page?: number }
): Metadata {
  const canonicalUrl = `${SITE_URL}${board.urlPath}`;
  const titleSuffix = opts?.page && opts.page > 1 ? ` — ${opts.page}페이지` : "";
  const ogTitle = `${board.label}${titleSuffix} | ${SITE_NAME}`;
  const ogImageUrl = DEFAULT_OG_IMAGE;

  return {
    // 사이트명은 루트 layout 의 title.template("%s · AI작당")이 붙이므로 여기서는 생략(중복 방지).
    title: `${board.label}${titleSuffix}`,
    description: board.description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: ogTitle,
      description: board.description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      locale: "ko_KR",
      type: "website",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: ogTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: board.description,
      images: [ogImageUrl],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

/**
 * 일반 게시글 상세 페이지 메타데이터를 생성한다.
 *
 * @param post - `PostDetail` 객체
 */
export function buildPostMeta(post: PostDetail): Metadata {
  const board = BOARDS[post.board];
  const boardLabel = board?.label ?? post.board;
  // canonical·상세 URL 은 쿼리스트링을 제거한 카테고리 기준 경로로 생성한다.
  // (예전: `${urlPath}/${slug}` → 하위게시판은 "/vibe-coding?board=x/slug" 로 깨짐)
  const canonicalUrl = buildPostUrl(post.board, post.slug);
  // 글 작성 시 지정한 개별 SEO 값(seoTitle/seoDescription)이 있으면 우선 사용.
  const displayTitle = post.seoTitle?.trim() || post.title;
  const description =
    post.seoDescription?.trim() || post.summary || post.title.slice(0, 160);
  const ogTitle = `${displayTitle} | ${boardLabel} - ${SITE_NAME}`;
  // 본문 첫 이미지(thumbnailUrl)를 절대 URL로 정규화해 OG 이미지로 사용, 없으면 기본값.
  const ogImageUrl = toAbsoluteUrl(post.thumbnailUrl) ?? DEFAULT_OG_IMAGE;
  // published 가 아닌 상태(draft/hidden/deleted)는 색인 제외.
  const noindex = post.status !== "published";

  return {
    // 사이트명은 루트 layout title.template 가 붙이므로 생략(중복 방지).
    title: post.seoTitle?.trim() || `${post.title} | ${boardLabel}`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: ogTitle,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      locale: "ko_KR",
      type: "article",
      publishedTime: post.createdAt,
      modifiedTime: post.updatedAt,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [ogImageUrl],
    },
    robots: {
      index: !noindex,
      follow: true,
    },
  };
}

/**
 * 공지사항 상세 페이지 메타데이터를 생성한다.
 * robots 미설정(공개 색인), Article 타입.
 *
 * @param post - `PostDetail` 객체 (notice 게시판)
 */
export function buildNoticeMeta(post: PostDetail): Metadata {
  const canonicalUrl = `${SITE_URL}/notice/${post.slug}`;
  const description =
    post.seoDescription?.trim() || post.summary || post.title.slice(0, 160);
  const ogTitle = `${post.title} | 공지사항 - ${SITE_NAME}`;
  const ogImageUrl = toAbsoluteUrl(post.thumbnailUrl) ?? DEFAULT_OG_IMAGE;

  return {
    // 사이트명은 루트 layout title.template 가 붙이므로 생략(중복 방지).
    title: `${post.title} | 공지사항`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: ogTitle,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      locale: "ko_KR",
      type: "article",
      publishedTime: post.createdAt,
      modifiedTime: post.updatedAt,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [ogImageUrl],
    },
    // robots 미설정 → 공개 색인 허용 (기본값)
  };
}
