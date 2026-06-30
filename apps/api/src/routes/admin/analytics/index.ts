/**
 * 관리자 접속통계 추가 라우트 등록 진입점.
 *
 * 이 파일은 추가된 analytics 엔드포인트를 등록한다.
 * (기존 overview/visitor-trend/referrers/keywords/post-performance/resource-performance는
 *  dashboard/index.ts에서 직접 등록되어 있으므로 여기서는 신규 라우트만 다룬다.)
 *
 * - GET /admin/analytics/page-dwell-time — 페이지별 평균 체류시간
 */

import type { FastifyInstance } from "fastify";
import { registerPageDwellTimeRoute } from "./page-dwell-time.js";

export async function registerAdminAnalyticsRoutes(app: FastifyInstance): Promise<void> {
  await registerPageDwellTimeRoute(app);
}
