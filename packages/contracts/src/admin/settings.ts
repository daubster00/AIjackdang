/**
 * 사이트 설정 계약 (Story 9.15).
 *
 * GET  /api/v1/admin/settings  — 전체 설정 flat JSON 응답
 * PATCH /api/v1/admin/settings — 변경된 키만 전달, UPSERT 처리
 */

import { z } from "zod";

// ── PATCH 요청 본문 ────────────────────────────────────────────────────────────

/**
 * 사이트 설정 업데이트 스키마.
 * 모든 키는 optional — 변경된 것만 전달한다.
 */
export const adminSettingsPatchSchema = z.object({
  // 기본 설정
  site_name: z.string().min(1).max(100).optional(),
  operator_email: z.string().email().optional(),
  site_description: z.string().max(500).optional(),
  seo_title: z.string().max(100).optional(),
  seo_description: z.string().max(300).optional(),
  og_image: z.string().max(500).optional(),
  favicon_url: z.string().max(500).optional(),

  // 신고 설정
  auto_hide_enabled: z.boolean().optional(),
  auto_hide_threshold: z.number().int().min(1).max(1000).optional(),
  report_reasons: z.array(z.string().min(1).max(50)).optional(),
  forbidden_words: z.array(z.string().min(1).max(100)).optional(),

  // 콘텐츠 설정
  content_retention_days: z.number().int().min(1).max(36500).optional(),
  popular_post_metric: z.string().max(50).optional(),
  popular_resource_metric: z.string().max(50).optional(),

  // 파일 설정
  file_allowed_extensions: z.string().max(500).optional(),
  max_upload_mb: z.number().int().min(1).max(1000).optional(),
  image_extensions: z.string().max(500).optional(),
  resource_extensions: z.string().max(500).optional(),
});

export type AdminSettingsPatch = z.infer<typeof adminSettingsPatchSchema>;

// ── GET 응답 ────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/settings 응답.
 * getAllSiteSettings()가 반환하는 flat Record를 그대로 반환한다.
 */
export const adminSettingsResponseSchema = z.object({
  // 기본 설정
  site_name: z.string().optional(),
  operator_email: z.string().optional(),
  site_description: z.string().optional(),
  seo_title: z.string().optional(),
  seo_description: z.string().optional(),
  og_image: z.string().optional(),
  favicon_url: z.string().optional(),

  // 신고 설정
  auto_hide_enabled: z.boolean().optional(),
  auto_hide_threshold: z.number().optional(),
  report_reasons: z.array(z.string()).optional(),
  forbidden_words: z.array(z.string()).optional(),

  // 콘텐츠 설정
  content_retention_days: z.number().optional(),
  popular_post_metric: z.string().optional(),
  popular_resource_metric: z.string().optional(),

  // 파일 설정
  file_allowed_extensions: z.string().optional(),
  max_upload_mb: z.number().optional(),
  image_extensions: z.string().optional(),
  resource_extensions: z.string().optional(),
});

export type AdminSettingsResponse = z.infer<typeof adminSettingsResponseSchema>;

// ── PATCH 응답 ──────────────────────────────────────────────────────────────────

export const adminSettingsSaveResponseSchema = z.object({
  updated: z.array(z.string()),
});

export type AdminSettingsSaveResponse = z.infer<typeof adminSettingsSaveResponseSchema>;
