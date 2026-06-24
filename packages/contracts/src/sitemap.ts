/**
 * sitemap API 응답 Zod 스키마 — Story 8.7
 *
 * GET /api/v1/sitemap/* 엔드포인트 응답 타입.
 * sitemapPostItemSchema: board 포함 (URL 경로 매핑용).
 */

import { z } from "zod";

// ── 게시글·공지·자료 아이템 ────────────────────────────────────────────────────

export const sitemapPostItemSchema = z.object({
  slug: z.string(),
  board: z.string(),
  updatedAt: z.string(),
});
export type SitemapPostItem = z.infer<typeof sitemapPostItemSchema>;

export const sitemapPostsResponseSchema = z.object({
  items: z.array(sitemapPostItemSchema),
});
export type SitemapPostsResponse = z.infer<typeof sitemapPostsResponseSchema>;

// ── 질문 아이템 ───────────────────────────────────────────────────────────────

export const sitemapQuestionItemSchema = z.object({
  slug: z.string(),
  updatedAt: z.string(),
});
export type SitemapQuestionItem = z.infer<typeof sitemapQuestionItemSchema>;

export const sitemapQuestionsResponseSchema = z.object({
  items: z.array(sitemapQuestionItemSchema),
});
export type SitemapQuestionsResponse = z.infer<typeof sitemapQuestionsResponseSchema>;

// ── 태그 아이템 ───────────────────────────────────────────────────────────────

export const sitemapTagItemSchema = z.object({
  name: z.string(),
});
export type SitemapTagItem = z.infer<typeof sitemapTagItemSchema>;

export const sitemapTagsResponseSchema = z.object({
  items: z.array(sitemapTagItemSchema),
});
export type SitemapTagsResponse = z.infer<typeof sitemapTagsResponseSchema>;
