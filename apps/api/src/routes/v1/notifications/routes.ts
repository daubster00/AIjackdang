/**
 * 알림 CRUD 라우트 — Story 7.2 + Story 7.3
 *
 * 등록 대상:
 *   GET  /unread-count     미읽음 개수 조회
 *   GET  /                 알림 목록 (오프셋 페이지네이션)
 *   PATCH /:id/read        단건 읽음 처리
 *   PATCH /read-all        전체 읽음 처리
 *   GET  /settings         알림 설정 조회 (Story 7.3)
 *   PATCH /settings        알림 설정 수정 (Story 7.3)
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { FastifyRequest } from "fastify";
import { requireAuthHook } from "../../../plugins/require-auth.js";
import { errorResponseSchema, paginationQuerySchema, updateNotificationSettingsSchema } from "@ai-jakdang/contracts";
import { notificationService } from "./service.js";

type RequestWithUser = FastifyRequest & { user: { id: string } };

export async function registerNotificationRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /unread-count ──────────────────────────────────────────────────────
  typed.get(
    "/unread-count",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "미읽음 알림 개수 조회",
        tags: ["notifications"],
        response: {
          200: z.object({ count: z.number().int() }),
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const cnt = await notificationService.getUnreadCount(user.id);
      return reply.send({ count: cnt });
    },
  );

  // ── GET / (알림 목록) ──────────────────────────────────────────────────────
  typed.get(
    "/",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "알림 목록 (오프셋 페이지네이션)",
        tags: ["notifications"],
        querystring: paginationQuerySchema,
        response: {
          200: z.object({
            items: z.array(
              z.object({
                id: z.string().uuid(),
                userId: z.string().uuid(),
                type: z.string(),
                targetType: z.string().nullable(),
                // targetId: 게시글/댓글은 UUID, 질문은 slug 문자열 → uuid 강제 시 응답 직렬화 실패(0026 정합화)
                targetId: z.string().nullable(),
                title: z.string(),
                body: z.string(),
                isRead: z.boolean(),
                createdAt: z.string(),
              }),
            ),
            meta: z.object({
              page: z.number().int(),
              pageSize: z.number().int(),
              totalItems: z.number().int(),
              totalPages: z.number().int(),
            }),
          }),
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { page, pageSize } = request.query;

      const { items, totalItems } = await notificationService.list(user.id, page, pageSize);

      const serializedItems = items.map((n) => ({
        id: n.id,
        userId: n.userId,
        type: n.type,
        targetType: n.targetType,
        targetId: n.targetId,
        title: n.title,
        body: n.body,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      }));

      return reply.send({
        items: serializedItems,
        meta: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.ceil(totalItems / pageSize),
        },
      });
    },
  );

  // ── PATCH /read-all ────────────────────────────────────────────────────────
  // NOTE: /read-all 을 /:id/read 보다 먼저 등록해 경로 충돌 방지
  typed.patch(
    "/read-all",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "전체 알림 읽음 처리",
        tags: ["notifications"],
        response: {
          200: z.object({ updatedCount: z.number().int() }),
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const updatedCount = await notificationService.markAllRead(user.id);
      return reply.send({ updatedCount });
    },
  );

  // ── PATCH /:id/read ────────────────────────────────────────────────────────
  typed.patch(
    "/:id/read",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "단건 알림 읽음 처리",
        tags: ["notifications"],
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: z.object({ id: z.string().uuid(), isRead: z.boolean() }),
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { id } = request.params;

      const notification = await notificationService.findById(id);

      if (!notification) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "알림을 찾을 수 없습니다." },
        });
      }

      if (notification.userId !== user.id) {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "권한이 없습니다." },
        });
      }

      await notificationService.markRead(id);
      return reply.send({ id, isRead: true });
    },
  );

  // ── DELETE /:id (단건 삭제) ─────────────────────────────────────────────────
  typed.delete(
    "/:id",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "단건 알림 삭제",
        tags: ["notifications"],
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: z.object({ id: z.string().uuid(), deleted: z.literal(true) }),
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { id } = request.params;

      const notification = await notificationService.findById(id);

      if (!notification) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "알림을 찾을 수 없습니다." },
        });
      }

      if (notification.userId !== user.id) {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "권한이 없습니다." },
        });
      }

      await notificationService.delete(id);
      return reply.send({ id, deleted: true });
    },
  );

  // ── Story 7.3: GET /settings ───────────────────────────────────────────────
  typed.get(
    "/settings",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "알림 설정 조회 — 레코드 없으면 기본값(7종 all true) 반환",
        tags: ["notifications"],
        response: {
          200: z.object({ settings: z.record(z.string(), z.boolean()) }),
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const settings = await notificationService.getSettings(user.id);
      return reply.send({ settings });
    },
  );

  // ── Story 7.3: PATCH /settings ─────────────────────────────────────────────
  typed.patch(
    "/settings",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "알림 설정 수정 — sanction.applied는 서버에서 강제 true",
        tags: ["notifications"],
        body: updateNotificationSettingsSchema,
        response: {
          200: z.object({ settings: z.record(z.string(), z.boolean()) }),
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const patch = request.body;
      const settings = await notificationService.updateSettings(user.id, patch);
      return reply.send({ settings });
    },
  );
}
