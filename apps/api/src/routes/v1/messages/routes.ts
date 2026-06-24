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
import { createMessageSchema, errorResponseSchema } from "@ai-jakdang/contracts";
import { requireAuthHook } from "../../../plugins/require-auth.js";
import { publishNotification } from "../../../lib/notifications.js";
import { getRedisPublisher } from "../../../lib/redis.js";
import {
  sendMessage,
  getConversations,
  getConversationThread,
  markThreadRead,
} from "./service.js";

type RequestWithUser = FastifyRequest & { user: { id: string } };

export async function messagesRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── POST /messages — 쪽지 발송 ───────────────────────────────────────────────
  typed.post(
    "/",
    {
      preHandler: [requireAuthHook],
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
