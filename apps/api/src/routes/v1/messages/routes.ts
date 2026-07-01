/**
 * /api/v1/messages 라우트 — Story 7.4
 *
 * POST   /messages                          쪽지 발송 (인증 필수, rate limit 10/hr)
 * GET    /messages/conversations            대화 목록 조회 (인증 필수)
 * GET    /messages/conversations/:userId    특정 상대 스레드 조회 (인증 필수)
 * POST   /messages/conversations/:userId/read-all  스레드 일괄 읽음 (인증 필수)
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getDb } from "@ai-jakdang/database";
import {
  createMessageSchema,
  errorResponseSchema,
  purgeMessagesBodySchema,
} from "@ai-jakdang/contracts";
import { requireAuthHook, checkSuspendedHook } from "../../../plugins/require-auth.js";
import { publishNotification } from "../../../lib/notifications.js";
import { getRedisPublisher } from "../../../lib/redis.js";
import {
  sendMessage,
  getConversations,
  getConversationThread,
  markThreadRead,
  getMessages,
  markMessageRead,
  getTrashedMessages,
  trashMessage,
  purgeMessages,
} from "./service.js";

type RequestWithUser = FastifyRequest & { user: { id: string } };

export async function messagesRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /messages — 쪽지함 목록 (개별 메시지, 메일박스형) ──────────────────────
  typed.get(
    "/",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "쪽지함 개별 메시지 목록 조회 (box=received|sent)",
        tags: ["messages"],
        querystring: z.object({
          box: z.enum(["received", "sent"]).default("received"),
        }),
        response: {
          200: z.object({
            items: z.array(
              z.object({
                id: z.string().uuid(),
                body: z.string(),
                isRead: z.boolean(),
                createdAt: z.string(),
                counterpart: z.object({
                  id: z.string().uuid(),
                  nickname: z.string(),
                  avatarUrl: z.string().nullable(),
                }),
              }),
            ),
          }),
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { box } = request.query;
      const db = getDb();
      const items = await getMessages(db, user.id, box);
      return reply.send({ items });
    },
  );

  // ── POST /messages/:id/read — 단일 메시지 읽음 처리 ──────────────────────────
  typed.post(
    "/:id/read",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "단일 수신 메시지 읽음 처리",
        tags: ["messages"],
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: z.object({ updated: z.number() }),
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { id } = request.params;
      const db = getDb();
      const result = await markMessageRead(db, id, user.id);
      return reply.send(result);
    },
  );

  // ── POST /messages — 쪽지 발송 ───────────────────────────────────────────────
  typed.post(
    "/",
    {
      preHandler: [requireAuthHook, checkSuspendedHook],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 hour",
          keyGenerator: (req: FastifyRequest) =>
            (req as RequestWithUser).user?.id ?? req.ip,
          errorResponseBuilder: () => ({
            error: {
              code: "MESSAGE_RATE_LIMIT_EXCEEDED",
              message: "1시간에 최대 10개까지 보낼 수 있습니다.",
            },
          }),
        },
      },
      schema: {
        description: "쪽지 발송",
        tags: ["messages"],
        body: createMessageSchema,
        response: {
          201: z.object({ id: z.string().uuid() }),
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          429: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { receiverId, body } = request.body;
      const db = getDb();

      try {
        const result = await sendMessage(
          db,
          user.id,
          receiverId,
          body,
          publishNotification,
          getRedisPublisher(),
        );
        return reply.code(201).send(result);
      } catch (err) {
        const e = err as { code?: string; message?: string; httpStatus?: number };
        if (e.httpStatus && e.code) {
          const status = e.httpStatus as 400 | 403 | 404 | 429;
          return reply.code(status).send({
            error: { code: e.code, message: e.message ?? "오류가 발생했습니다." },
          });
        }
        throw err;
      }
    },
  );

  // ── GET /messages/trash — 휴지통 목록 ───────────────────────────────────────
  typed.get(
    "/trash",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "휴지통(받은·보낸 합산) 쪽지 목록 조회",
        tags: ["messages"],
        response: {
          200: z.object({
            items: z.array(
              z.object({
                id: z.string().uuid(),
                body: z.string(),
                isRead: z.boolean(),
                createdAt: z.string(),
                trashedAt: z.string().nullable(),
                originalBox: z.enum(["received", "sent"]),
                counterpart: z.object({
                  id: z.string().uuid(),
                  nickname: z.string(),
                  avatarUrl: z.string().nullable(),
                }),
              }),
            ),
          }),
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const db = getDb();
      const items = await getTrashedMessages(db, user.id);
      return reply.send({ items });
    },
  );

  // ── POST /messages/:id/trash — 쪽지 휴지통으로 이동 ─────────────────────────
  typed.post(
    "/:id/trash",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "쪽지를 휴지통으로 이동한다 (영구삭제 아님)",
        tags: ["messages"],
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: z.object({ updated: z.number() }),
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { id } = request.params;
      const db = getDb();
      const result = await trashMessage(db, id, user.id);
      if (result.updated === 0) {
        return reply.code(404).send({
          error: {
            code: "MESSAGE_NOT_FOUND",
            message: "쪽지를 찾을 수 없거나 권한이 없습니다.",
          },
        });
      }
      return reply.send(result);
    },
  );

  // ── POST /messages/purge — 영구삭제 ─────────────────────────────────────────
  typed.post(
    "/purge",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "지정한 쪽지를 영구삭제한다 (휴지통에 있는 항목만 처리)",
        tags: ["messages"],
        body: purgeMessagesBodySchema,
        response: {
          200: z.object({ purged: z.number() }),
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { ids } = request.body;
      const db = getDb();
      const result = await purgeMessages(db, ids, user.id);
      return reply.send(result);
    },
  );

  // ── GET /messages/conversations — 대화 목록 ───────────────────────────────────
  typed.get(
    "/conversations",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "대화 목록 조회 (상대별 최신 메시지 + 미읽음 수)",
        tags: ["messages"],
        response: {
          200: z.object({
            items: z.array(
              z.object({
                partnerId: z.string().uuid(),
                partnerNickname: z.string(),
                partnerAvatarUrl: z.string().nullable(),
                lastMessageId: z.string().uuid(),
                lastMessageBody: z.string(),
                lastMessageAt: z.string(),
                lastMessageIsRead: z.boolean(),
                isSentByMe: z.boolean(),
                unreadCount: z.number(),
              }),
            ),
          }),
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const db = getDb();

      const items = await getConversations(db, user.id);
      return reply.send({ items });
    },
  );

  // ── GET /messages/conversations/:userId — 스레드 조회 ─────────────────────────
  typed.get(
    "/conversations/:userId",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "특정 상대와의 대화 스레드 조회 (시간 오름차순)",
        tags: ["messages"],
        params: z.object({ userId: z.string().uuid() }),
        response: {
          200: z.object({
            items: z.array(
              z.object({
                id: z.string().uuid(),
                senderId: z.string().uuid(),
                receiverId: z.string().uuid(),
                body: z.string(),
                isRead: z.boolean(),
                createdAt: z.string(),
                isMine: z.boolean(),
              }),
            ),
          }),
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { userId: otherUserId } = request.params;
      const db = getDb();

      const items = await getConversationThread(db, user.id, otherUserId);
      return reply.send({ items });
    },
  );

  // ── POST /messages/conversations/:userId/read-all — 일괄 읽음 ─────────────────
  typed.post(
    "/conversations/:userId/read-all",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "특정 상대로부터 받은 미읽음 메시지 일괄 읽음 처리",
        tags: ["messages"],
        params: z.object({ userId: z.string().uuid() }),
        response: {
          200: z.object({ updated: z.number() }),
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { userId: otherUserId } = request.params;
      const db = getDb();

      const result = await markThreadRead(db, user.id, otherUserId);
      return reply.send(result);
    },
  );
}
