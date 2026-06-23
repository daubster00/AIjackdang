import { signUpSchema, errorResponseSchema } from "@ai-jakdang/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { env } from "@ai-jakdang/config";
import { registerDevLoginRoute } from "../../auth/dev-login.js";
import { usersRoutes } from "./users.js";

/**
 * /api/v1 라우트.
 *
 * Better Auth 인스턴스 핸들러는 별도 마운트(app.ts에서 처리).
 * 여기서는 직접 구현 라우트 + 개발 유틸 라우트를 등록한다.
 */
export async function v1Routes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── 개발 전용: dev-login (production 미노출) ───────────────────────────────
  if (env.NODE_ENV !== "production" && env.AUTH_DEV_BYPASS) {
    await registerDevLoginRoute(app);
  }

  // ── 회원가입 스켈레톤 ─────────────────────────────────────────────────────
  // 실제 Better Auth 핸들러 연결은 인증 구현 단계(Story 1.3)에서 진행.
  typed.post(
    "/auth/sign-up",
    {
      schema: {
        body: signUpSchema,
        response: {
          501: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      request.log.info({ email: request.body.email }, "sign-up requested (not implemented)");
      return reply.code(501).send({
        error: {
          code: "NOT_IMPLEMENTED",
          message: "회원가입은 인증 구현 단계에서 제공됩니다.",
        },
      });
    },
  );

  // ── 사용자 라우트 (Story 1.8 /users/me · 1.10 /users/profile/:nickname) ──────
  await usersRoutes(app);
}
