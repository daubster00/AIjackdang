/**
 * Q&A 관리 API 등록 진입점 (Story 9.7).
 *
 * GET    /api/v1/admin/qna/questions              — 질문 목록
 * GET    /api/v1/admin/qna/answers                — 답변 목록
 * PATCH  /api/v1/admin/qna/questions/:id/status   — Q&A 상태 강제 변경 (isResolved 조작)
 * PATCH  /api/v1/admin/qna/questions/:id/hide     — 질문 숨김
 * DELETE /api/v1/admin/qna/questions/:id          — 질문 soft-delete (super_admin)
 * PATCH  /api/v1/admin/qna/answers/:id/hide       — 답변 숨김
 * DELETE /api/v1/admin/qna/answers/:id            — 답변 soft-delete (super_admin)
 */

import type { FastifyInstance } from "fastify";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
import {
  adminQnaQuestionsQuerySchema,
  adminQnaAnswersQuerySchema,
  adminQnaStatusSchema,
} from "@ai-jakdang/contracts";
import {
  listQuestions,
  listAnswers,
  forceQnaStatus,
  hideQuestion,
  deleteQuestion,
  hideAnswer,
  deleteAnswer,
} from "./service.js";

export async function registerAdminQnaRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/admin/qna/questions ──────────────────────────────────────────
  app.get("/admin/qna/questions", async (request, reply) => {
    const parsed = adminQnaQuestionsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() },
      });
    }

    try {
      const result = await listQuestions(parsed.data);
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── GET /api/v1/admin/qna/answers ────────────────────────────────────────────
  app.get("/admin/qna/answers", async (request, reply) => {
    const parsed = adminQnaAnswersQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() },
      });
    }

    try {
      const result = await listAnswers(parsed.data);
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── PATCH /api/v1/admin/qna/questions/:id/status ─────────────────────────────
  app.patch("/admin/qna/questions/:id/status", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = adminQnaStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
      });
    }

    try {
      const result = await forceQnaStatus(id, parsed.data.qnaStatus);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── PATCH /api/v1/admin/qna/questions/:id/hide ───────────────────────────────
  app.patch("/admin/qna/questions/:id/hide", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await hideQuestion(id);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── DELETE /api/v1/admin/qna/questions/:id — super_admin 전용 ────────────────
  app.delete(
    "/admin/qna/questions/:id",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const result = await deleteQuestion(id);
        return reply.send(result);
      } catch (err: unknown) {
        const e = err as Error & { code?: string };
        if (e.code === "NOT_FOUND") {
          return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
        }
        request.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );

  // ── PATCH /api/v1/admin/qna/answers/:id/hide ─────────────────────────────────
  app.patch("/admin/qna/answers/:id/hide", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await hideAnswer(id);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── DELETE /api/v1/admin/qna/answers/:id — super_admin 전용 ──────────────────
  app.delete(
    "/admin/qna/answers/:id",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const result = await deleteAnswer(id);
        return reply.send(result);
      } catch (err: unknown) {
        const e = err as Error & { code?: string };
        if (e.code === "NOT_FOUND") {
          return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
        }
        request.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );
}
