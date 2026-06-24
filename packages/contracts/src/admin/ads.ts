/**
 * 광고 관리 계약 (Story 9.16).
 *
 * 목록·상세·성과·등록·수정·토글·삭제 요청·응답 Zod 스키마와 타입.
 */

import { z } from "zod";

// ── Enum ──────────────────────────────────────────────────────────────────────

export const adDeviceEnum = z.enum(["all", "pc", "mobile"]);
export type AdDevice = z.infer<typeof adDeviceEnum>;

export const adTypeEnum = z.enum(["adsense", "direct_banner", "text", "affiliate", "internal"]);
export type AdType = z.infer<typeof adTypeEnum>;

// ── 목록 쿼리 파라미터 ──────────────────────────────────────────────────────────

/** GET /api/v1/admin/ads 쿼리 파라미터 */
export const adminAdsQuerySchema = z.object({
  placement: z.string().optional(),
  device: adDeviceEnum.optional(),
  adType: adTypeEnum.optional(),
  /** "active" | "inactive" | "scheduled" | "expired" — 프론트 편의 필터 */
  status: z.enum(["active", "inactive", "scheduled", "expired"]).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminAdsQuery = z.infer<typeof adminAdsQuerySchema>;

// ── 광고 슬롯 아이템 ──────────────────────────────────────────────────────────

/** 목록/상세에서 반환하는 광고 슬롯 */
export const adminAdSlotItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  placement: z.string(),
  device: adDeviceEnum,
  adType: adTypeEnum,
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  clickUrl: z.string().nullable(),
  code: z.string().nullable(),
  imageUrl: z.string().nullable(),
  memo: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  /** 집계: 전체 노출 수 */
  totalImpressions: z.number(),
  /** 집계: 전체 클릭 수 */
  totalClicks: z.number(),
  /** 집계: 전체 CTR (clicks/impressions, 0~1) */
  ctr: z.number(),
});
export type AdminAdSlotItem = z.infer<typeof adminAdSlotItemSchema>;

/** GET /api/v1/admin/ads 응답 */
export const adminAdsListResponseSchema = z.object({
  items: z.array(adminAdSlotItemSchema),
  meta: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
  }),
});
export type AdminAdsListResponse = z.infer<typeof adminAdsListResponseSchema>;

// ── 성과(stats) ──────────────────────────────────────────────────────────────

/** GET /api/v1/admin/ads/:id/stats 쿼리 파라미터 */
export const adminAdStatsQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});
export type AdminAdStatsQuery = z.infer<typeof adminAdStatsQuerySchema>;

/** 일자별 성과 항목 */
export const adminAdStatsDaySchema = z.object({
  date: z.string(),
  impressions: z.number(),
  clicks: z.number(),
  ctr: z.number(),
});
export type AdminAdStatsDay = z.infer<typeof adminAdStatsDaySchema>;

/** GET /api/v1/admin/ads/:id/stats 응답 */
export const adminAdStatsResponseSchema = z.object({
  items: z.array(adminAdStatsDaySchema),
});
export type AdminAdStatsResponse = z.infer<typeof adminAdStatsResponseSchema>;

// ── 등록·수정 ─────────────────────────────────────────────────────────────────

/** POST /api/v1/admin/ads 요청 바디 */
export const adminAdCreateSchema = z.object({
  name: z.string().min(1).max(200),
  placement: z.string().min(1),
  device: adDeviceEnum.default("all"),
  adType: adTypeEnum.default("direct_banner"),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  clickUrl: z.string().url().nullable().optional(),
  code: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  memo: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});
export type AdminAdCreateInput = z.infer<typeof adminAdCreateSchema>;

/** PATCH /api/v1/admin/ads/:id 요청 바디 (모든 필드 optional) */
export const adminAdUpdateSchema = adminAdCreateSchema.partial();
export type AdminAdUpdateInput = z.infer<typeof adminAdUpdateSchema>;

// ── 삭제 ──────────────────────────────────────────────────────────────────────

/** DELETE /api/v1/admin/ads/:id 요청 바디 */
export const adminAdDeleteSchema = z.object({
  note: z.string().min(1, "삭제 사유를 입력해주세요."),
});
export type AdminAdDeleteInput = z.infer<typeof adminAdDeleteSchema>;

// ── 공통 응답 ──────────────────────────────────────────────────────────────────

/** 단순 성공 응답 */
export const adminAdActionResponseSchema = z.object({
  id: z.string(),
  isActive: z.boolean(),
  updatedAt: z.string(),
});
export type AdminAdActionResponse = z.infer<typeof adminAdActionResponseSchema>;
