/**
 * 관리자 라우트 등록 진입점 (Story 9.2).
 *
 * /api/v1/ prefix 없이 등록하는 이유:
 * 각 라우트 핸들러가 이미 /admin/auth/sign-in 등 전체 경로를 포함하므로
 * prefix를 추가하면 /api/v1/admin/... 로 마운트된다.
 *
 * adminGuardHook은 app.ts에서 전역 preHandler로 등록되어 있고,
 * /api/v1/admin/auth/* 패턴을 자동으로 제외한다.
 */

import type { FastifyInstance } from "fastify";
import { registerAdminSignInRoute } from "./auth/sign-in.js";
import { registerAdminSignOutRoute } from "./auth/sign-out.js";
import { registerAdminSignUpRoute } from "./auth/sign-up.js";
import { registerAdminMembersRoutes } from "./admin-members/index.js";
import { registerAdminDashboardRoutes } from "./dashboard/index.js";
import { registerAdminPostsRoutes } from "./posts/index.js";
import { registerAdminQnaRoutes } from "./qna/index.js";
import { registerAdminResourcesRoutes } from "./resources/index.js";
import { registerAdminUserMembersRoutes } from "./members/index.js";
import { registerAdminInquiriesRoutes } from "./inquiries/index.js";
import { registerAdminSettingsRoutes } from "./settings/index.js";
import { registerAdminCommentsRoutes } from "./comments/index.js";
import { registerAdminPointsRoutes } from "./points/index.js";
import { registerAdminGradesRoutes } from "./grades/index.js";
import { registerAdminBadgesRoutes } from "./badges/index.js";
import { registerAdminAdsRoutes } from "./ads/index.js";
import { registerAdminMessagesRoutes } from "./messages/index.js";
import { registerAdminReportsRoutes } from "./reports/index.js";
import { registerAdminAccountRoutes } from "./account/index.js";

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  await registerAdminSignInRoute(app);
  await registerAdminSignUpRoute(app);
  await registerAdminSignOutRoute(app);

  // 관리자 본인 계정(셀프 프로필) 조회·수정
  await registerAdminAccountRoutes(app);

  // Epic 9 병렬 단계 (9.4·9.5·9.6) — 각 등록 함수는 해당 폴더에서 구현된다.
  await registerAdminMembersRoutes(app);
  await registerAdminDashboardRoutes(app);
  await registerAdminPostsRoutes(app);

  // Epic 9 Wave A (9.7·9.8·9.12·9.14·9.15) — Q&A·실전자료·회원·문의·사이트설정 관리.
  await registerAdminQnaRoutes(app);
  await registerAdminResourcesRoutes(app);
  await registerAdminUserMembersRoutes(app);
  await registerAdminInquiriesRoutes(app);
  await registerAdminSettingsRoutes(app);

  // Epic 9 Wave B (9.9·9.13·9.16·9.18) — 댓글·포인트/등급/뱃지·광고·쪽지 모더레이션.
  await registerAdminCommentsRoutes(app);
  await registerAdminPointsRoutes(app);
  await registerAdminGradesRoutes(app);
  await registerAdminBadgesRoutes(app);
  await registerAdminAdsRoutes(app);
  await registerAdminMessagesRoutes(app);

  // Epic 9 Wave C (9.10) — 신고 통합 큐·처리·반려.
  await registerAdminReportsRoutes(app);
}
