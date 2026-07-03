/**
 * sitemap 생성 헬퍼 — Story 8.7
 *
 * buildSiteUrl: 절대 URL 생성.
 * SITEMAP_PRIORITIES: 유형별 priority 상수.
 * SITEMAP_CHANGE_FREQ: 유형별 changeFrequency 상수.
 */

import { SITE_URL } from "./site-url";

/**
 * 상대 경로를 절대 URL로 변환한다.
 * @param path - 슬래시로 시작하는 상대 경로 (예: "/qna/slug")
 */
export function buildSiteUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalizedPath}`;
}

/** 유형별 sitemap priority */
export const SITEMAP_PRIORITIES = {
  home: 1.0,
  topList: 0.9,
  detail: 0.8,
  tag: 0.7,
  boardList: 0.6,
} as const;

/** 유형별 sitemap changeFrequency */
export const SITEMAP_CHANGE_FREQ = {
  home: "daily",
  list: "daily",
  detail: "weekly",
  tag: "weekly",
} as const;
