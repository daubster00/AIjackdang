import type { FastifyInstance } from "fastify";
import { env } from "@ai-jakdang/config";
import { registerDevLoginRoute } from "../../auth/dev-login.js";
import { usersRoutes } from "./users.js";
import { registerSignUpRoute } from "./auth/sign-up.js";
import { registerVerifyEmailRoute } from "./auth/verify-email.js";
import { registerForgotPasswordRoute } from "./auth/forgot-password.js";
import { registerResetPasswordRoute } from "./auth/reset-password.js";
import { postsRoutes } from "./posts/routes.js";
import { tagsRoutes } from "./tags/routes.js";
import { resourcesRoutes } from "./resources/routes.js";
import { registerMeResourcesRoutes } from "./me/resources.route.js";

/**
 * /api/v1 라우트.
 *
 * Better Auth 인스턴스 핸들러는 별도 마운트(app.ts에서 처리).
 * 여기서는 직접 구현 라우트 + 개발 유틸 라우트를 등록한다.
 */
export async function v1Routes(app: FastifyInstance) {
  // ── 개발 전용: dev-login (production 미노출) ───────────────────────────────
  if (env.NODE_ENV !== "production" && env.AUTH_DEV_BYPASS) {
    await registerDevLoginRoute(app);
  }

  // ── 이메일 회원가입 (Story 1.3) ───────────────────────────────────────────
  // Fastify 특정 경로(/auth/sign-up)가 와일드카드(/auth/*)보다 우선 매칭된다.
  await registerSignUpRoute(app);

  // ── 이메일 인증 보조 라우트 (Story 1.3) ──────────────────────────────────
  // Better Auth가 /verify-email 을 처리하지만 추가 보조 엔드포인트 등록
  await registerVerifyEmailRoute(app);

  // ── 비밀번호 재설정 (Story 1.6) ──────────────────────────────────────────
  // 커스텀 라우트: POST /auth/forgot-password · POST /auth/reset-password
  // user-auth.ts(Better Auth) 를 수정하지 않고 완전히 독립 구현한다.
  await registerForgotPasswordRoute(app);
  await registerResetPasswordRoute(app);

  // ── 사용자 라우트 (Story 1.8 /users/me · 1.10 /users/profile/:nickname) ──────
  await usersRoutes(app);

  // ── 게시글 라우트 (Story 2.3 GET /posts · Story 2.7 POST /posts) ───────────────
  await postsRoutes(app);

  // ── 태그 라우트 (Story 2.7 GET /tags?q=) ────────────────────────────────────────
  await tagsRoutes(app);

  // ── 실전자료 라우트 (Epic 4: 목록/상세/등록/업로드/다운로드/평점/수정삭제) ──────
  await resourcesRoutes(app);

  // ── 마이페이지 내 자료 라우트 (Story 4.9 GET /me/resources) ──────────────────
  await registerMeResourcesRoutes(app);
}
