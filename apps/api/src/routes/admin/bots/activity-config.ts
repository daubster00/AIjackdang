/**
 * 봇 활동 설정 API 라우트 (Story 11.15).
 *
 * GET    /admin/bots/:id/rhythm            — 활동 리듬 + 담당 게시판 조회
 * PATCH  /admin/bots/:id/rhythm            — 활동 리듬 upsert
 * PUT    /admin/bots/:id/boards            — 담당 게시판 전체 교체
 * GET    /admin/bots/:id/topics            — 주제 풀 목록 조회 (status·board 필터 optional)
 * POST   /admin/bots/:id/topics            — 주제 생성 (personaId = URL :id 강제)
 * PATCH  /admin/bots/:id/topics/:topicId   — 주제 수정
 * DELETE /admin/bots/:id/topics/:topicId   — 주제 삭제 (소유 확인)
 * GET    /admin/bots/:id/auto-refill       — 자동 보충 설정 조회 (전역)
 * PATCH  /admin/bots/:id/auto-refill       — 자동 보충 설정 upsert (전역)
 * GET    /admin/bots/:id/model-assignments — 모델 할당 목록 조회
 * PUT    /admin/bots/:id/model-assignments — 모델 할당 전체 교체 (purpose 중복 거부)
 *
 * 모든 라우트: requireSuperAdmin preHandler.
 * 배선: registerAdminBotsRoutes(apps/api/src/routes/admin/bots/index.ts)에서
 *       `await registerBotActivityConfigRoutes(app)` 호출 필요 (메인이 배선).
 */

import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
import {
  botRhythmUpdateSchema,
  botPersonaBoardUpsertSchema,
  botTopicCreateSchema,
  botModelAssignmentUpsertSchema,
  botTopicStatusSchema,
  botSettingsPatchSchema,
} from "@ai-jakdang/contracts";
import {
  getRhythm,
  upsertRhythm,
  replaceBoards,
  listTopics,
  createTopic,
  updateTopic,
  deleteTopic,
  getAutoRefill,
  setAutoRefill,
  listModelAssignments,
  replaceModelAssignments,
} from "./activity-config.service.js";

// 모델 할당 배열 스키마 (contracts botModelAssignmentUpsertSchema 래핑)
const modelAssignmentsArraySchema = z.array(botModelAssignmentUpsertSchema);

// 자동 보충 body 스키마 (contracts botSettingsPatchSchema 에서 pick)
const autoRefillBodySchema = botSettingsPatchSchema.pick({ bot_auto_refill_topics: true });

// 주제 부분 수정 스키마 (contracts botTopicCreateSchema 에서 omit+partial)
const topicPartialUpdateSchema = botTopicCreateSchema.omit({ personaId: true }).partial();

type PathParams = { id: string };
type TopicPathParams = { id: string; topicId: string };

// ── 내부 에러 핸들러 헬퍼 ──────────────────────────────────────────────────────

function handleError(err: unknown, reply: FastifyReply, log: { error: (e: unknown) => void }) {
  const e = err as Error & { code?: string };
  if (e.code === "NOT_FOUND") {
    return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
  }
  log.error(err);
  return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
}

// ── 라우트 등록 함수 (메인이 registerAdminBotsRoutes 에서 호출) ──────────────────

