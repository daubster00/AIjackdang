/**
 * 쪽지 관리 계약 (Story 9.18).
 *
 * 목록/상세/숨김/복구/삭제/발신제한/벌크 요청·응답 Zod 스키마와 타입.
 */

import { z } from "zod";

// ── 쿼리 파라미터 ───────────────────────────────────────────────────────────────

/** GET /api/v1/admin/messages 쿼리 파라미터 */
export const adminMessagesQuerySchema = z.object({
  /** 탭 필터: 전체 / 신고있음 / 숨김 */
  tab: z.enum(["all", "reported", "hidden"]).optional().default("all"),
  hasReport: z.coerce.boolean().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminMessagesQuery = z.infer<typeof adminMessagesQuerySchema>;

// ── 목록 행 타입 ──────────────────────────────────────────────────────────────

export const messageAdminRowSchema = z.object({
  id: z.string(),
  senderId: z.string(),
  senderNickname: z.string(),
  receiverId: z.string(),
  receiverNickname: z.string(),
  /** 본문 앞 100자 */
  bodyPreview: z.string(),
  createdAt: z.string(),
  hiddenByAdmin: z.boolean(),
  reportCount: z.number(),
  deletedAt: z.string().nullable(),
});
export type MessageAdminRow = z.infer<typeof messageAdminRowSchema>;

/** GET /api/v1/admin/messages 응답 */
export const adminMessagesListResponseSchema = z.object({
  items: z.array(messageAdminRowSchema),
  meta: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
  }),
});
export type AdminMessagesListResponse = z.infer<typeof adminMessagesListResponseSchema>;

// ── 상세 응답 ──────────────────────────────────────────────────────────────────

export const messageReportItemSchema = z.object({
  id: z.string(),
  reporterNickname: z.string(),
  reasonCode: z.string(),
  createdAt: z.string(),
  status: z.string(),
});
export type MessageReportItem = z.infer<typeof messageReportItemSchema>;

export const adminMessageDetailSchema = z.object({
  id: z.string(),
  senderId: z.string(),
  senderNickname: z.string(),
  receiverId: z.string(),
  receiverNickname: z.string(),
  body: z.string(),
  createdAt: z.string(),
  hiddenByAdmin: z.boolean(),
  deletedAt: z.string().nullable(),
  reportCount: z.number(),
  reports: z.array(messageReportItemSchema),
});
export type AdminMessageDetail = z.infer<typeof adminMessageDetailSchema>;

// ── 벌크 요청 ──────────────────────────────────────────────────────────────────

export const adminMessagesBulkHideSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});
export type AdminMessagesBulkHideInput = z.infer<typeof adminMessagesBulkHideSchema>;

export const adminMessagesBulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});
export type AdminMessagesBulkDeleteInput = z.infer<typeof adminMessagesBulkDeleteSchema>;

// ── 발신제한 요청 ──────────────────────────────────────────────────────────────

export const adminMessageRestrictSenderSchema = z.object({
  /** 제한 기간 (일 수). 0이면 영구. */
  days: z.number().int().min(0),
  reason: z.string().min(1, "사유를 입력하세요."),
});
export type AdminMessageRestrictSenderInput = z.infer<typeof adminMessageRestrictSenderSchema>;

// ── 공통 응답 ──────────────────────────────────────────────────────────────────

export const adminMessageActionResponseSchema = z.object({
  id: z.string(),
  hiddenByAdmin: z.boolean().optional(),
  deletedAt: z.string().nullable().optional(),
});
export type AdminMessageActionResponse = z.infer<typeof adminMessageActionResponseSchema>;

export const adminMessagesBulkResponseSchema = z.object({
  affected: z.number(),
  action: z.enum(["hide", "delete"]),
});
export type AdminMessagesBulkResponse = z.infer<typeof adminMessagesBulkResponseSchema>;
