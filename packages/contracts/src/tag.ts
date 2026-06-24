/**
 * 태그 API 계약 — Story 8.3
 *
 * tagPageQuerySchema: 태그 페이지 조회 쿼리 파라미터
 * tagContentResponseSchema: 태그 페이지 응답 (items + meta + tag 통계)
 */

import { z } from "zod";
import { paginationQuerySchema, paginationMetaSchema } from "./common";

// ── 태그 페이지 조회 쿼리 ─────────────────────────────────────────────────────

export const tagPageQuerySchema = paginationQuerySchema.extend({
  /** 콘텐츠 유형 필터 */
  type: z.enum(["all", "post", "question", "resource"]).default("all"),
  /** 정렬 기준 */
  sort: z.enum(["latest", "popular"]).default("latest"),
});
export type TagPageQuery = z.infer<typeof tagPageQuerySchema>;

// ── 태그 통계 ──────────────────────────────────────────────────────────────────

export const tagCountSchema = z.object({
  name: z.string(),
  postCount: z.number().int(),
  questionCount: z.number().int(),
  resourceCount: z.number().int(),
  totalCount: z.number().int(),
});
export type TagCount = z.infer<typeof tagCountSchema>;

// ── 콘텐츠 아이템 (판별 유니온) ───────────────────────────────────────────────

/** 게시글 태그 아이템 */
export const postTagItemSchema = z.object({
  type: z.literal("post"),
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  authorNickname: z.string().nullable(),
  createdAt: z.string(),
  viewCount: z.number().int(),
  commentCount: z.number().int(),
  /** 게시글이 속한 게시판 슬러그 */
  board: z.string(),
});
export type PostTagItem = z.infer<typeof postTagItemSchema>;

/** 질문 태그 아이템 */
export const questionTagItemSchema = z.object({
  type: z.literal("question"),
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  authorNickname: z.string().nullable(),
  createdAt: z.string(),
  viewCount: z.number().int(),
  commentCount: z.number().int(),
  /** 질문 해결 여부 */
  isResolved: z.boolean(),
});
export type QuestionTagItem = z.infer<typeof questionTagItemSchema>;

/** 자료 태그 아이템 */
export const resourceTagItemSchema = z.object({
  type: z.literal("resource"),
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  authorNickname: z.string().nullable(),
  createdAt: z.string(),
  viewCount: z.number().int(),
  commentCount: z.number().int(),
  /** 자료 유형 */
  resourceType: z.string(),
});
export type ResourceTagItem = z.infer<typeof resourceTagItemSchema>;

/** 판별 유니온: 콘텐츠 유형에 따라 구분 */
export const tagContentItemSchema = z.discriminatedUnion("type", [
  postTagItemSchema,
  questionTagItemSchema,
  resourceTagItemSchema,
]);
export type TagContentItem = z.infer<typeof tagContentItemSchema>;

// ── 태그 페이지 응답 ───────────────────────────────────────────────────────────

export const tagContentResponseSchema = z.object({
  items: z.array(tagContentItemSchema),
  meta: paginationMetaSchema,
  tag: tagCountSchema,
});
export type TagContentResponse = z.infer<typeof tagContentResponseSchema>;

// ── 인기 태그 목록 응답 ────────────────────────────────────────────────────────

export const popularTagItemSchema = z.object({
  name: z.string(),
  slug: z.string(),
  usageCount: z.number().int(),
});
export type PopularTagItem = z.infer<typeof popularTagItemSchema>;

export const popularTagsResponseSchema = z.object({
  items: z.array(popularTagItemSchema),
});
export type PopularTagsResponse = z.infer<typeof popularTagsResponseSchema>;

// ── 태그 자동완성 (Story 8.4) ─────────────────────────────────────────────────

/** 자동완성 쿼리 파라미터 스키마 */
export const tagAutocompleteQuerySchema = z.object({
  q: z.string().trim().default(""),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});
export type TagAutocompleteQuery = z.infer<typeof tagAutocompleteQuerySchema>;

/** 자동완성 응답 아이템 */
export const tagAutocompleteItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  usageCount: z.number().int(),
});
export type TagAutocompleteItem = z.infer<typeof tagAutocompleteItemSchema>;

/** 자동완성 응답 */
export const tagAutocompleteResponseSchema = z.object({
  items: z.array(tagAutocompleteItemSchema),
});
export type TagAutocompleteResponse = z.infer<typeof tagAutocompleteResponseSchema>;

// ── 신규 태그 생성 (Story 8.4 AC #5) ─────────────────────────────────────────

/** POST /api/v1/tags 요청 바디 */
export const createTagBodySchema = z.object({
  name: z.string().trim().min(1).max(30),
});
export type CreateTagBody = z.infer<typeof createTagBodySchema>;

/** POST /api/v1/tags 응답 */
export const createTagResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.string(),
});
export type CreateTagResponse = z.infer<typeof createTagResponseSchema>;
