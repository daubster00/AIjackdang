/**
 * 실전자료 관리 API 등록 진입점 (Story 9.8).
 *
 * GET    /api/v1/admin/resources                      — 목록 조회
 * GET    /api/v1/admin/resources/:id                  — 상세 (파일 목록 포함)
 * PATCH  /api/v1/admin/resources/:id/hide             — 자료 숨김
 * DELETE /api/v1/admin/resources/:id                  — 자료 소프트딜리트 (super_admin)
 * DELETE /api/v1/admin/resources/:id/files/:fileId    — 첨부파일 소프트딜리트
 * GET    /api/v1/admin/resources/:id/reviews          — 후기 목록
 * PATCH  /api/v1/admin/reviews/:commentId/hide        — 후기 숨김
 * DELETE /api/v1/admin/reviews/:commentId             — 후기 소프트딜리트 (super_admin)
 */

import type { FastifyInstance } from "fastify";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
import {
  adminResourcesQuerySchema,
  adminResourceHideSchema,
  adminResourceDeleteSchema,
  adminResourceFileDeleteSchema,
  adminReviewDeleteSchema,
} from "@ai-jakdang/contracts/admin/resources";
import {
  listResources,
  getResourceDetail,
  hideResource,
  deleteResource,
  deleteResourceFile,
  listResourceReviews,
  hideReview,
  deleteReview,
} from "./service.js";

export async function registerAdminResourcesRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/admin/resources ─────────────────────────────────────────────
  app.get("/admin/resources", async (request, reply) => {
    const parsed = adminResourcesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "잘못된 쿼리 파라미터입니다.",
          details: parsed.error.flatten(),
        },
      });
    }

    try {
      const result = await listResources(parsed.data);
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply
        .status(500)
        .send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── GET /api/v1/admin/resources/:id ─────────────────────────────────────────
  app.get("/admin/resources/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await getResourceDetail(id);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply
        .status(500)
        .send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── PATCH /api/v1/admin/resources/:id/hide ──────────────────────────────────
  app.patch("/admin/resources/:id/hide", async (request, reply) => {
    const { id } = request.params as { id: string };
    // body는 선택적 note — 검증 실패여도 진행 (note 미입력 허용)
    adminResourceHideSchema.safeParse(request.body);

    try {
      const result = await hideResource(id);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply
        .status(500)
        .send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── DELETE /api/v1/admin/resources/:id — super_admin 전용 ──────────────────
  app.delete(
    "/admin/resources/:id",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = adminResourceDeleteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "삭제 사유를 입력하세요.",
            details: parsed.error.flatten(),
          },
        });
      }

      try {
        const result = await deleteResource(id);
        return reply.send(result);
      } catch (err: unknown) {
        const e = err as Error & { code?: string };
        if (e.code === "NOT_FOUND") {
          return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
        }
        request.log.error(err);
        return reply
          .status(500)
          .send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );

  // ── DELETE /api/v1/admin/resources/:id/files/:fileId ──────────────────────
  // 첨부파일 소프트딜리트 — fileStatus='deleted'. R2 실제 삭제는 9.10 worker.
  // UX-DR-A9: 안전성 보증 표시 없음.
  app.delete("/admin/resources/:id/files/:fileId", async (request, reply) => {
    const { id, fileId } = request.params as { id: string; fileId: string };
    const parsed = adminResourceFileDeleteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "삭제 사유를 입력하세요.",
          details: parsed.error.flatten(),
        },
      });
    }

    try {
      const result = await deleteResourceFile(id, fileId);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply
        .status(500)
        .send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── GET /api/v1/admin/resources/:id/reviews ─────────────────────────────────
  app.get("/admin/resources/:id/reviews", async (request, reply) => {
    const { id } = request.params as { id: string };
    const q = request.query as { page?: string; pageSize?: string };
    const page = Math.max(1, Number(q.page ?? "1"));
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize ?? "20")));

    try {
      const result = await listResourceReviews(id, page, pageSize);
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply
        .status(500)
        .send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── PATCH /api/v1/admin/reviews/:commentId/hide ─────────────────────────────
  // comment_status enum이 visible|deleted 만 존재 — 숨김도 deleted로 처리.
  // 엔드포인트는 분리해 두어 추후 'hidden' enum 추가 시 동작만 교체 가능.
  app.patch("/admin/reviews/:commentId/hide", async (request, reply) => {
    const { commentId } = request.params as { commentId: string };

    try {
      const result = await hideReview(commentId);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply
        .status(500)
        .send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── DELETE /api/v1/admin/reviews/:commentId — super_admin 전용 ─────────────
  app.delete(
    "/admin/reviews/:commentId",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { commentId } = request.params as { commentId: string };
      const parsed = adminReviewDeleteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "사유를 입력하세요.",
            details: parsed.error.flatten(),
          },
        });
      }

      try {
        const result = await deleteReview(commentId);
        return reply.send(result);
      } catch (err: unknown) {
        const e = err as Error & { code?: string };
        if (e.code === "NOT_FOUND") {
          return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
        }
        request.log.error(err);
        return reply
          .status(500)
          .send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );
}
