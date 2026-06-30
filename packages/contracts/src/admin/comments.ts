/**
 * 댓글·후기 통합 관리 계약 (Story 9.9).
 *
 * 목록 조회 / 숨김 / 소프트 삭제 / 벌크 액션 요청·응답 Zod 스키마와 타입.
 */

import { z } from "zod";

// ── 댓글 유형 (derived type 필터) ───────────────────────────────────────────────
// 일반댓글: targetType='post' AND parentId IS NULL
// 대댓글: parentId IS NOT NULL
// 후기: targetType='resource'
// Q&A답변: targetType IN ('answer','question')

/** GET /api/v1/admin/comments 쿼리 파라미터 */
export const adminCommentsQuerySchema = z.object({
  type: z.enum(["일반댓글", "대댓글", "후기", "Q&A답변"]).optional(),
  status: z.enum(["visible", "hidden", "deleted"]).optional(),
  hasReports: z.coerce.boolean().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminCommentsQuery = z.infer<typeof adminCommentsQuerySchema>;

// ── 개별 댓글 응답 ────────────────────────────────────────────────────────────

/** 목록에서 반환하는 댓글 정보 */
export const adminCommentItemSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  authorNickname: z.string().nullable(),
  authorAvatarUrl: z.string().nullable().optional(),
  authorImage: z.string().nullable().optional(),
  authorDefaultAvatarIndex: z.number().nullable().optional(),
  targetType: z.enum(["post", "question", "answer", "resource", "comment"]),
  targetId: z.string(),
  /** 게시글 댓글이면 상위 게시글 board (상세페이지 링크용) */
  targetBoard: z.string().nullable().optional(),
  parentId: z.string().nullable(),
  /** 내용 앞 100자 미리보기 */
  contentPreview: z.string(),
  /** UI 표시용 파생 유형 */
  derivedType: z.enum(["일반댓글", "대댓글", "후기", "Q&A답변"]),
  status: z.enum(["visible", "hidden", "deleted"]),
  reportCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});
export type AdminCommentItem = z.infer<typeof adminCommentItemSchema>;

/** GET /api/v1/admin/comments 응답 */
export const adminCommentsListResponseSchema = z.object({
  items: z.array(adminCommentItemSchema),
  meta: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
  }),
});
export type AdminCommentsListResponse = z.infer<typeof adminCommentsListResponseSchema>;

// ── 숨김 ──────────────────────────────────────────────────────────────────────

/** PATCH /api/v1/admin/comments/:id/hide */
export const adminCommentHideSchema = z.object({
  note: z.string().optional(),
});
export type AdminCommentHideInput = z.infer<typeof adminCommentHideSchema>;

// ── 벌크 액션 ──────────────────────────────────────────────────────────────────

/** POST /api/v1/admin/comments/bulk */
export const adminCommentsBulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  action: z.enum(["hide", "delete"]),
  note: z.string().optional(),
});
export type AdminCommentsBulkInput = z.infer<typeof adminCommentsBulkSchema>;

// ── 공통 응답 ──────────────────────────────────────────────────────────────────

/** 단순 성공 응답 */
export const adminCommentActionResponseSchema = z.object({
  id: z.string(),
  status: z.enum(["visible", "hidden", "deleted"]),
  updatedAt: z.string(),
});
export type AdminCommentActionResponse = z.infer<typeof adminCommentActionResponseSchema>;

/** 벌크 처리 응답 */
export const adminCommentsBulkResponseSchema = z.object({
  affected: z.number(),
  action: z.enum(["hide", "delete"]),
});
export type AdminCommentsBulkResponse = z.infer<typeof adminCommentsBulkResponseSchema>;
