/**
 * Story 3.7 — 도움된 답변 지정/해제 (질문자 전용).
 * PATCH /api/v1/qna/questions/:questionId/helpful-answer (setHelpfulAnswerSchema).
 *
 * helpful_answer_id 와 is_resolved 는 독립 — 포인트/등급/마감 연산 없음.
 * "채택/정답/내공" 표현 금지 — "도움된 답변" 어휘만 사용.
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { setHelpfulAnswerSchema, errorResponseSchema } from "@ai-jakdang/contracts";
import { requireAuthHook } from "../../../plugins/require-auth.js";
import { userAuth } from "../../../auth/user-auth.js";
import { setHelpfulAnswer } from "./helpful.service.js";

/** PATCH 성공 응답 */
const setHelpfulAnswerResponseSchema = z.object({
  id: z.string().uuid(),
  helpfulAnswerId: z.string().uuid().nullable(),
});

export async function registerQnaHelpfulRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── PATCH /qna/questions/:questionId/helpful-answer — 도움된 답변 지정/해제 ──
  typed.patch(
    "/qna/questions/:questionId/helpful-answer",
    {
      preHandler: [requireAuthHook],
      schema: {
        description:
          "질문자가 도움된 답변을 지정하거나 해제한다. " +
          "answerId=null 이면 helpful_answer_id 를 해제. " +
          "helpful_answer_id 와 is_resolved 는 독립 — 포인트/등급/마감 연산 없음.",
        tags: ["qna"],
        params: z.object({ questionId: z.string().uuid() }),
        body: setHelpfulAnswerSchema,
        response: {
          200: setHelpfulAnswerResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      // ── 인증 확인 (requireAuthHook에서 이미 검증, 세션 재조회) ──────────────
      const session = await userAuth.api.getSession({
        headers: request.headers as unknown as Headers,
      });
      const userId = session?.user?.id;
      if (!userId) {
        return reply.code(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }

      const { questionId } = request.params;
      const { answerId } = request.body;

      const result = await setHelpfulAnswer({ questionId, userId, answerId });

      if (result.error === "QUESTION_NOT_FOUND") {
        return reply.code(404).send({
          error: { code: "QUESTION_NOT_FOUND", message: "질문을 찾을 수 없습니다." },
        });
      }

      if (result.error === "FORBIDDEN") {
        return reply.code(403).send({
          error: {
            code: "FORBIDDEN",
            message: "질문 작성자만 도움된 답변을 지정할 수 있습니다.",
          },
        });
      }

      if (result.error === "ANSWER_NOT_FOUND") {
        return reply.code(400).send({
          error: {
            code: "ANSWER_NOT_FOUND",
            message: "유효하지 않은 답변 ID입니다.",
          },
        });
      }

      // result.error가 없으면 success branch — id, helpfulAnswerId가 항상 존재한다.
      if (!result.error) {
        return reply.code(200).send({
          id: result.id,
          helpfulAnswerId: result.helpfulAnswerId,
        });
      }
    },
  );
}
