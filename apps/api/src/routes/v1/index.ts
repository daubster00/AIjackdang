import type { FastifyInstance } from "fastify";
import { env } from "@ai-jakdang/config";
import { registerDevLoginRoute } from "../../auth/dev-login.js";
import { usersRoutes } from "./users.js";
import { registerSignUpRoute } from "./auth/sign-up.js";
import { registerVerifyEmailRoute } from "./auth/verify-email.js";

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

  // ── 사용자 라우트 (Story 1.8 /users/me · 1.10 /users/profile/:nickname) ──────
  await usersRoutes(app);
}
