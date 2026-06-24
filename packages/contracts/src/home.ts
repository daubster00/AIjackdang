/**
 * 홈 페이지(/) 전용 Zod 스키마 — Story 8.5
 *
 * popularPostItemSchema  : ②실전 인기글 탭 / ⑥라운지 카드
 * questionItemSchema     : ③묻고답하기 최신 목록
 * resourceItemSchema     : ⑤실전자료 인기 카드
 * noticeBannerSchema     : ①소개 섹션 공지 배너 (최대 1건)
 */

import { z } from "zod";

// ── ②④⑥ 인기글 / 라운지 카드 ────────────────────────────────────────────────

export const popularPostItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  board: z.string(),
  viewCount: z.number().int(),
  likeCount: z.number().int(),
  commentCount: z.number().int(),
  createdAt: z.string(), // ISO 8601 UTC
  tags: z.array(z.string()),
});
export type PopularPostItem = z.infer<typeof popularPostItemSchema>;

export const popularPostsResponseSchema = z.object({
  items: z.array(popularPostItemSchema),
});
export type PopularPostsResponse = z.infer<typeof popularPostsResponseSchema>;

// ── ③ 묻고답하기 최신 목록 ────────────────────────────────────────────────────

export const questionItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: z.string(), // 'waiting' | 'answered' | 'resolved'
  commentCount: z.number().int(),
  createdAt: z.string(), // ISO 8601 UTC
  slug: z.string(),
});
export type QuestionItem = z.infer<typeof questionItemSchema>;

export const latestQuestionsResponseSchema = z.object({
  items: z.array(questionItemSchema),
});
export type LatestQuestionsResponse = z.infer<typeof latestQuestionsResponseSchema>;

// ── ⑤ 실전자료 인기 카드 ──────────────────────────────────────────────────────

export const resourceItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  downloadCount: z.number().int(),
  avgRating: z.number().nullable(),
  meta: z.string().nullable(), // resourceType label
  tone: z.string().nullable(), // badge tone 힌트 (primary / success / info 등)
  slug: z.string(),
});
export type ResourceItem = z.infer<typeof resourceItemSchema>;

export const popularResourcesResponseSchema = z.object({
  items: z.array(resourceItemSchema),
});
export type PopularResourcesResponse = z.infer<typeof popularResourcesResponseSchema>;

// ── ① 공지 배너 ───────────────────────────────────────────────────────────────

export const noticeBannerSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string().nullable(),
  url: z.string().nullable(), // 외부 링크 또는 /notice/slug
  slug: z.string(),
});
export type NoticeBanner = z.infer<typeof noticeBannerSchema>;
