/**
 * 게시글 관리 계약 (Story 9.6).
 *
 * 목록/플래그토글/숨김/복구/삭제/SEO/벌크 요청·응답 Zod 스키마와 타입.
 */

import { z } from "zod";

// ── 쿼리 파라미터 ───────────────────────────────────────────────────────────────

/** GET /api/v1/admin/posts 쿼리 파라미터 */
export const adminPostsQuerySchema = z.object({
  board: z.string().optional(),
  status: z.enum(["draft", "published", "hidden", "deleted"]).optional(),
  isNotice: z.coerce.boolean().optional(),
  isPinned: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
  isMainFeatured: z.coerce.boolean().optional(),
  hasReports: z.coerce.boolean().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminPostsQuery = z.infer<typeof adminPostsQuerySchema>;

// ── 개별 게시글 응답 ──────────────────────────────────────────────────────────

/** 목록에서 반환하는 게시글 정보 */
export const adminPostItemSchema = z.object({
  id: z.string(),
  board: z.string(),
  category: z.string().nullable(),
  title: z.string(),
  slug: z.string(),
  status: z.enum(["draft", "published", "hidden", "deleted"]),
  userId: z.string().nullable(),
  authorNickname: z.string().nullable(),
  isNotice: z.boolean(),
  isPinned: z.boolean(),
  isFeatured: z.boolean(),
  isMainFeatured: z.boolean(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  viewCount: z.number(),
  reportCount: z.number(),
  commentCount: z.number(),
  likeCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});
export type AdminPostItem = z.infer<typeof adminPostItemSchema>;

/** GET /api/v1/admin/posts 응답 */
export const adminPostsListResponseSchema = z.object({
  items: z.array(adminPostItemSchema),
  meta: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
  }),
});
export type AdminPostsListResponse = z.infer<typeof adminPostsListResponseSchema>;

// ── 플래그 토글 ────────────────────────────────────────────────────────────────

/** PATCH /api/v1/admin/posts/:id/flags */
export const adminPostsFlagsSchema = z.object({
  isNotice: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isMainFeatured: z.boolean().optional(),
});
export type AdminPostsFlagsInput = z.infer<typeof adminPostsFlagsSchema>;

// ── 숨김/복구 ──────────────────────────────────────────────────────────────────

/** PATCH /api/v1/admin/posts/:id/hide */
export const adminPostsHideSchema = z.object({
  note: z.string().optional(),
});
export type AdminPostsHideInput = z.infer<typeof adminPostsHideSchema>;

// ── SEO ────────────────────────────────────────────────────────────────────────

/** PATCH /api/v1/admin/posts/:id/seo */
export const adminPostsSeoSchema = z.object({
  seoTitle: z.string().max(60).nullable().optional(),
  seoDescription: z.string().max(160).nullable().optional(),
});
export type AdminPostsSeoInput = z.infer<typeof adminPostsSeoSchema>;

// ── 벌크 액션 ──────────────────────────────────────────────────────────────────

/** POST /api/v1/admin/posts/bulk */
export const adminPostsBulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  action: z.enum(["hide", "delete"]),
  note: z.string().optional(),
});
export type AdminPostsBulkInput = z.infer<typeof adminPostsBulkSchema>;

// ── 공통 응답 ──────────────────────────────────────────────────────────────────

/** 단순 성공 응답 */
export const adminPostActionResponseSchema = z.object({
  id: z.string(),
  status: z.enum(["draft", "published", "hidden", "deleted"]),
  updatedAt: z.string(),
});
export type AdminPostActionResponse = z.infer<typeof adminPostActionResponseSchema>;

/** 벌크 처리 응답 */
export const adminPostsBulkResponseSchema = z.object({
  affected: z.number(),
  action: z.enum(["hide", "delete"]),
});
export type AdminPostsBulkResponse = z.infer<typeof adminPostsBulkResponseSchema>;
