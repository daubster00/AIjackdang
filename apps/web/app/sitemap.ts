/**
 * Next.js 동적 sitemap.xml 생성
 *
 * 정적 URL(홈·게시판 목록) + published 게시글 URL 을 포함한다.
 * API 미가동 시(개발 단계) 게시글 부분은 빈 배열 fallback.
 */

import type { MetadataRoute } from "next";
import { BOARDS } from "@ai-jakdang/contracts";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

// ── 정적 URL ──────────────────────────────────────────────────────────────────

function buildStaticUrls(): MetadataRoute.Sitemap {
  const boardUrls: MetadataRoute.Sitemap = Object.values(BOARDS).map((board) => ({
    url: `${SITE_URL}${board.urlPath}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [
    {
      url: SITE_URL,
      changeFrequency: "daily",
      priority: 1.0,
    },
    ...boardUrls,
  ];
}

// ── 동적 URL (published 게시글) ───────────────────────────────────────────────

interface PostSitemapItem {
  slug: string;
  board: string;
  updatedAt: string;
}

interface PostsApiResponse {
  items: PostSitemapItem[];
}

async function fetchPublishedPosts(): Promise<PostSitemapItem[]> {
  if (!API_URL) return [];

  try {
    const res = await fetch(
      `${API_URL}/api/v1/posts?status=published&pageSize=1000`,
      { next: { revalidate: 3600 } } // 1시간 캐시
    );
    if (!res.ok) return [];
    const data: PostsApiResponse = await res.json();
    return data.items ?? [];
  } catch {
    // API 미가동(개발 단계) → 빈 배열 fallback
    return [];
  }
}

function buildPostUrl(post: PostSitemapItem): string {
  const board = BOARDS[post.board];
  if (!board) return `${SITE_URL}/${post.slug}`;

  // 공지사항은 /notice/:slug
  if (post.board === "notice") {
    return `${SITE_URL}/notice/${post.slug}`;
  }

  return `${SITE_URL}${board.urlPath}/${post.slug}`;
}

// ── sitemap() ─────────────────────────────────────────────────────────────────

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticUrls = buildStaticUrls();
  const posts = await fetchPublishedPosts();

  const postUrls: MetadataRoute.Sitemap = posts.map((post) => ({
    url: buildPostUrl(post),
    lastModified: post.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticUrls, ...postUrls];
}
