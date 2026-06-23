import { signUpSchema, publicUserSchema, errorResponseSchema } from "@ai-jakdang/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

/**
 * /api/v1 라우트.
 *
 * 이번 기반 단계에서는 실제 회원/게시판 기능을 구현하지 않는다.
 * 공유 Zod 스키마(@ai-jakdang/contracts)를 API 검증에 그대로 재사용하는 패턴만 보여준다.
 * 실제 인증/DB 연동은 인증·게시판 구현 단계에서 추가한다.
 */
export async function v1Routes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // 회원가입(예시 스켈레톤): 입력은 공유 스키마로 검증하고, 아직 DB 에 저장하지 않는다.
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

  // 현재 로그인 사용자(예시): 응답 규격만 공유 스키마로 고정한다.
  typed.get(
    "/auth/me",
    {
      schema: {
        response: {
          401: errorResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      void publicUserSchema; // 응답 규격은 publicUserSchema 를 따른다(구현 단계에서 사용).
      return reply.code(401).send({
        error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
      });
    },
  );
}
