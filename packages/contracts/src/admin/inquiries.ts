/**
 * 문의 관리 계약 (Story 9.14).
 *
 * 어드민 문의 목록/상세/상태변경/답변 요청·응답 Zod 스키마와 타입.
 */

import { z } from "zod";

// ── 공통 ───────────────────────────────────────────────────────────────────────

/** inquiries.status enum (DB: pending / in_progress / resolved) */
export const adminInquiryStatusSchema = z.enum(["pending", "in_progress", "resolved"]);
export type AdminInquiryStatus = z.infer<typeof adminInquiryStatusSchema>;

// ── 목록 조회 쿼리 파라미터 ──────────────────────────────────────────────────

/** GET /api/v1/admin/inquiries 쿼리 파라미터 */
export const adminInquiriesQuerySchema = z.object({
  status: adminInquiryStatusSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminInquiriesQuery = z.infer<typeof adminInquiriesQuerySchema>;

// ── 목록 아이템 ─────────────────────────────────────────────────────────────

/** 목록에서 반환하는 문의 정보 */
export const adminInquiryItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  /** 문의자 닉네임 (좌측 join) */
  userNickname: z.string().nullable(),
  title: z.string(),
  status: adminInquiryStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  /** 처리 완료 시각 (최근 replied updatedAt = resolved 전환 시각) */
  resolvedAt: z.string().nullable(),
});
export type AdminInquiryItem = z.infer<typeof adminInquiryItemSchema>;

/** GET /api/v1/admin/inquiries 응답 */
export const adminInquiriesListResponseSchema = z.object({
  items: z.array(adminInquiryItemSchema),
  meta: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
  }),
});
export type AdminInquiriesListResponse = z.infer<typeof adminInquiriesListResponseSchema>;

// ── 답변 단건 ────────────────────────────────────────────────────────────────

export const adminInquiryReplySchema = z.object({
  id: z.string().uuid(),
  inquiryId: z.string().uuid(),
  authorType: z.enum(["user", "admin"]),
  authorId: z.string().uuid(),
  /** Tiptap JSON 본문 */
  body: z.unknown(),
  createdAt: z.string(),
});
export type AdminInquiryReply = z.infer<typeof adminInquiryReplySchema>;

// ── 상세+스레드 응답 ─────────────────────────────────────────────────────────

/** GET /api/v1/admin/inquiries/:id 응답 */
export const adminInquiryDetailResponseSchema = z.object({
  inquiry: z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    userNickname: z.string().nullable(),
    title: z.string(),
    /** Tiptap JSON 본문 */
    body: z.unknown(),
    status: adminInquiryStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
    resolvedAt: z.string().nullable(),
  }),
  replies: z.array(adminInquiryReplySchema),
});
export type AdminInquiryDetailResponse = z.infer<typeof adminInquiryDetailResponseSchema>;

// ── 상태 변경 ────────────────────────────────────────────────────────────────

/** PATCH /api/v1/admin/inquiries/:id/status */
export const adminInquiryStatusUpdateSchema = z.object({
  status: z.enum(["in_progress", "resolved"]),
});
export type AdminInquiryStatusUpdate = z.infer<typeof adminInquiryStatusUpdateSchema>;

// ── 답변 작성 ────────────────────────────────────────────────────────────────

/** POST /api/v1/admin/inquiries/:id/replies */
export const adminInquiryReplyCreateSchema = z.object({
  /** Tiptap JSON 본문 */
  body: z.unknown(),
});
export type AdminInquiryReplyCreate = z.infer<typeof adminInquiryReplyCreateSchema>;

// ── 공통 응답 ────────────────────────────────────────────────────────────────

/** 단순 상태 변경 성공 응답 */
export const adminInquiryActionResponseSchema = z.object({
  id: z.string().uuid(),
  status: adminInquiryStatusSchema,
  updatedAt: z.string(),
});
export type AdminInquiryActionResponse = z.infer<typeof adminInquiryActionResponseSchema>;
