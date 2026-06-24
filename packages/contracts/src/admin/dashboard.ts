/**
 * 관리자 대시보드·접속통계 계약 (Story 9.5).
 *
 * DashboardKpiResponse / DashboardAlertsResponse / AnalyticsOverviewResponse
 * Zod 스키마와 TypeScript 타입.
 */

import { z } from "zod";

// ── 대시보드 KPI ──────────────────────────────────────────────────────────────

/** GET /api/v1/admin/dashboard/kpi 응답 */
export const dashboardKpiResponseSchema = z.object({
  totalUsers: z.number().int().nonnegative(),
  todayNewUsers: z.number().int().nonnegative(),
  totalPosts: z.number().int().nonnegative(),
  todayNewPosts: z.number().int().nonnegative(),
  totalDownloads: z.number().int().nonnegative(),
  pendingReports: z.number().int().nonnegative(),
});
export type DashboardKpiResponse = z.infer<typeof dashboardKpiResponseSchema>;

// ── 운영 알림 ─────────────────────────────────────────────────────────────────

/** GET /api/v1/admin/dashboard/alerts 응답 */
export const dashboardAlertsResponseSchema = z.object({
  reports: z.number().int().nonnegative(),
  pendingQna: z.number().int().nonnegative(),
  newResources: z.number().int().nonnegative(),
});
export type DashboardAlertsResponse = z.infer<typeof dashboardAlertsResponseSchema>;

// ── 접속 통계 개요 ────────────────────────────────────────────────────────────

/** GET /api/v1/admin/analytics/overview?from=&to= 개별 항목 */
export const analyticsOverviewItemSchema = z.object({
  date: z.string(),
  newUsers: z.number().int().nonnegative(),
  newPosts: z.number().int().nonnegative(),
  downloads: z.number().int().nonnegative(),
});
export type AnalyticsOverviewItem = z.infer<typeof analyticsOverviewItemSchema>;

/** GET /api/v1/admin/analytics/overview?from=&to= 응답 */
export const analyticsOverviewResponseSchema = z.object({
  items: z.array(analyticsOverviewItemSchema),
});
export type AnalyticsOverviewResponse = z.infer<typeof analyticsOverviewResponseSchema>;
