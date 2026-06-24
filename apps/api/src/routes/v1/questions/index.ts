/**
 * GET /api/v1/questions — 홈 페이지 최신 질문 목록 (Story 8.5)
 *
 * 기존 /api/v1/qna/questions (Epic 3) 와 별개 엔드포인트.
 * 홈 페이지 ③묻고답하기 섹션 전용 — 경량 응답(id, slug, title, status, commentCount, createdAt).
 *
 * 쿼리 파라미터:
 *   limit  : 1~20 (기본 5)
 *   sort   : 'latest' (기본)
 *   status : 'published' (기본, 삭제된 글 제외)
 *
 * 응답: { items: QuestionItem[] }
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getDb, schema } from "@ai-jakdang/database";
import { latestQuestionsResponseSchema } from "@ai-jakdang/contracts/home";
import { errorResponseSchema } from "@ai-jakdang/contracts";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { deriveQuestionStatus } from "@ai-jakdang/core";

const questionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
  sort: z.enum(["latest"]).default("latest"),
  status: z.enum(["published"]).default("published"),
});

export async function registerHomeQuestionsRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/questions",
    {
      schema: {
        description:
          "홈 페이지 최신 질문 목록 (경량). status=published, deleted_at IS NULL 필터. 비회원 공개.",
        tags: ["questions"],
        querystring: questionsQuerySchema,
        response: {
          200: latestQuestionsResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { limit } = request.query;

      const db = getDb();

      // 공개 답변 수 서브쿼리
      const answerCountSq = db
        .select({
          questionId: schema.answers.questionId,
          cnt: sql<number>`count(*)::int`.as("cnt"),
        })
        .from(schema.answers)
        .where(
          and(
            eq(schema.answers.status, "published"),
            isNull(schema.answers.deletedAt),
          ),
        )
        .groupBy(schema.answers.questionId)
        .as("answer_counts");

      const rows = await db
        .select({
          id: schema.questions.id,
          slug: schema.questions.slug,
          title: schema.questions.title,
          isResolved: schema.questions.isResolved,
          helpfulAnswerId: schema.questions.helpfulAnswerId,
          createdAt: schema.questions.createdAt,
          answerCount: sql<number>`COALESCE(${answerCountSq.cnt}, 0)`.as("answer_count"),
        })
        .from(schema.questions)
        .leftJoin(answerCountSq, eq(schema.questions.id, answerCountSq.questionId))
        .where(
          and(
            eq(schema.questions.status, "published"),
            isNull(schema.questions.deletedAt),
          ),
        )
        .orderBy(desc(schema.questions.createdAt))
        .limit(limit);

      const items = rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        status: deriveQuestionStatus({
          answerCount: r.answerCount,
          // isResolved=true 이면 helpfulAnswerId 와 무관하게 resolved 처리
          acceptedAnswerId: r.isResolved ? (r.helpfulAnswerId ?? "resolved") : (r.helpfulAnswerId ?? null),
        }),
        commentCount: r.answerCount,
        createdAt: r.createdAt.toISOString(),
      }));

      return reply.code(200).send({ items });
    },
  );
}
