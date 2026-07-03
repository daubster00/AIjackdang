/**
 * Next.js 동적 sitemap.xml 생성 — Story 8.7 (Story 2.2 골격 완성)
 *
 * - 정적 URL: 홈·게시판 목록·QnA·자료실·공지·라운지
 * - 동적 URL: 게시글·질문·자료·공지·태그
 * - revalidate=3600: ISR 1시간 캐시 (NFR-4 성능)
 * - 50,000건 초과 시 generateSitemaps() 방식으로 전환 (TODO 확장 지점)
 */

import type { MetadataRoute } from "next";
import {
  buildSiteUrl,
  buildPostPath,
  SITEMAP_PRIORITIES,
  SITEMAP_CHANGE_FREQ,
} from "@/lib/seo";

export const revalidate = 3600;

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:4003";

// ── 내부 API 데이터 fetch 헬퍼 ────────────────────────────────────────────────

async function fetchSitemapData<T>(path: string): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { items: [] } as T;
    return (await res.json()) as T;
  } catch {
    return { items: [] } as T;
  }
}

// ── 정적 URL ──────────────────────────────────────────────────────────────────

function buildStaticUrls(): MetadataRoute.Sitemap {
  return [
    {
      url: buildSiteUrl("/"),
      changeFrequency: SITEMAP_CHANGE_FREQ.home,
      priority: SITEMAP_PRIORITIES.home,
    },
    {
      url: buildSiteUrl("/questions"),
      changeFrequency: SITEMAP_CHANGE_FREQ.list,
      priority: SITEMAP_PRIORITIES.topList,
    },
    {
      url: buildSiteUrl("/resources"),
      changeFrequency: SITEMAP_CHANGE_FREQ.list,
      priority: SITEMAP_PRIORITIES.topList,
    },
    {
      url: buildSiteUrl("/notice"),
      changeFrequency: SITEMAP_CHANGE_FREQ.list,
      priority: SITEMAP_PRIORITIES.boardList,
    },
    {
      url: buildSiteUrl("/lounge"),
      changeFrequency: SITEMAP_CHANGE_FREQ.list,
      priority: SITEMAP_PRIORITIES.boardList,
    },
    {
      url: buildSiteUrl("/lounge/products"),
      changeFrequency: SITEMAP_CHANGE_FREQ.list,
      priority: SITEMAP_PRIORITIES.boardList,
    },
    {
      url: buildSiteUrl("/lounge/talk"),
      changeFrequency: SITEMAP_CHANGE_FREQ.list,
      priority: SITEMAP_PRIORITIES.boardList,
    },
    {
      url: buildSiteUrl("/lounge/gigs"),
      changeFrequency: SITEMAP_CHANGE_FREQ.list,
      priority: SITEMAP_PRIORITIES.boardList,
    },
  ];
}

// ── 동적 URL ──────────────────────────────────────────────────────────────────

interface PostItem {
  slug: string;
  board: string;
  updatedAt: string;
}

interface QuestionItem {
  slug: string;
  updatedAt: string;
}

interface TagItem {
  name: string;
}

// ── 메인 sitemap() ─────────────────────────────────────────────────────────────

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticUrls = buildStaticUrls();

  // 병렬 API 호출
  const [postsData, questionsData, resourcesData, tagsData] = await Promise.all([
    fetchSitemapData<{ items: PostItem[] }>("/api/v1/sitemap/posts"),
    fetchSitemapData<{ items: QuestionItem[] }>("/api/v1/sitemap/questions"),
    fetchSitemapData<{ items: PostItem[] }>("/api/v1/sitemap/resources"),
    fetchSitemapData<{ items: TagItem[] }>("/api/v1/sitemap/tags"),
  ]);

  // TODO: 50,000건 초과 시 generateSitemaps() 방식으로 전환
  // const totalCount = postsData.items.length + questionsData.items.length + resourcesData.items.length;
  // if (totalCount > 50_000) { ... }

  // board 슬러그가 아니라 실제 라우트(카테고리 기준 경로)로 URL 생성.
  // (예전: `/${item.board}/${slug}` → /vibe-coding-guide/... 등 대부분 404·canonical 불일치)
  const postUrls: MetadataRoute.Sitemap = postsData.items.map((item) => ({
    url: buildSiteUrl(buildPostPath(item.board, item.slug)),
    lastModified: item.updatedAt,
    changeFrequency: SITEMAP_CHANGE_FREQ.detail,
    priority: SITEMAP_PRIORITIES.detail,
  }));

  const questionUrls: MetadataRoute.Sitemap = questionsData.items.map((item) => ({
    url: buildSiteUrl(`/questions/${item.slug}`),
    lastModified: item.updatedAt,
    changeFrequency: SITEMAP_CHANGE_FREQ.detail,
    priority: SITEMAP_PRIORITIES.detail,
  }));

  const resourceUrls: MetadataRoute.Sitemap = resourcesData.items.map((item) => ({
    url: buildSiteUrl(`/resources/${item.slug}`),
    lastModified: item.updatedAt,
    changeFrequency: SITEMAP_CHANGE_FREQ.detail,
    priority: SITEMAP_PRIORITIES.detail,
  }));

  const tagUrls: MetadataRoute.Sitemap = tagsData.items.map((item) => ({
    url: buildSiteUrl(`/tags/${encodeURIComponent(item.name)}`),
    changeFrequency: SITEMAP_CHANGE_FREQ.tag,
    priority: SITEMAP_PRIORITIES.tag,
  }));

  return [...staticUrls, ...postUrls, ...questionUrls, ...resourceUrls, ...tagUrls];
}
