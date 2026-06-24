/**
 * 대시보드·접속통계 API 등록 진입점 (Story 9.5).
 *
 * 오케스트레이터 stub. Story 9.5 에이전트가 GET dashboard/kpi · dashboard/alerts ·
 * analytics/overview 라우트를 이 폴더(및 analytics 폴더)에 구현하고 이 함수에서 등록한다.
 * adminGuard(active) 적용, requireSuperAdmin 미적용(staff 포함 접근).
 * routes/admin/index.ts 등록은 이미 연결돼 있다.
 */

import type { FastifyInstance } from "fastify";

export async function registerAdminDashboardRoutes(_app: FastifyInstance): Promise<void> {
  // Story 9.5 에이전트가 구현한다 (dashboard kpi/alerts + analytics overview).
}
