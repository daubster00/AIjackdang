/**
 * 댓글·후기 통합 관리 API 등록 진입점 (Story 9.9).
 *
 * GET    /api/v1/admin/comments          — 통합 목록 조회
 * PATCH  /api/v1/admin/comments/:id/hide — 숨김
 * DELETE /api/v1/admin/comments/:id      — 소프트 삭제 (super_admin)
 * POST   /api/v1/admin/comments/bulk     — 벌크 액션
 */

import type { FastifyInstance } from "fastify";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
import {
  adminCommentsQuerySchema,
  adminCommentsBulkSchema,
} from "@ai-jakdang/contracts/admin/comments";
import {
  listComments,
  hideComment,
  deleteComment,
  bulkCommentAction,
} from "./service.js";

export async function registerAdminCommentsRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/admin/comments ──────────────────────────────────────────────
  app.get("/admin/comments", async (request, reply) => {
    const parsed = adminCommentsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() },
      });
    }

    try {
      const result = await listComments(parsed.data);
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── POST /api/v1/admin/comments/bulk — 경로 충돌 방지: :id 앞에 등록 ─────────
  app.post("/admin/comments/bulk", async (request, reply) => {
    const parsed = adminCommentsBulkSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
      });
    }

    const { ids, action } = parsed.data;

    // delete 는 super_admin 만
    if (action === "delete") {
      if (request.adminSession?.role !== "super_admin") {
        return reply.status(403).send({
          error: { code: "FORBIDDEN", message: "최고 관리자(super_admin) 권한이 필요합니다." },
        });
      }
    }

    try {
      const result = await bulkCommentAction(ids, action);
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── PATCH /api/v1/admin/comments/:id/hide ───────────────────────────────────
  app.patch("/admin/comments/:id/hide", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await hideComment(id);
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

  // ── DELETE /api/v1/admin/comments/:id — super_admin 전용 ────────────────────
  app.delete(
    "/admin/comments/:id",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const result = await deleteComment(id);
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
