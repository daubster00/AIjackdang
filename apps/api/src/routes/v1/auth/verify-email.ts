/**
 * GET /api/v1/auth/verify-email?token= — 이메일 인증 완료 (Story 1.3).
 *
 * Better Auth 의 /api/v1/auth/verify-email 엔드포인트는 이미 Better Auth 핸들러가
 * 처리한다(app.ts 의 /api/v1/auth/* 와일드카드).
 * 이 파일은 검증 완료 후 리다이렉트를 커스터마이징하거나 API 응답을 반환하는
 * 보조 라우트가 필요한 경우를 위해 준비한다.
 *
 * 현재 구현: Better Auth 가 /verify-email 을 자체 처리한다.
 * - 토큰 유효 → callbackURL 로 리다이렉트 (기본: "/")
 * - 토큰 만료/위조 → 400 오류
 *
 * 클라이언트(web)의 /signup/verified 페이지는 인증 성공 후 리다이렉트 대상이 된다.
 * 가입 라우트(sign-up.ts) 에서 callbackURL="/signup/verified" 를 지정하면 된다.
 *
 * 이 파일은 Better Auth 가 처리하지 않는 추가 API 응답용으로만 사용한다.
 */

import { errorResponseSchema } from "@ai-jakdang/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { userAuth } from "../../../auth/user-auth.js";

const verifyEmailResponseSchema = z.object({
  message: z.string(),
});

/**
 * 이메일 인증 결과 확인 라우트.
 * GET /api/v1/auth/check-verification?token= (Better Auth /verify-email 과 다른 경로)
 *
 * 참고: Better Auth 의 /verify-email 은 이미 /api/v1/auth/* 와일드카드가 처리한다.
 * 웹에서 인증 완료 페이지로 리다이렉트하려면:
 *   callbackURL 파라미터를 가입 시 넘기거나,
 *   Better Auth 기본 리다이렉트 동작을 사용한다.
 */
export async function registerVerifyEmailRoute(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  /**
   * GET /auth/verify-email-status?token=
   * Better Auth 가 토큰을 검증했는지 확인하는 보조 엔드포인트.
   * 토큰이 유효하면 users.emailVerified=true 가 된 상태.
   */
  typed.get(
    "/auth/verify-email-status",
    {
      schema: {
        description: "이메일 인증 토큰 상태 확인.",
        tags: ["auth"],
        querystring: z.object({ token: z.string() }),
        response: {
          200: verifyEmailResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { token } = request.query;

      if (!token) {
        return reply.code(400).send({
          error: {
            code: "INVALID_TOKEN",
            message: "인증 토큰이 없습니다.",
          },
        });
      }

      try {
        // Better Auth 내부 verifyEmail API 호출
        await userAuth.api.verifyEmail({
          query: { token, callbackURL: "/" },
        });

        return reply.code(200).send({
          message: "이메일 인증이 완료됐습니다.",
        });
      } catch {
        return reply.code(400).send({
          error: {
            code: "INVALID_TOKEN",
            message: "인증 링크가 만료됐거나 유효하지 않습니다.",
          },
        });
      }
    },
  );
}
