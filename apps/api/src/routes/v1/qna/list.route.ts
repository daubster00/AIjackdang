/**
 * GET /api/v1/qna/questions — Q&A 질문 목록 (Story 3.2)
 *
 * 비회원 포함 공개. 쿼리 파라미터로 상태 필터·정렬·페이지네이션.
 * 응답: { items: QuestionListItemResponse[], meta: PaginationMeta }
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  questionListQuerySchema,
  paginatedQuestionsSchema,
  errorResponseSchema,
} from "@ai-jakdang/contracts";
import { getQuestions } from "./list.service.js";

export async function registerQnaListRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /qna/questions — 질문 목록 (비회원 공개) ────────────────────────────
  typed.get(
    "/qna/questions",
    {
      schema: {
        description:
          "Q&A 질문 목록. 비회원도 열람 가능. 상태 필터(all/waiting/answered/resolved/popular), 정렬(latest/popular), 페이지네이션 지원.",
        tags: ["qna"],
        querystring: questionListQuerySchema,
        response: {
          200: paginatedQuestionsSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { status, sort, page, pageSize } = request.query;

      const result = await getQuestions({
        status,
        sort,
        page,
        pageSize,
      });

      return reply.code(200).send(result);
    },
  );
}
