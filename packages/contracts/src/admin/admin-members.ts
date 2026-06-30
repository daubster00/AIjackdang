/**
 * 운영자 계정 관리 계약 (Story 9.4).
 *
 * 목록/승인/반려/정지/재활성/역할변경 요청·응답 Zod 스키마와 타입.
 */

import { z } from "zod";

/**
 * 역할 키 — staff/super_admin 고정 + 커스텀 역할(M12).
 * enum 이 아닌 free-form 키(영문 소문자 slug). 존재 여부는 서버(admin_roles)에서 검증.
 */
const roleKeySchema = z.string().min(1);

// ── 쿼리 파라미터 ───────────────────────────────────────────────────────────────

/** GET /api/v1/admin/admin-members 쿼리 파라미터 */
export const adminMembersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["pending", "active", "suspended", "disabled"]).optional(),
  q: z.string().optional(),
});
export type AdminMembersQuery = z.infer<typeof adminMembersQuerySchema>;

// ── 개별 관리자 응답 ───────────────────────────────────────────────────────────

/** 목록/상세에서 반환하는 관리자 정보 */
export const adminMemberItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string(),
  role: roleKeySchema,
  status: z.enum(["pending", "active", "suspended", "disabled"]),
  approvedBy: z.string().nullable(),
  approvedAt: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminMemberItem = z.infer<typeof adminMemberItemSchema>;

/** GET /api/v1/admin/admin-members 응답 */
export const adminMembersListResponseSchema = z.object({
  items: z.array(adminMemberItemSchema),
  meta: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
  }),
});
export type AdminMembersListResponse = z.infer<typeof adminMembersListResponseSchema>;

// ── 요청 스키마 ────────────────────────────────────────────────────────────────

/** PATCH /api/v1/admin/admin-members/:id/approve — 승인 */
export const adminMemberApproveSchema = z.object({
  role: roleKeySchema,
  note: z.string().min(1, "사유를 입력하세요"),
});
export type AdminMemberApproveInput = z.infer<typeof adminMemberApproveSchema>;

/** PATCH /api/v1/admin/admin-members/:id/reject — 반려 */
export const adminMemberNoteSchema = z.object({
  note: z.string().min(1, "사유를 입력하세요"),
});
export type AdminMemberNoteInput = z.infer<typeof adminMemberNoteSchema>;

/** PATCH /api/v1/admin/admin-members/:id/role — 역할 변경 */
export const adminMemberRoleSchema = z.object({
  role: roleKeySchema,
  note: z.string().min(1, "사유를 입력하세요"),
});
export type AdminMemberRoleInput = z.infer<typeof adminMemberRoleSchema>;

/** 공통 성공 응답 */
export const adminMemberActionResponseSchema = z.object({
  id: z.string(),
  status: z.enum(["pending", "active", "suspended", "disabled"]),
  role: roleKeySchema,
  updatedAt: z.string(),
});
export type AdminMemberActionResponse = z.infer<typeof adminMemberActionResponseSchema>;
