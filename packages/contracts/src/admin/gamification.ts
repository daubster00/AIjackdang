/**
 * 포인트·등급·뱃지 관리 계약 (Story 9.13).
 *
 * 기존 packages/contracts/src/gamification.ts 와의 이름 충돌 방지를 위해
 * 모든 export 에 admin 접두어를 사용한다.
 */

import { z } from "zod";

// ── 포인트 규칙 ──────────────────────────────────────────────────────────────

/** GET /api/v1/admin/points/rules 응답 아이템 */
export const adminPointRuleSchema = z.object({
  actionType: z.string().min(1),
  points: z.number().int().nonnegative(),
  description: z.string(),
  isActive: z.boolean(),
  updatedAt: z.string(),
});
export type AdminPointRule = z.infer<typeof adminPointRuleSchema>;

/** GET /api/v1/admin/points/rules 응답 */
export const adminPointRulesListResponseSchema = z.object({
  items: z.array(adminPointRuleSchema),
});
export type AdminPointRulesListResponse = z.infer<typeof adminPointRulesListResponseSchema>;

/** PATCH /api/v1/admin/points/rules/:actionType 요청 */
export const adminPatchPointRuleSchema = z.object({
  points: z.number().int().nonnegative().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});
export type AdminPatchPointRuleInput = z.infer<typeof adminPatchPointRuleSchema>;

// ── 등급 관리 ────────────────────────────────────────────────────────────────

/** GET /api/v1/admin/grades 응답 아이템 */
export const adminGradeSchema = z.object({
  id: z.string().uuid(),
  /** level 상한 제거 — 등급 추가 시 5 초과 level 도 허용 */
  level: z.number().int().min(1),
  name: z.string().min(1),
  minPoints: z.number().int().nonnegative(),
  maxPoints: z.number().int().nonnegative().nullable(),
});
export type AdminGrade = z.infer<typeof adminGradeSchema>;

/** GET /api/v1/admin/grades 응답 */
export const adminGradesListResponseSchema = z.object({
  items: z.array(adminGradeSchema),
});
export type AdminGradesListResponse = z.infer<typeof adminGradesListResponseSchema>;

/** PATCH /api/v1/admin/grades/:id 요청 */
export const adminPatchGradeSchema = z.object({
  minPoints: z.number().int().nonnegative().optional(),
  maxPoints: z.number().int().nonnegative().nullable().optional(),
  name: z.string().min(1).optional(),
});
export type AdminPatchGradeInput = z.infer<typeof adminPatchGradeSchema>;

/**
 * POST /api/v1/admin/grades 요청.
 * level 상한 없음 — 기존 1~5 등급 외 추가 등급(예: Lv.6 슈퍼마스터)을 허용.
 */
export const adminCreateGradeSchema = z.object({
  level: z.number().int().min(1),
  name: z.string().min(1).max(50),
  minPoints: z.number().int().nonnegative(),
  maxPoints: z.number().int().nonnegative().nullable().optional(),
});
export type AdminCreateGradeInput = z.infer<typeof adminCreateGradeSchema>;

// ── 뱃지 관리 ────────────────────────────────────────────────────────────────

/** GET /api/v1/admin/badges 응답 아이템 */
export const adminBadgeSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  iconUrl: z.string(),
  isAuto: z.boolean(),
  condition: z.string().nullable(),
  isActive: z.boolean(),
});
export type AdminBadge = z.infer<typeof adminBadgeSchema>;

/** GET /api/v1/admin/badges 응답 */
export const adminBadgesListResponseSchema = z.object({
  items: z.array(adminBadgeSchema),
});
export type AdminBadgesListResponse = z.infer<typeof adminBadgesListResponseSchema>;

/** POST /api/v1/admin/badges 요청 */
export const adminCreateBadgeSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "소문자·숫자·하이픈만 허용"),
  name: z.string().min(1).max(50),
  description: z.string().max(200).default(""),
  iconUrl: z.string().default("/badges/default.png"),
  isAuto: z.boolean().default(false),
  condition: z.string().max(500).nullable().optional(),
});
export type AdminCreateBadgeInput = z.infer<typeof adminCreateBadgeSchema>;

/** PATCH /api/v1/admin/badges/:id 요청 */
export const adminPatchBadgeSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional(),
  iconUrl: z.string().optional(),
  isAuto: z.boolean().optional(),
  condition: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});
export type AdminPatchBadgeInput = z.infer<typeof adminPatchBadgeSchema>;

/** 비활성화 전용 요청 (사유 포함) */
export const adminDeactivateBadgeSchema = z.object({
  isActive: z.literal(false),
  reason: z.string().min(1).max(500),
});
export type AdminDeactivateBadgeInput = z.infer<typeof adminDeactivateBadgeSchema>;
