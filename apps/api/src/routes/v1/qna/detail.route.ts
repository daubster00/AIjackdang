/**
 * Story 3.5 — Q&A 질문 상세 + 작성자 액션
 *
 * GET  /qna/questions/:slug       — 비회원 공개. 상세 + 답변 + contentHtml
 * PATCH /qna/questions/:id/resolve — 작성자 전용. is_resolved=true
 * DELETE /qna/questions/:id        — 작성자 전용. soft-delete (AR-7)
 *
 * 조회수: 브라우저 ViewBeacon(POST /api/v1/views)이 담당 (SSR는 실제 IP 불가).
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  questionDetailResponseSchema,
  errorResponseSchema,
} from "@ai-jakdang/contracts";
import { getDb, schema } from "@ai-jakdang/database";
import { eq, and, isNull } from "drizzle-orm";
import { userAuth } from "../../../auth/user-auth.js";
import { getQuestionBySlug } from "./detail.service.js";

/** 상세 응답 스키마 (questionDetailResponseSchema + contentHtml 추가) */
const questionDetailWithHtmlSchema = questionDetailResponseSchema.extend({
  contentHtml: z.string(),
});

export async function registerQnaDetailRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /qna/questions/:slug — 질문 상세 (비회원 공개) ──────────────────────
  typed.get(
    "/qna/questions/:slug",
    {
      schema: {
        description:
          "Q&A 질문 slug로 상세 조회. 비회원도 열람 가능. answers 포함, contentHtml 서버 변환.",
        tags: ["qna"],
        params: z.object({ slug: z.string().min(1) }),
        response: {
          200: questionDetailWithHtmlSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params;

      const question = await getQuestionBySlug({ slug });

      if (!question) {
        return reply.code(404).send({
          error: {
            code: "QUESTION_NOT_FOUND",
            message: "질문을 찾을 수 없습니다.",
          },
        });
      }

      // 조회수는 브라우저 ViewBeacon(POST /api/v1/views)이 담당한다.
      // (SSR fetch는 실제 클라이언트 IP를 알 수 없어 IP 중복 제거 불가)

      return reply.code(200).send(question);
    },
  );

  // ── PATCH /qna/questions/:id/resolve — 해결됨으로 표시 (작성자 전용) ─────────
  typed.patch(
    "/qna/questions/:id/resolve",
    {
      schema: {
        description:
          "질문을 '해결됨'으로 표시한다. 요청자가 질문 작성자여야 한다(403). 비회원 401.",
        tags: ["qna"],
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: z.object({ id: z.string().uuid(), isResolved: z.literal(true) }),
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      // ── 인증 필수 ─────────────────────────────────────────────────────────
      let currentUserId: string | undefined;
      try {
        const session = await userAuth.api.getSession({
          headers: request.headers as unknown as Headers,
        });
        currentUserId = session?.user?.id;
      } catch {
        // 무시
      }

      if (!currentUserId) {
        return reply.code(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }

      const { id } = request.params;
      const db = getDb();

      // ── 질문 존재 확인 ────────────────────────────────────────────────────
      const [question] = await db
        .select({
          id: schema.questions.id,
          userId: schema.questions.userId,
          status: schema.questions.status,
          deletedAt: schema.questions.deletedAt,
        })
        .from(schema.questions)
        .where(
          and(
            eq(schema.questions.id, id),
            isNull(schema.questions.deletedAt),
          ),
        )
        .limit(1);

      if (!question || question.status === "deleted") {
        return reply.code(404).send({
          error: { code: "QUESTION_NOT_FOUND", message: "질문을 찾을 수 없습니다." },
        });
      }

      // ── 작성자 본인 확인 ──────────────────────────────────────────────────
      if (question.userId !== currentUserId) {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "질문 작성자만 해결됨으로 표시할 수 있습니다." },
        });
      }

      // ── is_resolved = true 업데이트 ──────────────────────────────────────
      await db
        .update(schema.questions)
        .set({ isResolved: true, updatedAt: new Date() })
        .where(eq(schema.questions.id, id));

      return reply.code(200).send({ id, isResolved: true });
    },
  );

  // ── DELETE /qna/questions/:id — 질문 삭제 (soft-delete, AR-7) ──────────────
  typed.delete(
    "/qna/questions/:id",
    {
      schema: {
        description:
          "질문을 소프트 삭제한다(status=deleted, deleted_at 설정). 작성자 본인만 가능(403). 비회원 401.",
        tags: ["qna"],
        params: z.object({ id: z.string().uuid() }),
        response: {
          204: z.undefined(),
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      // ── 인증 필수 ─────────────────────────────────────────────────────────
      let currentUserId: string | undefined;
      try {
        const session = await userAuth.api.getSession({
          headers: request.headers as unknown as Headers,
        });
        currentUserId = session?.user?.id;
      } catch {
        // 무시
      }

      if (!currentUserId) {
        return reply.code(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }

      const { id } = request.params;
      const db = getDb();

      // ── 질문 존재 확인 ────────────────────────────────────────────────────
      const [question] = await db
        .select({
          id: schema.questions.id,
          userId: schema.questions.userId,
          status: schema.questions.status,
          deletedAt: schema.questions.deletedAt,
        })
        .from(schema.questions)
        .where(
          and(
            eq(schema.questions.id, id),
            isNull(schema.questions.deletedAt),
          ),
        )
        .limit(1);

      if (!question || question.status === "deleted") {
        return reply.code(404).send({
          error: { code: "QUESTION_NOT_FOUND", message: "질문을 찾을 수 없습니다." },
        });
      }

      // ── 작성자 본인 확인 ──────────────────────────────────────────────────
      if (question.userId !== currentUserId) {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "질문 작성자만 삭제할 수 있습니다." },
        });
      }

      // ── soft-delete (AR-7): status='deleted', deleted_at=now() ───────────
      await db
        .update(schema.questions)
        .set({
          status: "deleted",
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.questions.id, id));

      return reply.code(204).send();
    },
  );
}
