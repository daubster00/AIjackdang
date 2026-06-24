/**
 * 통합 검색 API 계약 — Story 8.1 (pg_bigm 전문 검색)
 *
 * AR-5: pg_bigm 2-gram GIN 인덱스 기반. bigm_similarity() 점수 산출 후
 *       유형별 max 스코어로 [0,1] 정규화. UNION ALL 병합 재정렬.
 * AR-13: GET /api/v1/search?q=&type=all&page=1&pageSize=20
 */

import { z } from "zod";
import { paginationQuerySchema, paginationMetaSchema } from "./common";

// ── 요청 쿼리 스키마 ─────────────────────────────────────────────────────────

export const searchQuerySchema = paginationQuerySchema.extend({
  /** 검색어 (1~200자) */
  q: z.string().min(1, "검색어를 입력해 주세요.").max(200, "검색어는 200자 이내로 입력해 주세요."),
  /** 검색 유형 필터 */
  type: z.enum(["all", "post", "question", "resource"]).default("all"),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

// ── 결과 아이템 스키마 (discriminated union) ──────────────────────────────────

/** 게시글 검색 결과 아이템 */
export const postSearchItemSchema = z.object({
  type: z.literal("post"),
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  board: z.string(),
  authorNickname: z.string().nullable(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  viewCount: z.number().int(),
  commentCount: z.number().int(),
  score: z.number(),
});
export type PostSearchItem = z.infer<typeof postSearchItemSchema>;

/** 질문 검색 결과 아이템 */
export const questionSearchItemSchema = z.object({
  type: z.literal("question"),
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  isResolved: z.boolean(),
  authorNickname: z.string().nullable(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  commentCount: z.number().int(),
  score: z.number(),
});
export type QuestionSearchItem = z.infer<typeof questionSearchItemSchema>;

/** 실전자료 검색 결과 아이템 */
export const resourceSearchItemSchema = z.object({
  type: z.literal("resource"),
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  resourceType: z.string(),
  authorNickname: z.string().nullable(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  downloadCount: z.number().int(),
  score: z.number(),
});
export type ResourceSearchItem = z.infer<typeof resourceSearchItemSchema>;

/** 통합 검색 결과 아이템 (판별 유니온) */
export const searchResultItemSchema = z.discriminatedUnion("type", [
  postSearchItemSchema,
  questionSearchItemSchema,
  resourceSearchItemSchema,
]);
export type SearchResultItem = z.infer<typeof searchResultItemSchema>;

// ── 응답 스키마 ───────────────────────────────────────────────────────────────

/** 유형별 결과 수 */
export const byTypeSchema = z.object({
  post: z.number().int(),
  question: z.number().int(),
  resource: z.number().int(),
});
export type ByType = z.infer<typeof byTypeSchema>;

/** 통합 검색 응답 */
export const searchResponseSchema = z.object({
  items: z.array(searchResultItemSchema),
  meta: paginationMetaSchema,
  byType: byTypeSchema,
  /** 결과 0건 & type=all 일 때 인기 태그 최대 5개 */
  suggestedTags: z.array(z.string()).optional(),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;
