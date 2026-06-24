/**
 * Story 3.6 — 답변 CRUD.
 *
 * POST   /api/v1/qna/questions/:questionId/answers  — 답변 등록 (인증 필수)
 * PATCH  /api/v1/qna/answers/:id                   — 답변 수정 (작성자 본인)
 * DELETE /api/v1/qna/answers/:id                   — 답변 삭제 soft-delete (작성자 본인)
 *
 * - 저장 대상: schema.answers (schema.posts / schema.comments 절대 사용 금지).
 * - content_json: Tiptap JSON 형식 저장. HTML 원본 저장 금지 (AR-8).
 * - soft-delete: status='deleted' + deleted_at=now() (AR-7).
 * - 답변 좋아요·신고: Epic 5 예약 슬롯. reaction/report 테이블 건드리지 않음.
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  createAnswerSchema,
  answerResponseSchema,
  errorResponseSchema,
} from "@ai-jakdang/contracts";
import { requireAuthHook } from "../../../plugins/require-auth.js";
import { contentGuard } from "../../../middleware/contentGuard.js";
import { userAuth } from "../../../auth/user-auth.js";
import { createAnswer, updateAnswer, deleteAnswer } from "./answer.service.js";

/** 답변 단건 응답 + contentHtml */
const answerWithHtmlSchema = answerResponseSchema.extend({
  contentHtml: z.string(),
});

/** 답변 수정 요청 */
const updateAnswerSchema = z.object({
  contentJson: z.record(z.string(), z.unknown()),
});

export async function registerQnaAnswerRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── POST /qna/questions/:questionId/answers — 답변 등록 ─────────────────────
  typed.post(
    "/qna/questions/:questionId/answers",
    {
      preHandler: [requireAuthHook, contentGuard],
      schema: {
        description:
          "Q&A 질문에 답변을 등록한다. 인증 필수. content_json(Tiptap JSON lite preset)으로 저장. " +
          "등록 후 deriveQuestionStatus가 '답변있음'으로 갱신됨 (클라이언트 재패치로 확인).",
        tags: ["qna"],
        params: z.object({ questionId: z.string().uuid() }),
        body: createAnswerSchema,
        response: {
          201: answerWithHtmlSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      // ── 인증 (requireAuthHook에서 이미 검증, 세션 재조회) ──────────────────
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
      const { contentJson } = request.body;

      const result = await createAnswer({ questionId, userId, contentJson });

      if (result.error === "QUESTION_NOT_FOUND") {
        return reply.code(404).send({
          error: { code: "QUESTION_NOT_FOUND", message: "질문을 찾을 수 없습니다." },
        });
      }

      return reply.code(201).send(result.answer!);
    },
  );

  // ── PATCH /qna/answers/:id — 답변 수정 (작성자 본인) ────────────────────────
  typed.patch(
    "/qna/answers/:id",
    {
      preHandler: [requireAuthHook],
      schema: {
        description:
          "답변을 수정한다. 작성자 본인만 가능(403). content_json과 updated_at 갱신.",
        tags: ["qna"],
        params: z.object({ id: z.string().uuid() }),
        body: updateAnswerSchema,
        response: {
          200: answerWithHtmlSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const session = await userAuth.api.getSession({
        headers: request.headers as unknown as Headers,
      });
      const userId = session?.user?.id;
      if (!userId) {
        return reply.code(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }

      const { id } = request.params;
      const { contentJson } = request.body;

      const result = await updateAnswer({ answerId: id, userId, contentJson });

      if (result.error === "ANSWER_NOT_FOUND") {
        return reply.code(404).send({
          error: { code: "ANSWER_NOT_FOUND", message: "답변을 찾을 수 없습니다." },
        });
      }

      if (result.error === "FORBIDDEN") {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "본인 답변만 수정할 수 있습니다." },
        });
      }

      // result.error가 없으면 result.answer가 반드시 존재한다 (discriminated union)
      return reply.code(200).send(result.answer!);
    },
  );

  // ── DELETE /qna/answers/:id — 답변 소프트 삭제 (AR-7) ────────────────────────
  typed.delete(
    "/qna/answers/:id",
    {
      preHandler: [requireAuthHook],
      schema: {
        description:
          "답변을 소프트 삭제한다(status=deleted, deleted_at 설정). 작성자 본인만 가능(403). " +
          "유일 공개 답변 삭제 시 질문 derivedStatus가 '답변대기'로 복귀 " +
          "(detail.service가 published 답변 수를 실시간 계산).",
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
      const session = await userAuth.api.getSession({
        headers: request.headers as unknown as Headers,
      });
      const userId = session?.user?.id;
      if (!userId) {
        return reply.code(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }

      const { id } = request.params;

      const result = await deleteAnswer({ answerId: id, userId });

      if (result.error === "ANSWER_NOT_FOUND") {
        return reply.code(404).send({
          error: { code: "ANSWER_NOT_FOUND", message: "답변을 찾을 수 없습니다." },
        });
      }

      if (result.error === "FORBIDDEN") {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "본인 답변만 삭제할 수 있습니다." },
        });
      }

      return reply.code(204).send();
    },
  );
}
