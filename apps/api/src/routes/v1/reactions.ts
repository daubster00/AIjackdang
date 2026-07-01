/**
 * /api/v1/reactions 라우트 — Story 5.2
 *
 * POST   /api/v1/reactions             좋아요 추가 (인증 필수)
 * DELETE /api/v1/reactions/:id         좋아요 취소 (인증 필수, 소유자만)
 * GET    /api/v1/reactions/me          현재 사용자의 특정 타겟 reaction 여부 조회
 *
 * 자가추천 차단: target 작성자 조회 → author_id === req.user.id 이면 409
 * UNIQUE 제약 위반(중복 좋아요): 409 ALREADY_REACTED
 * 성공 시 stats 큐에 reaction.created job 발행 (Epic 6 포인트 처리 담당)
 */

import { getDb, schema } from "@ai-jakdang/database";
import {
  createReactionInputSchema,
  reactionSchema,
  errorResponseSchema,
} from "@ai-jakdang/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { requireAuthHook } from "../../plugins/require-auth.js";
import { getStatsQueue } from "../../lib/queues.js";
import { earnPoints, revokePoints, getTodayCount } from "./gamification/points.service.js";
import { publishNotification } from "../../lib/notifications.js";
import { getRedisPublisher } from "../../lib/redis.js";

type RequestWithUser = FastifyRequest & { user: { id: string } };

/**
 * target_type에 따라 해당 콘텐츠의 author_id를 반환한다.
 * 자가추천 차단(AR-12)에 사용.
 */
async function getAuthorId(
  targetType: string,
  targetId: string,
): Promise<string | null> {
  const db = getDb();
  switch (targetType) {
    case "post": {
      const rows = await db
        .select({ userId: schema.posts.userId })
        .from(schema.posts)
        .where(eq(schema.posts.id, targetId))
        .limit(1);
      return rows[0]?.userId ?? null;
    }
    case "question": {
      const rows = await db
        .select({ userId: schema.questions.userId })
        .from(schema.questions)
        .where(eq(schema.questions.id, targetId))
        .limit(1);
      return rows[0]?.userId ?? null;
    }
    case "answer": {
      const rows = await db
        .select({ userId: schema.answers.userId })
        .from(schema.answers)
        .where(eq(schema.answers.id, targetId))
        .limit(1);
      return rows[0]?.userId ?? null;
    }
    case "resource": {
      const rows = await db
        .select({ userId: schema.resources.userId })
        .from(schema.resources)
        .where(eq(schema.resources.id, targetId))
        .limit(1);
      return rows[0]?.userId ?? null;
    }
    case "comment": {
      const rows = await db
        .select({ authorId: schema.comments.authorId })
        .from(schema.comments)
        .where(eq(schema.comments.id, targetId))
        .limit(1);
      return rows[0]?.authorId ?? null;
    }
    default:
      return null;
  }
}

