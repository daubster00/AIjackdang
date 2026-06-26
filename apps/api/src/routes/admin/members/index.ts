/**
 * 유저 회원 관리 API 등록 진입점 (Story 9.12).
 *
 * GET    /api/v1/admin/members              — 목록
 * GET    /api/v1/admin/members/badges       — 뱃지 마스터 목록
 * GET    /api/v1/admin/members/:id          — 상세
 * POST   /api/v1/admin/members/:id/sanctions      — 제재 생성
 * DELETE /api/v1/admin/members/:id/sanctions/:sid — 제재 해제 (super_admin)
 * POST   /api/v1/admin/members/:id/points         — 포인트 지급
 * DELETE /api/v1/admin/members/:id/points         — 포인트 차감 (super_admin)
 * PATCH  /api/v1/admin/members/:id/grade          — 등급 변경 (super_admin)
 * POST   /api/v1/admin/members/:id/badges         — 뱃지 지급
 * DELETE /api/v1/admin/members/:id/badges/:bid    — 뱃지 회수 (super_admin)
 *
 * 이름: registerAdminUserMembersRoutes (admin-members 운영자 계정과 충돌 방지)
 */

import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";

// ── 인라인 스키마 (contracts/src/admin/members.ts 미노출 시 로컬 정의) ─────────

const adminUserMembersQuerySchema = z.object({
  status: z.enum(["active", "suspended", "withdrawn"]).optional(),
  grade: z.coerce.number().int().min(1).max(5).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const adminSanctionMemberSchema = z.object({
  type: z.enum(["warning", "suspend", "permaban"]),
  reason: z.string().min(1, "사유를 입력하세요"),
  endsAt: z.string().datetime().nullable().optional(),
});

const adminGrantPointsSchema = z.object({
  amount: z.number().int().positive("포인트는 양수여야 합니다"),
  reason: z.string().optional(),
});

const adminDeductPointsSchema = z.object({
  amount: z.number().int().positive("차감 포인트는 양수여야 합니다"),
  reason: z.string().min(1, "차감 사유를 입력하세요"),
});

const adminChangeGradeSchema = z.object({
  targetLevel: z.number().int().min(1).max(5),
  reason: z.string().min(1, "사유를 입력하세요"),
});

const adminGrantBadgeSchema = z.object({
  badgeId: z.string().uuid("유효한 뱃지 ID를 입력하세요"),
});

import {
  listUserMembers,
  getUserMemberDetail,
  sanctionMember,
  removeSanction,
  grantPoints,
  deductPoints,
  changeGrade,
  grantBadge,
  revokeBadge,
  listBadges,
} from "./service.js";

export async function registerAdminUserMembersRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/admin/members ────────────────────────────────────────────────
  app.get("/admin/members", async (request, reply) => {
    const parsed = adminUserMembersQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() },
      });
    }
    try {
      const result = await listUserMembers(parsed.data);
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── GET /api/v1/admin/members/badges — 뱃지 마스터 목록 (:id 앞에 등록) ────
  app.get("/admin/members/badges", async (request, reply) => {
    try {
      const result = await listBadges();
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── GET /api/v1/admin/members/:id ────────────────────────────────────────────
  app.get("/admin/members/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const result = await getUserMemberDetail(id);
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

  // ── POST /api/v1/admin/members/:id/sanctions — 제재 생성 ────────────────────
  app.post("/admin/members/:id/sanctions", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = adminSanctionMemberSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
      });
    }
    const { type, reason, endsAt } = parsed.data;
    const issuedBy = request.adminSession?.adminUserId ?? null;

    try {
      const result = await sanctionMember(
        id,
        type,
        reason,
        endsAt ? new Date(endsAt) : null,
        issuedBy,
      );
      return reply.status(201).send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      if (e.code === "VALIDATION_ERROR") {
        return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: e.message } });
      }
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── DELETE /api/v1/admin/members/:id/sanctions/:sid — 제재 해제 (super_admin)
  app.delete(
    "/admin/members/:id/sanctions/:sid",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id, sid } = request.params as { id: string; sid: string };
      try {
        const result = await removeSanction(id, sid);
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

  // ── POST /api/v1/admin/members/:id/points — 포인트 지급 ─────────────────────
  app.post("/admin/members/:id/points", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = adminGrantPointsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
      });
    }
    const { amount, reason } = parsed.data;
    try {
      const result = await grantPoints(id, amount, reason ?? "admin.grant");
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

  // ── DELETE /api/v1/admin/members/:id/points — 포인트 차감 (super_admin) ──────
  app.delete(
    "/admin/members/:id/points",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = adminDeductPointsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
        });
      }
      const { amount, reason } = parsed.data;
      try {
        const result = await deductPoints(id, amount, reason);
        return reply.status(201).send(result);
      } catch (err: unknown) {
        const e = err as Error & { code?: string };
        if (e.code === "NOT_FOUND") {
          return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
        }
        if (e.code === "VALIDATION_ERROR") {
          return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: e.message } });
        }
        request.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );

  // ── PATCH /api/v1/admin/members/:id/grade — 등급 변경 (super_admin) ──────────
  app.patch(
    "/admin/members/:id/grade",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = adminChangeGradeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
        });
      }
      const { targetLevel, reason } = parsed.data;
      try {
        const result = await changeGrade(id, targetLevel, reason);
        return reply.send(result);
      } catch (err: unknown) {
        const e = err as Error & { code?: string };
        if (e.code === "NOT_FOUND") {
          return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
        }
        if (e.code === "VALIDATION_ERROR") {
          return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: e.message } });
        }
        request.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );

  // ── POST /api/v1/admin/members/:id/badges — 뱃지 지급 ───────────────────────
  app.post("/admin/members/:id/badges", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = adminGrantBadgeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
      });
    }
    const { badgeId } = parsed.data;
    const grantedBy = request.adminSession?.adminUserId ?? "unknown";
    try {
      const result = await grantBadge(id, badgeId, grantedBy);
      return reply.status(201).send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      if (e.code === "CONFLICT") {
        return reply.status(409).send({ error: { code: "CONFLICT", message: e.message } });
      }
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── DELETE /api/v1/admin/members/:id/badges/:bid — 뱃지 회수 (super_admin) ──
  app.delete(
    "/admin/members/:id/badges/:bid",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id, bid } = request.params as { id: string; bid: string };
      try {
        const result = await revokeBadge(id, bid);
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
