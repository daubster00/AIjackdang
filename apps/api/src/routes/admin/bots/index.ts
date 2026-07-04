/**
 * 봇 페르소나 관리 API 등록 (Story 11.14).
 *
 * GET    /api/v1/admin/bots          — 목록 (q, status, page, pageSize)
 * GET    /api/v1/admin/bots/:id      — 상세 (캐릭터 시트 전체 + 집계)
 * PATCH  /api/v1/admin/bots/:id/toggle — isActive 토글 (경로 충돌 방지: /:id 앞 등록)
 * PATCH  /api/v1/admin/bots/:id      — 캐릭터 시트 partial 수정
 *
 * 모든 라우트: requireSuperAdmin (staff → 403).
 *
 * 후속 스토리 배려:
 *  - 11.15(활동설정)·11.16(운영패널)·11.17(리포트)·11.19(AI사용량)가 봇 라우트 추가 예정.
 *  - 이 파일에서 registerAdminBotsRoutes를 유지하되,
 *    도메인별 등록 함수(registerBotPersonaRoutes 등)를 내부에서 호출하는 구조로 확장 가능.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
import { botPersonaUpdateSchema } from "@ai-jakdang/contracts";
import { listBots, getBot, updateBot, toggleBot } from "./service.js";
import { registerAdminBotReportRoute } from "./report.js";
import { registerAdminBotHoldQueueActionRoutes } from "./hold-queue-actions.js";
import { registerBotActivityConfigRoutes } from "./activity-config.js";
import { registerAdminBotSettingsRoutes } from "./settings.js";
import { registerAiUsageRoutes } from "./ai-usage.js";
import { registerAdminBotCurriculumRoutes } from "./curriculum.js";

// TODO(11.14): contracts/src/bot.ts에 adminBotListQuerySchema가 추가되면 이쪽 import로 교체.
//              현재 contracts의 adminBotPersonasQuerySchema는 status(active|inactive|all) 필드가
//              없어 로컬 임시 스키마를 사용한다.
const adminBotListQuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(["active", "inactive", "all"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ── 페르소나 CRUD 라우트 ──────────────────────────────────────────────────────

async function registerBotPersonaRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/admin/bots ─────────────────────────────────────────────────
  app.get(
    "/admin/bots",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const parsed = adminBotListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() },
        });
      }
      try {
        const result = await listBots(parsed.data);
        return reply.send(result);
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );

  // ── PATCH /api/v1/admin/bots/:id/toggle (경로 충돌 방지: /:id 앞에 등록) ───
  app.patch(
    "/admin/bots/:id/toggle",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await toggleBot(id);
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

  // ── GET /api/v1/admin/bots/:id ─────────────────────────────────────────────
  app.get(
    "/admin/bots/:id",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await getBot(id);
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

  // ── PATCH /api/v1/admin/bots/:id ───────────────────────────────────────────
  app.patch(
    "/admin/bots/:id",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = botPersonaUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
        });
      }
      try {
        const result = await updateBot(id, parsed.data);
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

// ── 메인 등록 함수 (후속 스토리 확장 진입점) ──────────────────────────────────────

export async function registerAdminBotsRoutes(app: FastifyInstance): Promise<void> {
  // 페르소나 CRUD (Story 11.14)
  await registerBotPersonaRoutes(app);

  // Story 11.17: 일일 리포트 + 보류 큐 액션
  await registerAdminBotReportRoute(app);
  await registerAdminBotHoldQueueActionRoutes(app);

  // Story 11.15: 활동 설정(담당게시판·리듬·주제풀·모델할당)
  await registerBotActivityConfigRoutes(app);

  // Story 11.16: 봇 전역 설정 GET/PATCH (킬스위치·관찰모드·속도·비용상한)
  await registerAdminBotSettingsRoutes(app);

  // Story 11.19: AI 사용량·비용 집계
  await registerAiUsageRoutes(app);

  // Story 13.5: 커리큘럼 플랜 API
  await registerAdminBotCurriculumRoutes(app);
}