export async function registerBotActivityConfigRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /admin/bots/:id/rhythm ────────────────────────────────────────────────
  app.get<{ Params: PathParams }>(
    "/admin/bots/:id/rhythm",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      try {
        const result = await getRhythm(request.params.id);
        return reply.send(result);
      } catch (err) {
        return handleError(err, reply, request.log);
      }
    },
  );

  // ── PATCH /admin/bots/:id/rhythm ─────────────────────────────────────────────
  app.patch<{ Params: PathParams }>(
    "/admin/bots/:id/rhythm",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const parsed = botRhythmUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
        });
      }
      try {
        const result = await upsertRhythm(request.params.id, parsed.data);
        return reply.send(result);
      } catch (err) {
        return handleError(err, reply, request.log);
      }
    },
  );

  // ── PUT /admin/bots/:id/boards ────────────────────────────────────────────────
  app.put<{ Params: PathParams }>(
    "/admin/bots/:id/boards",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const parsed = botPersonaBoardUpsertSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
        });
      }
      try {
        const boards = await replaceBoards(request.params.id, parsed.data.boards);
        return reply.send({ boards });
      } catch (err) {
        return handleError(err, reply, request.log);
      }
    },
  );

  // ── GET /admin/bots/:id/topics ────────────────────────────────────────────────
  app.get<{ Params: PathParams }>(
    "/admin/bots/:id/topics",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const query = request.query as { status?: string; board?: string };
      const statusParsed = query.status ? botTopicStatusSchema.safeParse(query.status) : null;
      if (statusParsed && !statusParsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 status 값입니다." },
        });
      }
      try {
        const items = await listTopics(request.params.id, {
          status: statusParsed?.data,
          board: query.board,
        });
        return reply.send({ items });
      } catch (err) {
        return handleError(err, reply, request.log);
      }
    },
  );

  // ── POST /admin/bots/:id/topics ───────────────────────────────────────────────
  app.post<{ Params: PathParams }>(
    "/admin/bots/:id/topics",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      // personaId 는 URL :id 로 강제 주입 — body 의 personaId 는 무시
      const parsed = botTopicCreateSchema.safeParse({
        ...(request.body as object),
        personaId: request.params.id,
      });
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
        });
      }
      try {
        const result = await createTopic(parsed.data);
        return reply.status(201).send(result);
      } catch (err) {
        return handleError(err, reply, request.log);
      }
    },
  );

  // ── PATCH /admin/bots/:id/topics/:topicId ─────────────────────────────────────
  app.patch<{ Params: TopicPathParams }>(
    "/admin/bots/:id/topics/:topicId",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const parsed = topicPartialUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
        });
      }
      try {
        const result = await updateTopic(request.params.id, request.params.topicId, parsed.data);
        return reply.send(result);
      } catch (err) {
        return handleError(err, reply, request.log);
      }
    },
  );

  // ── DELETE /admin/bots/:id/topics/:topicId ────────────────────────────────────
  app.delete<{ Params: TopicPathParams }>(
    "/admin/bots/:id/topics/:topicId",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      try {
        await deleteTopic(request.params.id, request.params.topicId);
        return reply.status(204).send();
      } catch (err) {
        return handleError(err, reply, request.log);
      }
    },
  );

  // ── GET /admin/bots/:id/auto-refill ───────────────────────────────────────────
  // 전역 설정(bot_settings)이므로 :id 는 사용되지 않으나 URL 일관성 유지
  app.get<{ Params: PathParams }>(
    "/admin/bots/:id/auto-refill",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      try {
        const autoRefill = await getAutoRefill();
        return reply.send({ bot_auto_refill_topics: autoRefill });
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );

  // ── PATCH /admin/bots/:id/auto-refill ─────────────────────────────────────────
  // body: { bot_auto_refill_topics: boolean }
  app.patch<{ Params: PathParams }>(
    "/admin/bots/:id/auto-refill",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const parsed = autoRefillBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
        });
      }
      if (parsed.data.bot_auto_refill_topics === undefined) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "bot_auto_refill_topics 값이 필요합니다." },
        });
      }
      try {
        const value = await setAutoRefill(parsed.data.bot_auto_refill_topics);
        return reply.send({ bot_auto_refill_topics: value });
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );

  // ── GET /admin/bots/:id/model-assignments ─────────────────────────────────────
  app.get<{ Params: PathParams }>(
    "/admin/bots/:id/model-assignments",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      try {
        const items = await listModelAssignments(request.params.id);
        return reply.send({ items });
      } catch (err) {
        return handleError(err, reply, request.log);
      }
    },
  );

  // ── PUT /admin/bots/:id/model-assignments ─────────────────────────────────────
  // body: BotModelAssignmentUpsert[] (배열)
  // personaId 는 URL :id 강제. (generation·censor·image) 각 purpose 중복 거부.
  app.put<{ Params: PathParams }>(
    "/admin/bots/:id/model-assignments",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const parsed = modelAssignmentsArraySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
        });
      }
      // purpose 중복 거부
      const purposes = parsed.data.map((a) => a.purpose);
      if (new Set(purposes).size !== purposes.length) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "같은 purpose(generation·censor·image)를 중복 지정할 수 없습니다." },
        });
      }
      try {
        const items = await replaceModelAssignments(request.params.id, parsed.data);
        return reply.send({ items });
      } catch (err) {
        return handleError(err, reply, request.log);
      }
    },
  );
}
