/**
 * 광고 관리 API 등록 진입점 (Story 9.16).
 *
 * GET    /api/v1/admin/ads              — 목록(placement/device/adType/status/q/page/pageSize)
 * GET    /api/v1/admin/ads/:id          — 상세(성과 집계 포함)
 * GET    /api/v1/admin/ads/:id/stats    — 기간별 성과
 * POST   /api/v1/admin/ads              — 신규 등록
 * PATCH  /api/v1/admin/ads/:id          — 수정(partial)
 * PATCH  /api/v1/admin/ads/:id/toggle   — isActive 토글
 * DELETE /api/v1/admin/ads/:id          — soft-delete (super_admin 전용, note 필수)
 *
 * 모든 라우트: requireSuperAdmin (staff → 403).
 */

import type { FastifyInstance } from "fastify";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
import {
  adminAdsQuerySchema,
  adminAdCreateSchema,
  adminAdUpdateSchema,
  adminAdDeleteSchema,
  adminAdStatsQuerySchema,
} from "@ai-jakdang/contracts";
import {
  listAds,
  getAd,
  getAdStats,
  createAd,
  updateAd,
  toggleAd,
  deleteAd,
} from "./service.js";

export async function registerAdminAdsRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/admin/ads ────────────────────────────────────────────────────
  app.get(
    "/admin/ads",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const parsed = adminAdsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() },
        });
      }
      try {
        const result = await listAds(parsed.data);
        return reply.send(result);
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );

  // ── GET /api/v1/admin/ads/:id/stats (경로 충돌 방지: :id 앞에 등록) ───────────
  app.get(
    "/admin/ads/:id/stats",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = adminAdStatsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() },
        });
      }
      try {
        const result = await getAdStats(id, parsed.data);
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

  // ── GET /api/v1/admin/ads/:id ────────────────────────────────────────────────
  app.get(
    "/admin/ads/:id",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await getAd(id);
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

  // ── POST /api/v1/admin/ads ───────────────────────────────────────────────────
  app.post(
    "/admin/ads",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const parsed = adminAdCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
        });
      }
      try {
        const result = await createAd(parsed.data);
        return reply.status(201).send(result);
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );

  // ── PATCH /api/v1/admin/ads/:id/toggle ──────────────────────────────────────
  app.patch(
    "/admin/ads/:id/toggle",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await toggleAd(id);
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

  // ── PATCH /api/v1/admin/ads/:id ─────────────────────────────────────────────
  app.patch(
    "/admin/ads/:id",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = adminAdUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
        });
      }
      try {
        const result = await updateAd(id, parsed.data);
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

  // ── DELETE /api/v1/admin/ads/:id — super_admin 전용, note 필수 ───────────────
  app.delete(
    "/admin/ads/:id",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = adminAdDeleteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "삭제 사유를 입력해주세요.", details: parsed.error.flatten() },
        });
      }
      try {
        const result = await deleteAd(id);
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
