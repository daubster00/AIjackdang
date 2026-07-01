/**
 * 신고 관리 계약 (Story 9.10).
 *
 * 신고 목록/상세/확인중/숨김/반려 요청·응답 Zod 스키마와 타입.
 *
 * DB 상태 어휘:
 *   pending    → 접수
 *   reviewing  → 확인중
 *   resolved   → 처리완료
 *   dismissed  → 반려
 */

import { z } from "zod";

// ── 공통 상태 enum ───────────────────────────────────────────────────────────────

export const reportStatusEnum = z.enum(["pending", "reviewing", "resolved", "dismissed"]);
export type ReportStatus = z.infer<typeof reportStatusEnum>;

export const reportTargetTypeEnum = z.enum([
  "post",
  "question",
  "answer",
  "resource",
  "comment",
  "message",
  "user",
]);
export type AdminReportTargetType = z.infer<typeof reportTargetTypeEnum>;

// ── 목록 쿼리 파라미터 ──────────────────────────────────────────────────────────

/** GET /api/v1/admin/reports 쿼리 파라미터 */
export const adminReportsQuerySchema = z.object({
  status: reportStatusEnum.optional(),
  targetType: reportTargetTypeEnum.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminReportsQuery = z.infer<typeof adminReportsQuerySchema>;

// ── 목록 응답 아이템 ────────────────────────────────────────────────────────────

/** 목록에서 반환하는 신고 정보 */
export const adminReportItemSchema = z.object({
  id: z.string(),
  targetType: reportTargetTypeEnum,
  targetId: z.string(),
  targetPreview: z.string().nullable(), // 대상 콘텐츠 미리보기 (제목/내용 앞부분)
  reasonCode: z.string(),
  detail: z.string().nullable(),
  status: reportStatusEnum,
  autoHidden: z.boolean(),
  reporterNickname: z.string().nullable(),
  reporterId: z.string(),
  reviewedBy: z.string().nullable(), // admin_users.id
  reviewedByName: z.string().nullable(), // 처리자 이름
  reviewedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type AdminReportItem = z.infer<typeof adminReportItemSchema>;

/** GET /api/v1/admin/reports 응답 */
export const adminReportsListResponseSchema = z.object({
  items: z.array(adminReportItemSchema),
  meta: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
  }),
});
export type AdminReportsListResponse = z.infer<typeof adminReportsListResponseSchema>;

// ── 상세 응답 ────────────────────────────────────────────────────────────────────

/** GET /api/v1/admin/reports/:id 응답 */
export const adminReportDetailSchema = z.object({
  id: z.string(),
  targetType: reportTargetTypeEnum,
  targetId: z.string(),
  targetPreview: z.string().nullable(),
  targetContentJson: z.unknown().nullable(), // 대상 콘텐츠 전문 (JSON)
  reasonCode: z.string(),
  detail: z.string().nullable(),
  status: reportStatusEnum,
  autoHidden: z.boolean(),
  reporterId: z.string(),
  reporterNickname: z.string().nullable(),
  reviewedBy: z.string().nullable(),
  reviewedByName: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type AdminReportDetail = z.infer<typeof adminReportDetailSchema>;

// ── 확인중 변경 ────────────────────────────────────────────────────────────────

/** PATCH /api/v1/admin/reports/:id/review 요청 (body 없음, 상태만 변경) */
export const adminReportReviewSchema = z.object({}).optional();
export type AdminReportReviewInput = z.infer<typeof adminReportReviewSchema>;

// ── 숨김 처리 ──────────────────────────────────────────────────────────────────

/** PATCH /api/v1/admin/reports/:id/hide 요청 */
export const adminReportHideSchema = z.object({
  note: z.string().optional(),
});
export type AdminReportHideInput = z.infer<typeof adminReportHideSchema>;

// ── 반려 ──────────────────────────────────────────────────────────────────────

/** PATCH /api/v1/admin/reports/:id/reject 요청 */
export const adminReportRejectSchema = z.object({
  note: z.string().min(1, "반려 사유를 입력해주세요."),
});
export type AdminReportRejectInput = z.infer<typeof adminReportRejectSchema>;

// ── 공통 액션 응답 ────────────────────────────────────────────────────────────

/** 신고 상태 변경 공통 응답 */
export const adminReportActionResponseSchema = z.object({
  id: z.string(),
  status: reportStatusEnum,
  reviewedAt: z.string().nullable(),
});
export type AdminReportActionResponse = z.infer<typeof adminReportActionResponseSchema>;

// ── 회원 신고 → 제재 일체 처리 (Story 12.5) ──────────────────────────────────

/** PATCH /api/v1/admin/reports/:id/sanction-member 요청 */
export const adminSanctionFromReportSchema = z.object({
  targetUserId: z.string().uuid(),
  type: z.enum(["warning", "suspend", "permaban"]),
  reason: z.string().min(1, "사유를 입력해주세요."),
  endsAt: z.string().datetime().nullable().optional(),
});
export type AdminSanctionFromReportInput = z.infer<typeof adminSanctionFromReportSchema>;
