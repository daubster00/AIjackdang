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

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";
const SITE_NAME = "AI작당";

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

  return {
    // 사이트명은 루트 layout 의 title.template("%s · AI작당")이 붙이므로 여기서는 생략(중복 방지).
    title: `${board.label}${titleSuffix}`,
    description: board.description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${board.label}${titleSuffix} | ${SITE_NAME}`,
      description: board.description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      type: "website",
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
  const canonicalUrl = `${SITE_URL}${board?.urlPath ?? ""}/${post.slug}`;
  const description = post.summary ?? post.title.slice(0, 160);

  return {
    // 사이트명은 루트 layout title.template 가 붙이므로 생략(중복 방지).
    title: `${post.title} | ${boardLabel}`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${post.title} | ${boardLabel} - ${SITE_NAME}`,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      type: "article",
      publishedTime: post.createdAt,
      modifiedTime: post.updatedAt,
    },
    robots: {
      index: true,
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
  const description = post.summary ?? post.title.slice(0, 160);

  return {
    // 사이트명은 루트 layout title.template 가 붙이므로 생략(중복 방지).
    title: `${post.title} | 공지사항`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${post.title} | 공지사항 - ${SITE_NAME}`,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      type: "article",
      publishedTime: post.createdAt,
      modifiedTime: post.updatedAt,
    },
    // robots 미설정 → 공개 색인 허용 (기본값)
  };
}
