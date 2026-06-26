/**
 * 쪽지 모더레이션 관리 API (Story 9.18).
 *
 * GET    /api/v1/admin/messages              — 목록 (탭/필터/페이지)
 * GET    /api/v1/admin/messages/:id          — 상세 + 연결 신고 목록
 * PATCH  /api/v1/admin/messages/:id/hide     — 숨김
 * PATCH  /api/v1/admin/messages/:id/unhide   — 숨김 복구
 * DELETE /api/v1/admin/messages/:id          — soft-delete (super_admin)
 * POST   /api/v1/admin/messages/:id/restrict-sender — 발신제한
 * POST   /api/v1/admin/messages/bulk-hide    — 벌크 숨김
 * DELETE /api/v1/admin/messages/bulk         — 벌크 삭제 (super_admin)
 */

import type { FastifyInstance } from "fastify";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
import {
  adminMessagesQuerySchema,
  adminMessagesBulkHideSchema,
  adminMessagesBulkDeleteSchema,
  adminMessageRestrictSenderSchema,
} from "@ai-jakdang/contracts/admin/messages";
import {
  listMessages,
  getMessageDetail,
  hideMessage,
  unhideMessage,
  deleteMessage,
  restrictSender,
  bulkHideMessages,
  bulkDeleteMessages,
} from "./service.js";

export async function registerAdminMessagesRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/admin/messages — 목록 ────────────────────────────────────────
  app.get("/admin/messages", async (request, reply) => {
    const parsed = adminMessagesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() },
      });
    }

    try {
      const result = await listMessages(parsed.data);
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── POST /api/v1/admin/messages/bulk-hide — 벌크 숨김 (경로 충돌 방지: :id 앞에 등록) ─
  app.post("/admin/messages/bulk-hide", async (request, reply) => {
    const parsed = adminMessagesBulkHideSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
      });
    }

    try {
      const result = await bulkHideMessages(parsed.data.ids);
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── DELETE /api/v1/admin/messages/bulk — 벌크 삭제 (super_admin) ─────────────
  app.delete(
    "/admin/messages/bulk",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const parsed = adminMessagesBulkDeleteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
        });
      }

      try {
        const result = await bulkDeleteMessages(parsed.data.ids);
        return reply.send(result);
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );

  // ── GET /api/v1/admin/messages/:id — 상세 ────────────────────────────────────
  app.get("/admin/messages/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await getMessageDetail(id);
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

  // ── PATCH /api/v1/admin/messages/:id/hide ────────────────────────────────────
  app.patch("/admin/messages/:id/hide", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await hideMessage(id);
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

  // ── PATCH /api/v1/admin/messages/:id/unhide ──────────────────────────────────
  app.patch("/admin/messages/:id/unhide", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await unhideMessage(id);
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

  // ── DELETE /api/v1/admin/messages/:id — super_admin 전용 ─────────────────────
  app.delete(
    "/admin/messages/:id",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const result = await deleteMessage(id);
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

  // ── POST /api/v1/admin/messages/:id/restrict-sender ──────────────────────────
  app.post("/admin/messages/:id/restrict-sender", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = adminMessageRestrictSenderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
      });
    }

    try {
      const result = await restrictSender(
        id,
        parsed.data.days,
        parsed.data.reason,
        request.adminSession?.adminUserId ?? null,
      );
      return reply.status(201).send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });
}
