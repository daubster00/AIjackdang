/**
 * /api/v1/comments 라우트 — Story 5.4 (CRUD) + Story 5.5 (대댓글 parentId 검증)
 *
 * GET    /api/v1/comments?targetType=&targetId=&page=&pageSize=  목록 (최상위+대댓글)
 * POST   /api/v1/comments                                        댓글/대댓글 등록 (인증 필수)
 * PATCH  /api/v1/comments/:id                                    수정 (소유자만)
 * DELETE /api/v1/comments/:id                                    soft-delete (소유자만)
 *
 * 설계:
 * - N+1 방지(AR-2): 최상위 댓글 SELECT → parentId IN (ids) 대댓글 배치 → reactions 배치
 * - soft-delete(AR-7): status='deleted' + deleted_at, 본문은 null 마스킹으로 반환
 * - 2단계 대댓글 차단(5.5): parent.parentId IS NOT NULL → 400 NESTING_NOT_ALLOWED
 */

import { getDb, schema } from "@ai-jakdang/database";
import { createCommentInputSchema, errorResponseSchema } from "@ai-jakdang/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq, and, isNull, inArray, sql, desc, asc } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { requireAuthHook } from "../../plugins/require-auth.js";
import { getNotificationsQueue } from "../../lib/queues.js";
import { userAuth } from "../../auth/user-auth.js";
import { earnPoints, revokePoints, getTodayCount } from "./gamification/points.service.js";

type RequestWithUser = FastifyRequest & { user: { id: string } };

// ── 응답 스키마 ────────────────────────────────────────────────────────────────

const replyItemSchema = z.object({
  id: z.string().uuid(),
  authorId: z.string().uuid(),
  authorNickname: z.string().nullable(),
  targetType: z.enum(["post", "question", "answer", "resource", "comment"]),
  targetId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  content: z.string().nullable(),
  status: z.enum(["visible", "deleted"]),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  likeCount: z.number().int().nonnegative(),
  dislikeCount: z.number().int().nonnegative(),
  myReaction: z.enum(["like", "dislike"]).nullable(),
  myReactionId: z.string().uuid().nullable(),
});

const commentItemSchema = replyItemSchema.extend({
  replies: z.array(replyItemSchema),
});

const commentListResponseSchema = z.object({
  items: z.array(commentItemSchema),
  meta: z.object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  }),
});

