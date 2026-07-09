/**
 * 실전자료 관리 계약 (Story 9.8).
 *
 * 목록/상세/숨김/삭제/첨부삭제/후기목록/후기숨김/후기삭제 요청·응답 Zod 스키마와 타입.
 *
 * 가드레일 UX-DR-A9: "검수됨", "안전한 파일", "공식 인증" 레이블 포함 금지.
 * resource_files 소프트딜리트: fileStatus='deleted' (deleted_at 컬럼 없음 — 스키마 확인).
 * 후기 숨김: comment_status enum이 visible|deleted 만 존재하므로 hide/delete 모두
 *   status='deleted' + deletedAt=now() 로 처리. 가역적 숨김은 추후 'hidden' enum 추가 시 분리 예정.
 */

import { z } from "zod";

// ── 목록 쿼리 파라미터 ──────────────────────────────────────────────────────────

/** GET /api/v1/admin/resources 쿼리 파라미터 */
export const adminResourcesQuerySchema = z.object({
  type: z
    .enum(["prompt", "claude-code-skill", "mcp", "rules-config", "template-checklist"])
    .optional(),
  status: z.enum(["draft", "published", "hidden", "deleted"]).optional(),
  hasReports: z.coerce.boolean().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminResourcesQuery = z.infer<typeof adminResourcesQuerySchema>;

// ── 목록 아이템 ────────────────────────────────────────────────────────────────

/** 목록에서 반환하는 자료 정보 */
export const adminResourceItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  resourceType: z.enum(["prompt", "claude-code-skill", "mcp", "rules-config", "template-checklist"]),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  status: z.enum(["draft", "published", "hidden", "deleted"]),
  userId: z.string().nullable(),
  authorNickname: z.string().nullable(),
  downloadCount: z.number(),
  viewCount: z.number(),
  avgRating: z.string(),
  ratingCount: z.number(),
  reportCount: z.number(),
  reviewCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});
export type AdminResourceItem = z.infer<typeof adminResourceItemSchema>;

/** GET /api/v1/admin/resources 응답 */
export const adminResourcesListResponseSchema = z.object({
  items: z.array(adminResourceItemSchema),
  meta: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
  }),
});
export type AdminResourcesListResponse = z.infer<typeof adminResourcesListResponseSchema>;

// ── 첨부파일 ───────────────────────────────────────────────────────────────────

/** 첨부파일 정보 (UX-DR-A9: 안전성 보증 필드 없음) */
export const adminResourceFileSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  originalName: z.string(),
  storageKey: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
  allowedExtension: z.enum(["zip", "md", "txt", "json", "pdf", "docx", "xlsx"]),
  isPrimary: z.boolean(),
  displayOrder: z.number(),
  /** 파일 운영 상태 (soft-delete) */
  fileStatus: z.enum(["active", "deleted"]),
  createdAt: z.string(),
});
export type AdminResourceFile = z.infer<typeof adminResourceFileSchema>;

// ── 상세 응답 ──────────────────────────────────────────────────────────────────

/** GET /api/v1/admin/resources/:id 응답 (파일 목록 포함) */
export const adminResourceDetailSchema = adminResourceItemSchema.extend({
  descriptionJson: z.unknown(),
  usageJson: z.unknown(),
  cautionJson: z.unknown().nullable(),
  /** 서버 렌더 본문 HTML(이미지·영상·코드블록 포함) — 관리자 상세에서 그대로 표시 */
  descriptionHtml: z.string(),
  usageHtml: z.string(),
  cautionHtml: z.string().nullable(),
  environment: z.array(z.string()),
  version: z.string().nullable(),
  referenceLinks: z.unknown().nullable(),
  copyrightAgreed: z.boolean(),
  files: z.array(adminResourceFileSchema),
});
export type AdminResourceDetail = z.infer<typeof adminResourceDetailSchema>;

// ── 숨김 ──────────────────────────────────────────────────────────────────────

/** PATCH /api/v1/admin/resources/:id/hide */
export const adminResourceHideSchema = z.object({
  note: z.string().optional(),
});
export type AdminResourceHideInput = z.infer<typeof adminResourceHideSchema>;

// ── 삭제 ──────────────────────────────────────────────────────────────────────

/** DELETE /api/v1/admin/resources/:id body */
export const adminResourceDeleteSchema = z.object({
  note: z.string().min(1, "삭제 사유를 입력하세요."),
});
export type AdminResourceDeleteInput = z.infer<typeof adminResourceDeleteSchema>;

// ── 첨부파일 삭제 ─────────────────────────────────────────────────────────────

/** DELETE /api/v1/admin/resources/:id/files/:fileId body */
export const adminResourceFileDeleteSchema = z.object({
  note: z.string().min(1, "삭제 사유를 입력하세요."),
});
export type AdminResourceFileDeleteInput = z.infer<typeof adminResourceFileDeleteSchema>;

// ── 공통 액션 응답 ────────────────────────────────────────────────────────────

/** 단순 성공 응답 (숨김/삭제) */
export const adminResourceActionResponseSchema = z.object({
  id: z.string(),
  status: z.enum(["draft", "published", "hidden", "deleted"]),
  updatedAt: z.string(),
});
export type AdminResourceActionResponse = z.infer<typeof adminResourceActionResponseSchema>;

/** 첨부파일 삭제 응답 */
export const adminResourceFileActionResponseSchema = z.object({
  id: z.string(),
  fileStatus: z.enum(["active", "deleted"]),
});
export type AdminResourceFileActionResponse = z.infer<typeof adminResourceFileActionResponseSchema>;

// ── 후기(댓글) ────────────────────────────────────────────────────────────────

/** 후기 목록 아이템 (comments WHERE target_type='resource') */
export const adminResourceReviewItemSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  authorNickname: z.string().nullable(),
  targetId: z.string(),
  parentId: z.string().nullable(),
  content: z.string(),
  status: z.enum(["visible", "deleted"]),
  reportCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});
export type AdminResourceReviewItem = z.infer<typeof adminResourceReviewItemSchema>;

/** GET /api/v1/admin/resources/:id/reviews 응답 */
export const adminResourceReviewsResponseSchema = z.object({
  items: z.array(adminResourceReviewItemSchema),
  meta: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
  }),
});
export type AdminResourceReviewsResponse = z.infer<typeof adminResourceReviewsResponseSchema>;

/** 후기 숨김/삭제 body */
export const adminReviewDeleteSchema = z.object({
  note: z.string().min(1, "사유를 입력하세요."),
});
export type AdminReviewDeleteInput = z.infer<typeof adminReviewDeleteSchema>;

/** 후기 액션 응답 */
export const adminReviewActionResponseSchema = z.object({
  id: z.string(),
  status: z.enum(["visible", "deleted"]),
  updatedAt: z.string(),
});
export type AdminReviewActionResponse = z.infer<typeof adminReviewActionResponseSchema>;
