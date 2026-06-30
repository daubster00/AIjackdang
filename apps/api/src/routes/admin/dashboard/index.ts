/**
 * 대시보드·접속통계 API 등록 진입점 (Story 9.5).
 *
 * - GET /admin/dashboard/kpi — 핵심 KPI 집계
 * - GET /admin/dashboard/alerts — 운영 알림 집계
 * - GET /admin/analytics/overview — 기간별 접속 통계
 *
 * adminGuard(active) 적용 (전역 preHandler). requireSuperAdmin 미적용(staff 포함).
 * routes/admin/index.ts 등록은 이미 연결돼 있다.
 */

import type { FastifyInstance } from "fastify";
import { registerDashboardKpiRoute } from "./kpi.js";
import { registerDashboardAlertsRoute } from "./alerts.js";
import { registerAnalyticsOverviewRoute } from "../analytics/overview.js";
import { registerVisitorTrendRoute } from "../analytics/visitor-trend.js";
import { registerReferrersRoute } from "../analytics/referrers.js";
import { registerKeywordsRoute } from "../analytics/keywords.js";
import { registerPostPerformanceRoute } from "../analytics/post-performance.js";
import { registerResourcePerformanceRoute } from "../analytics/resource-performance.js";
import { registerAdminAnalyticsRoutes } from "../analytics/index.js";
import { registerRecentContentRoute } from "./recent-content.js";

export async function registerAdminDashboardRoutes(app: FastifyInstance): Promise<void> {
  await registerDashboardKpiRoute(app);
  await registerDashboardAlertsRoute(app);
  await registerAnalyticsOverviewRoute(app);

  // 접속통계 추가 API
  await registerVisitorTrendRoute(app);
  await registerReferrersRoute(app);
  await registerKeywordsRoute(app);
  await registerPostPerformanceRoute(app);
  await registerResourcePerformanceRoute(app);

  // 접속통계 신규 API (page-dwell-time 등)
  await registerAdminAnalyticsRoutes(app);

  // 대시보드 최근 콘텐츠
  await registerRecentContentRoute(app);
}