export async function commentsRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /comments — 목록 조회 ────────────────────────────────────────────────
  typed.get(
    "/comments",
    {
      schema: {
        description: "댓글 목록 조회. 최상위 최신순 + 각 부모의 대댓글 포함.",
        tags: ["comments"],
        querystring: z.object({
          targetType: z.enum(["post", "question", "answer", "resource", "comment"]),
          targetId: z.string().uuid(),
          page: z.coerce.number().int().positive().default(1),
          pageSize: z.coerce.number().int().positive().max(100).default(20),
        }),
        response: {
          200: commentListResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { targetType, targetId, page, pageSize } = request.query as {
        targetType: "post" | "question" | "answer" | "resource" | "comment";
        targetId: string;
        page: number;
        pageSize: number;
      };
      const db = getDb();
      const offset = (page - 1) * pageSize;

      // optional auth — 비회원도 목록 조회 가능
      let currentUserId: string | null = null;
      try {
        const session = await userAuth.api.getSession({
          headers: request.headers as unknown as Headers,
        });
        currentUserId = session?.user?.id ?? null;
      } catch {
        // 비회원 허용
      }

      // ── 1. 최상위 댓글 조회 ──────────────────────────────────────────────────
      const topRows = await db
        .select({
          id: schema.comments.id,
          authorId: schema.comments.authorId,
          authorNickname: schema.users.nickname,
          targetType: schema.comments.targetType,
          targetId: schema.comments.targetId,
          parentId: schema.comments.parentId,
          content: schema.comments.content,
          status: schema.comments.status,
          deletedAt: schema.comments.deletedAt,
          createdAt: schema.comments.createdAt,
          updatedAt: schema.comments.updatedAt,
        })
        .from(schema.comments)
        .leftJoin(schema.users, eq(schema.comments.authorId, schema.users.id))
        .where(
          and(
            eq(schema.comments.targetType, targetType),
            eq(schema.comments.targetId, targetId),
            isNull(schema.comments.parentId),
          ),
        )
        .orderBy(desc(schema.comments.createdAt))
        .limit(pageSize)
        .offset(offset);

      const totalResult = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(schema.comments)
        .where(
          and(
            eq(schema.comments.targetType, targetType),
            eq(schema.comments.targetId, targetId),
            isNull(schema.comments.parentId),
          ),
        );
      const total = totalResult[0]?.count ?? 0;

      if (topRows.length === 0) {
        return reply.send({ items: [], meta: { total, page, pageSize } });
      }

      const topIds = topRows.map((r) => r.id);

      // ── 2. 대댓글 배치 조회 (N+1 방지, AR-2) ────────────────────────────────
      const replyRows = await db
        .select({
          id: schema.comments.id,
          authorId: schema.comments.authorId,
          authorNickname: schema.users.nickname,
          targetType: schema.comments.targetType,
          targetId: schema.comments.targetId,
          parentId: schema.comments.parentId,
          content: schema.comments.content,
          status: schema.comments.status,
          deletedAt: schema.comments.deletedAt,
          createdAt: schema.comments.createdAt,
          updatedAt: schema.comments.updatedAt,
        })
        .from(schema.comments)
        .leftJoin(schema.users, eq(schema.comments.authorId, schema.users.id))
        .where(inArray(schema.comments.parentId, topIds))
        .orderBy(asc(schema.comments.createdAt));

      // ── 3. 반응 수 배치 조회 ─────────────────────────────────────────────────
      const allIds = [...topIds, ...replyRows.map((r) => r.id)];

      const reactionCounts = await db
        .select({
          targetId: schema.reactions.targetId,
          reactionType: schema.reactions.reactionType,
          count: sql<number>`cast(count(*) as int)`,
        })
        .from(schema.reactions)
        .where(
          and(
            eq(schema.reactions.targetType, "comment"),
            inArray(schema.reactions.targetId, allIds),
          ),
        )
        .groupBy(schema.reactions.targetId, schema.reactions.reactionType);

      // ── 4. 내 반응 배치 조회 (인증 시) ──────────────────────────────────────
      const myReactionMap = new Map<string, { type: "like" | "dislike"; id: string }>();
      if (currentUserId) {
        const myReactions = await db
          .select({
            id: schema.reactions.id,
            targetId: schema.reactions.targetId,
            reactionType: schema.reactions.reactionType,
          })
          .from(schema.reactions)
          .where(
            and(
              eq(schema.reactions.userId, currentUserId),
              eq(schema.reactions.targetType, "comment"),
              inArray(schema.reactions.targetId, allIds),
            ),
          );
        for (const r of myReactions) {
          myReactionMap.set(r.targetId, {
            type: r.reactionType as "like" | "dislike",
            id: r.id,
          });
        }
      }

      // ── 5. 메모리 조합 ────────────────────────────────────────────────────────
      type ReplyOut = {
        id: string; authorId: string; authorNickname: string | null;
        targetType: "post" | "question" | "answer" | "resource" | "comment";
        targetId: string; parentId: string | null;
        content: string | null; status: "visible" | "deleted"; deletedAt: string | null;
        createdAt: string; updatedAt: string;
        likeCount: number; dislikeCount: number;
        myReaction: "like" | "dislike" | null; myReactionId: string | null;
      };
      type CommentOut = ReplyOut & { replies: ReplyOut[] };

      const countMap = new Map<string, { like: number; dislike: number }>();
      for (const r of reactionCounts) {
        const cur = countMap.get(r.targetId) ?? { like: 0, dislike: 0 };
        if (r.reactionType === "like") cur.like = r.count;
        else if (r.reactionType === "dislike") cur.dislike = r.count;
        countMap.set(r.targetId, cur);
      }

      const replyByParent = new Map<string, typeof replyRows>();
      for (const r of replyRows) {
        const pid = r.parentId!;
        if (!replyByParent.has(pid)) replyByParent.set(pid, []);
        replyByParent.get(pid)!.push(r);
      }

      function toBase(row: (typeof topRows)[0] | (typeof replyRows)[0]): ReplyOut {
        const counts = countMap.get(row.id) ?? { like: 0, dislike: 0 };
        const myR = myReactionMap.get(row.id) ?? null;
        const isDeleted = row.status === "deleted";
        return {
          id: row.id,
          authorId: row.authorId,
          authorNickname: row.authorNickname ?? null,
          targetType: row.targetType as "post" | "question" | "answer" | "resource" | "comment",
          targetId: row.targetId,
          parentId: row.parentId ?? null,
          content: isDeleted ? null : row.content,
          status: row.status as "visible" | "deleted",
          deletedAt: row.deletedAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          likeCount: counts.like,
          dislikeCount: counts.dislike,
          myReaction: myR?.type ?? null,
          myReactionId: myR?.id ?? null,
        };
      }

      const items: CommentOut[] = topRows.map((row) => ({
        ...toBase(row),
        replies: (replyByParent.get(row.id) ?? []).map((r) => toBase(r)),
      }));

      return reply.send({ items, meta: { total, page, pageSize } });
    },
  );

  // ── POST /comments — 등록 ────────────────────────────────────────────────────
  typed.post(
    "/comments",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "댓글 또는 대댓글 등록. parentId 있으면 대댓글(2단계 중첩 불가).",
        tags: ["comments"],
        body: createCommentInputSchema,
        response: {
          201: z.object({ id: z.string().uuid() }),
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { targetType, targetId, content, parentId } = request.body as {
        targetType: "post" | "question" | "answer" | "resource" | "comment";
        targetId: string;
        content: string;
        parentId?: string;
      };
      const db = getDb();

      if (!content.trim()) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: "댓글 내용을 입력해주세요." },
        });
      }

      // 대댓글 검증 (Story 5.5 AC#2): 2단계 중첩 차단
      let parentCommentAuthorId: string | null = null;
      if (parentId) {
        const parentRows = await db
          .select({
            id: schema.comments.id,
            parentId: schema.comments.parentId,
            authorId: schema.comments.authorId,
          })
          .from(schema.comments)
          .where(eq(schema.comments.id, parentId))
          .limit(1);

        const parent = parentRows[0];
        if (!parent) {
          return reply.code(400).send({
            error: { code: "VALIDATION_ERROR", message: "부모 댓글을 찾을 수 없습니다." },
          });
        }
        if (parent.parentId !== null) {
          return reply.code(400).send({
            error: {
              code: "NESTING_NOT_ALLOWED",
              message: "2단계 이상의 대댓글은 허용되지 않습니다.",
            },
          });
        }
        parentCommentAuthorId = parent.authorId;
      }

      const inserted = await db
        .insert(schema.comments)
        .values({
          authorId: user.id,
          targetType,
          targetId,
          parentId: parentId ?? null,
          content: content.trim(),
        })
        .returning({ id: schema.comments.id });

      const row = inserted[0];
      if (!row) throw new Error("INSERT comment returned no row");

      // 포인트 적립 (실패해도 댓글 저장 유지)
      try {
        const todayCount = await getTodayCount(db, { userId: user.id, reason: "comment.created" });
        await earnPoints(db, {
          userId: user.id,
          reason: "comment.created",
          sourceType: "comment",
          sourceId: row.id,
          todayCount,
        });
      } catch (err) {
        console.error("[points] 댓글 적립 실패 (무시):", (err as Error).message);
      }

      // notifications 큐 발행 (Epic 7 알림 전송 담당)
      try {
        await getNotificationsQueue().add("comment.created", {
          commentId: row.id,
          authorId: user.id,
          targetType,
          targetId,
          ...(parentCommentAuthorId ? { parentCommentAuthorId } : {}),
        });
      } catch {
        console.error("[comments] notifications 큐 발행 실패");
      }

      return reply.code(201).send({ id: row.id });
    },
  );

  // ── PATCH /comments/:id — 수정 ───────────────────────────────────────────────
  typed.patch(
    "/comments/:id",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "댓글 수정. 소유자만 가능.",
        tags: ["comments"],
        params: z.object({ id: z.string().uuid() }),
        body: z.object({ content: z.string().min(1).max(5000) }),
        response: {
          200: z.object({ id: z.string().uuid() }),
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { id } = request.params as { id: string };
      const { content } = request.body as { content: string };
      const db = getDb();

      if (!content.trim()) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: "댓글 내용을 입력해주세요." },
        });
      }

      const rows = await db
        .select({
          id: schema.comments.id,
          authorId: schema.comments.authorId,
          status: schema.comments.status,
        })
        .from(schema.comments)
        .where(eq(schema.comments.id, id))
        .limit(1);

      const comment = rows[0];
      if (!comment) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "댓글을 찾을 수 없습니다." },
        });
      }
      if (comment.authorId !== user.id) {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "권한이 없습니다." },
        });
      }
      if (comment.status === "deleted") {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: "삭제된 댓글은 수정할 수 없습니다." },
        });
      }

      await db
        .update(schema.comments)
        .set({ content: content.trim(), updatedAt: new Date() })
        .where(eq(schema.comments.id, id));

      return reply.send({ id });
    },
  );

  // ── DELETE /comments/:id — soft-delete ──────────────────────────────────────
  typed.delete(
    "/comments/:id",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "댓글 soft-delete. 소유자만 가능. status=deleted + deleted_at 설정.",
        tags: ["comments"],
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

      const rows = await db
        .select({ id: schema.comments.id, authorId: schema.comments.authorId })
        .from(schema.comments)
        .where(eq(schema.comments.id, id))
        .limit(1);

      const comment = rows[0];
      if (!comment) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "댓글을 찾을 수 없습니다." },
        });
      }
      if (comment.authorId !== user.id) {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "권한이 없습니다." },
        });
      }

      await db.transaction(async (tx) => {
        await tx
          .update(schema.comments)
          .set({ status: "deleted", deletedAt: new Date() })
          .where(eq(schema.comments.id, id));

        try {
          await revokePoints(tx, {
            userId: user.id,
            reason: "comment.created",
            sourceType: "comment",
            sourceId: id,
          });
        } catch (err) {
          console.error("[points] 댓글 회수 실패 (무시):", (err as Error).message);
        }
      });

      return reply.code(204).send({});
    },
  );
}
