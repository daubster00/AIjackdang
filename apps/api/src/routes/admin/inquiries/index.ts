/**
 * 문의 관리 API 등록 진입점 (Story 9.14).
 *
 * GET    /api/v1/admin/inquiries           — 목록 조회
 * GET    /api/v1/admin/inquiries/:id       — 상세+스레드 조회
 * PATCH  /api/v1/admin/inquiries/:id/status — 상태 변경
 * POST   /api/v1/admin/inquiries/:id/replies — 답변 작성
 *
 * adminGuard는 전역 preHandler로 등록되어 있어 별도 적용 불필요 (staff 포함).
 *
 * 참고: contracts/src/admin/inquiries.ts 스키마를 contracts index.ts 에 export하기 전
 *       이 파일에서 직접 zod 스키마를 인라인 정의한다.
 *       오케스트레이터가 contracts/src/index.ts 에 export 추가 후 이 인라인을 제거하면 된다.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  listAdminInquiries,
  getAdminInquiryDetail,
  updateInquiryStatus,
  createAdminReply,
  updateAdminReply,
  deleteAdminReply,
} from "./service.js";
import { getDb } from "@ai-jakdang/database";
import { publishNotification } from "../../../lib/notifications.js";
import { getRedisPublisher } from "../../../lib/redis.js";

// ── 인라인 Zod 스키마 (contracts/src/index.ts export 전 임시) ─────────────────

const adminInquiriesQuerySchema = z.object({
  status: z.enum(["pending", "in_progress", "resolved"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const adminInquiryStatusUpdateSchema = z.object({
  status: z.enum(["in_progress", "resolved"]),
});

const adminInquiryReplyCreateSchema = z.object({
  body: z.unknown(),
});

export async function registerAdminInquiriesRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/admin/inquiries ─────────────────────────────────────────────
  app.get("/admin/inquiries", async (request, reply) => {
    const parsed = adminInquiriesQuerySchema.safeParse(request.query);
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
      const result = await listAdminInquiries(parsed.data);
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      });
    }
  });

  // ── GET /api/v1/admin/inquiries/:id ─────────────────────────────────────────
  app.get("/admin/inquiries/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await getAdminInquiryDetail(id);
      if (!result) {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: "문의를 찾을 수 없습니다." },
        });
      }
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      });
    }
  });

  // ── PATCH /api/v1/admin/inquiries/:id/status ────────────────────────────────
  app.patch("/admin/inquiries/:id/status", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = adminInquiryStatusUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "잘못된 요청입니다.",
          details: parsed.error.flatten(),
        },
      });
    }

    try {
      const result = await updateInquiryStatus(id, parsed.data.status);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: e.message },
        });
      }
      request.log.error(err);
      return reply.status(500).send({
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      });
    }
  });

  // ── POST /api/v1/admin/inquiries/:id/replies ────────────────────────────────
  app.post("/admin/inquiries/:id/replies", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = adminInquiryReplyCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "잘못된 요청입니다.",
          details: parsed.error.flatten(),
        },
      });
    }

    const adminUserId = request.adminSession?.adminUserId;
    if (!adminUserId) {
      return reply.status(401).send({
        error: { code: "ADMIN_UNAUTHORIZED", message: "관리자 인증이 필요합니다." },
      });
    }

    try {
      const result = await createAdminReply({
        inquiryId: id,
        adminUserId,
        body: parsed.data.body,
      });

      // AC#3: inquiry.replied 알림 발행
      // publishNotification을 직접 호출 (DB insert + Redis PUBLISH)
      try {
        const db = getDb();
        const redisPublisher = getRedisPublisher();
        await publishNotification(
          result.inquiry.userId,
          {
            type: "inquiry.replied",
            targetType: "inquiry",
            targetId: result.inquiry.id,
            title: "1:1 문의에 답변이 도착했습니다.",
            body: "관리자가 회원님의 문의에 답변을 작성했습니다.",
          },
          db,
          redisPublisher,
        );
      } catch (notifErr: unknown) {
        // 알림 실패는 무시 — 메인 응답에 영향 주지 않음
        request.log.warn({ err: notifErr }, "[admin/inquiries] inquiry.replied 알림 발행 실패");
      }

      return reply.status(201).send(result.reply);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: e.message },
        });
      }
      request.log.error(err);
      return reply.status(500).send({
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      });
    }
  });

  // ── PATCH /api/v1/admin/inquiries/:id/replies/:replyId ──────────────────────
  app.patch("/admin/inquiries/:id/replies/:replyId", async (request, reply) => {
    const { replyId } = request.params as { id: string; replyId: string };
    const parsed = adminInquiryReplyCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "잘못된 요청입니다.",
          details: parsed.error.flatten(),
        },
      });
    }

    try {
      const result = await updateAdminReply(replyId, parsed.data.body);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: e.message },
        });
      }
      if (e.code === "FORBIDDEN") {
        return reply.status(403).send({
          error: { code: "FORBIDDEN", message: e.message },
        });
      }
      request.log.error(err);
      return reply.status(500).send({
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      });
    }
  });

  // ── DELETE /api/v1/admin/inquiries/:id/replies/:replyId ─────────────────────
  app.delete("/admin/inquiries/:id/replies/:replyId", async (request, reply) => {
    const { replyId } = request.params as { id: string; replyId: string };

    try {
      await deleteAdminReply(replyId);
      return reply.send({ success: true });
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: e.message },
        });
      }
      if (e.code === "FORBIDDEN") {
        return reply.status(403).send({
          error: { code: "FORBIDDEN", message: e.message },
        });
      }
      request.log.error(err);
      return reply.status(500).send({
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      });
    }
  });
}
