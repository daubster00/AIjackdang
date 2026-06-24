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

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  await registerAdminSignInRoute(app);
  await registerAdminSignUpRoute(app);
  await registerAdminSignOutRoute(app);
}