export async function reactionsRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /reactions/me — 현재 사용자 reaction 여부 조회 ─────────────────────
  typed.get(
    "/reactions/me",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "현재 사용자가 특정 타겟에 좋아요했는지 확인한다.",
        tags: ["reactions"],
        querystring: z.object({
          targetType: z.enum(["post", "question", "answer", "resource", "comment"]),
          targetId: z.string().uuid(),
        }),
        response: {
          200: z.object({
            liked: z.boolean(),
            reactionId: z.string().uuid().nullable(),
          }),
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { targetType, targetId } = request.query as {
        targetType: string;
        targetId: string;
      };
      const db = getDb();

      const rows = await db
        .select({ id: schema.reactions.id })
        .from(schema.reactions)
        .where(
          and(
            eq(schema.reactions.userId, user.id),
            eq(schema.reactions.targetType, targetType as "post" | "question" | "answer" | "resource" | "comment"),
            eq(schema.reactions.targetId, targetId),
            eq(schema.reactions.reactionType, "like"),
          ),
        )
        .limit(1);

      const row = rows[0];
      return reply.send({ liked: !!row, reactionId: row?.id ?? null });
    },
  );

  // ── POST /reactions — 좋아요 추가 ─────────────────────────────────────────
  typed.post(
    "/reactions",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "콘텐츠에 좋아요를 추가한다. 자가추천 불가. UNIQUE로 중복 방지.",
        tags: ["reactions"],
        body: createReactionInputSchema,
        response: {
          201: reactionSchema,
          401: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { targetType, targetId, reactionType } = request.body as {
        targetType: "post" | "question" | "answer" | "resource" | "comment";
        targetId: string;
        reactionType: "like" | "dislike";
      };
      const db = getDb();

      // 자가추천 차단 (AR-12)
      const authorId = await getAuthorId(targetType, targetId);
      if (authorId && authorId === user.id) {
        return reply.code(409).send({
          error: {
            code: "SELF_REACTION_FORBIDDEN",
            message: "본인이 작성한 콘텐츠에는 좋아요할 수 없습니다.",
          },
        });
      }

      // 중복 체크: UNIQUE 제약 위반 전에 먼저 확인
      const existing = await db
        .select({ id: schema.reactions.id })
        .from(schema.reactions)
        .where(
          and(
            eq(schema.reactions.userId, user.id),
            eq(schema.reactions.targetType, targetType),
            eq(schema.reactions.targetId, targetId),
            eq(schema.reactions.reactionType, reactionType ?? "like"),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        return reply.code(409).send({
          error: {
            code: "ALREADY_REACTED",
            message: "이미 좋아요한 콘텐츠입니다.",
          },
        });
      }

      // INSERT
      const inserted = await db
        .insert(schema.reactions)
        .values({
          userId: user.id,
          targetType,
          targetId,
          reactionType: reactionType ?? "like",
        })
        .returning();

      const row = inserted[0];
      if (!row) {
        throw new Error("INSERT reaction returned no row");
      }

      // 포인트 적립: 콘텐츠 작성자에게 reaction.received +2
      // 자가추천은 위에서 409 반환하므로 authorId !== user.id 보장됨
      if (reactionType === "like" && authorId) {
        try {
          const todayCount = await getTodayCount(db, { userId: authorId, reason: "reaction.received" });
          await earnPoints(db, {
            userId: authorId,
            reason: "reaction.received",
            sourceType: "reaction",
            sourceId: row.id,
            todayCount,
          });
        } catch (err) {
          console.error("[points] 좋아요 수신 적립 실패 (무시):", (err as Error).message);
        }
      }

      // stats 큐에 reaction.created job 발행 (Epic 6 포인트 처리 담당)
      try {
        await getStatsQueue().add("reaction.created", {
          reactionId: row.id,
          userId: user.id,
          targetType,
          targetId,
        });
      } catch {
        // 큐 발행 실패는 반응 자체를 실패시키지 않는다
        console.error("[reactions] stats 큐 발행 실패");
      }

      // 알림 발행: 게시글 작성자에게 reaction.received 알림 (post 좋아요만, 본인 제외)
      // 자가추천 차단(위 409)으로 authorId !== user.id 는 이미 보장됨
      if (reactionType === "like" && targetType === "post" && authorId) {
        try {
          await publishNotification(
            authorId,
            {
              type: "reaction.received",
              title: "게시글에 좋아요가 달렸습니다.",
              body: "회원님의 게시글에 좋아요가 달렸습니다.",
              targetType: "post",
              targetId,
            },
            db,
            getRedisPublisher(),
          );
        } catch (err) {
          console.error("[reactions] 알림 발행 실패 (무시):", (err as Error).message);
        }
      }

      return reply.code(201).send({
        id: row.id,
        userId: row.userId,
        targetType: row.targetType,
        targetId: row.targetId,
        reactionType: row.reactionType,
        createdAt: row.createdAt.toISOString(),
      });
    },
  );

  // ── DELETE /reactions/:id — 좋아요 취소 ──────────────────────────────────
  typed.delete(
    "/reactions/:id",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "좋아요를 취소한다. 본인 reaction만 삭제 가능.",
        tags: ["reactions"],
        params: z.object({ id: z.string().uuid() }),
        response: {
          204: z.object({}),
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { id } = request.params as { id: string };
      const db = getDb();

      const existing = await db
        .select({
          id: schema.reactions.id,
          userId: schema.reactions.userId,
          targetType: schema.reactions.targetType,
          targetId: schema.reactions.targetId,
          reactionType: schema.reactions.reactionType,
        })
        .from(schema.reactions)
        .where(eq(schema.reactions.id, id))
        .limit(1);

      if (!existing[0]) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "좋아요 정보를 찾을 수 없습니다." },
        });
      }

      if (existing[0].userId !== user.id) {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "본인의 좋아요만 취소할 수 있습니다." },
        });
      }

      const reactionRow = existing[0];

      // 포인트 회수: 콘텐츠 작성자 포인트 회수 (like 취소 시만)
      if (reactionRow.reactionType === "like") {
        const contentAuthorId = await getAuthorId(reactionRow.targetType, reactionRow.targetId);
        if (contentAuthorId) {
          try {
            await revokePoints(db, {
              userId: contentAuthorId,
              reason: "reaction.received",
              sourceType: "reaction",
              sourceId: id,
            });
          } catch (err) {
            console.error("[points] 좋아요 취소 회수 실패 (무시):", (err as Error).message);
          }
        }
      }

      await db.delete(schema.reactions).where(eq(schema.reactions.id, id));
      return reply.code(204).send({});
    },
  );
}
