/**
 * 신고 관리 API 등록 진입점 (Story 9.10).
 *
 * GET    /api/v1/admin/reports                    — 신고 목록(필터: status/targetType/dateFrom/dateTo/q/page/pageSize)
 * GET    /api/v1/admin/reports/:id                — 신고 상세(대상 콘텐츠 미리보기 포함)
 * PATCH  /api/v1/admin/reports/:id/review         — 접수→확인중 변경
 * PATCH  /api/v1/admin/reports/:id/hide           — 위반 확정+숨김(트랜잭션: resolved + target hidden)
 * PATCH  /api/v1/admin/reports/:id/reject         — 반려(note 필수)
 */

import type { FastifyInstance } from "fastify";
import {
  adminReportsQuerySchema,
  adminReportHideSchema,
  adminReportRejectSchema,
} from "@ai-jakdang/contracts";
import {
  listReports,
  getReport,
  markReviewing,
  hideTarget,
  rejectReport,
} from "./service.js";

export async function registerAdminReportsRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/admin/reports ──────────────────────────────────────────────
  app.get("/api/v1/admin/reports", async (request, reply) => {
    const parsed = adminReportsQuerySchema.safeParse(request.query);
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
      const result = await listReports(parsed.data);
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      });
    }
  });

  // ── GET /api/v1/admin/reports/:id ─────────────────────────────────────────
  app.get("/api/v1/admin/reports/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await getReport(id);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply.status(500).send({
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      });
    }
  });

  // ── PATCH /api/v1/admin/reports/:id/review ─────────────────────────────────
  // 접수(pending) → 확인중(reviewing) 상태 변경. 저위험: 즉시+토스트(undo 가능).
  app.patch("/api/v1/admin/reports/:id/review", async (request, reply) => {
    const { id } = request.params as { id: string };
    const adminId = request.adminSession?.adminUserId;

    if (!adminId) {
      return reply.status(401).send({
        error: { code: "ADMIN_UNAUTHORIZED", message: "관리자 인증이 필요합니다." },
      });
    }

    try {
      const result = await markReviewing(id, adminId);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply.status(500).send({
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      });
    }
  });

  // ── PATCH /api/v1/admin/reports/:id/hide ──────────────────────────────────
  // 위반 확정+숨김: reports.status='resolved' + 대상 콘텐츠 status='hidden' (트랜잭션).
  // 저위험(되돌릴 수 있음): 즉시+토스트(undo 가능).
  app.patch("/api/v1/admin/reports/:id/hide", async (request, reply) => {
    const { id } = request.params as { id: string };
    const adminId = request.adminSession?.adminUserId;

    if (!adminId) {
      return reply.status(401).send({
        error: { code: "ADMIN_UNAUTHORIZED", message: "관리자 인증이 필요합니다." },
      });
    }

    // note는 선택 사항
    const parsed = adminReportHideSchema.safeParse(request.body);
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
      const result = await hideTarget(id, adminId);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply.status(500).send({
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      });
    }
  });

  // ── PATCH /api/v1/admin/reports/:id/reject ────────────────────────────────
  // 반려: note(사유) 필수 → reports.status='dismissed'. 대상 콘텐츠 변경 없음.
  // 위험(되돌리기 어려움): 모달+사유 필수, note 없으면 400.
  app.patch("/api/v1/admin/reports/:id/reject", async (request, reply) => {
    const { id } = request.params as { id: string };
    const adminId = request.adminSession?.adminUserId;

    if (!adminId) {
      return reply.status(401).send({
        error: { code: "ADMIN_UNAUTHORIZED", message: "관리자 인증이 필요합니다." },
      });
    }

    const parsed = adminReportRejectSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "반려 사유를 입력해주세요.",
          details: parsed.error.flatten(),
        },
      });
    }

    try {
      const result = await rejectReport(id, adminId, parsed.data.note);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply.status(500).send({
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      });
    }
  });
}
