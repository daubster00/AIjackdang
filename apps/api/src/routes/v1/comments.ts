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
import { requireAuthHook, checkSuspendedHook } from "../../plugins/require-auth.js";
import { contentGuard } from "../../middleware/contentGuard.js";
import { publishNotification } from "../../lib/notifications.js";
import { buildPostDetailPath } from "../../lib/postUrl.js";
import { getRedisPublisher } from "../../lib/redis.js";
import { userAuth } from "../../auth/user-auth.js";
import { revokePoints } from "./gamification/points.service.js";
import { getDefaultAvatarUrl } from "@ai-jakdang/core";
import { createComment, CommentServiceError } from "./comments/service.js";

type RequestWithUser = FastifyRequest & { user: { id: string } };

// ── 응답 스키마 ────────────────────────────────────────────────────────────────

const replyItemSchema = z.object({
  id: z.string().uuid(),
  authorId: z.string().uuid(),
  authorNickname: z.string().nullable(),
  /** 작성자 프로필 사진 URL. 서버에서 resolve 완료. 탈퇴회원은 null. */
  authorAvatarUrl: z.string().nullable(),
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
          authorAvatarUrl: schema.users.avatarUrl,
          authorImage: schema.users.image,
          authorDefaultAvatarIndex: schema.users.defaultAvatarIndex,
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
          authorAvatarUrl: schema.users.avatarUrl,
          authorImage: schema.users.image,
          authorDefaultAvatarIndex: schema.users.defaultAvatarIndex,
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
        id: string; authorId: string; authorNickname: string | null; authorAvatarUrl: string | null;
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
          authorAvatarUrl: row.authorNickname != null
            ? (row.authorAvatarUrl || row.authorImage || getDefaultAvatarUrl(row.authorDefaultAvatarIndex ?? 0))
            : null,
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
      preHandler: [requireAuthHook, checkSuspendedHook, contentGuard],
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

      // ── 도메인 로직 위임: createComment (Story 11.3) ──────────────────────────
      // 불변식 1~5(빈내용/parentId검증/INSERT/포인트/알림큐)는 service에서 처리.
      let commentResult: { id: string; parentCommentAuthorId: string | null };
      try {
        commentResult = await createComment({ userId: user.id, targetType, targetId, content, parentId });
      } catch (err) {
        if (err instanceof CommentServiceError) {
          return reply.code(400).send({
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }

      const { id: commentId, parentCommentAuthorId } = commentResult;

      // 게시글 댓글이면 board+slug를 조회해 알림 클릭 시 글로 이동할 상세경로를 만든다.
      // (targetId 에 상세경로를 저장 → resolveNotificationUrl 이 그대로 사용)
      let postNotificationTarget: string | null = null;
      if (targetType === "post") {
        try {
          const postRows = await db
            .select({
              userId: schema.posts.userId,
              board: schema.posts.board,
              slug: schema.posts.slug,
            })
            .from(schema.posts)
            .where(eq(schema.posts.id, targetId))
            .limit(1);
          const postRow = postRows[0];
          // 상세경로 빌드 실패(알 수 없는 board 등) 시엔 글 UUID로 폴백
          postNotificationTarget = buildPostDetailPath(postRow?.board, postRow?.slug) ?? targetId;

          // 알림 직접 발행: 최상위 댓글 → 게시글 작성자에게 comment.created (본인 제외)
          if (!parentId) {
            const postAuthorId = postRow?.userId ?? null;
            if (postAuthorId && postAuthorId !== user.id) {
              await publishNotification(
                postAuthorId,
                {
                  type: "comment.created",
                  title: "게시글에 새 댓글이 달렸습니다.",
                  body: content.trim().length > 60
                    ? content.trim().slice(0, 60) + "…"
                    : content.trim(),
                  targetType: "post",
                  targetId: postNotificationTarget,
                },
                db,
                getRedisPublisher(),
              );
            }
          }
        } catch (err) {
          console.error("[comments] comment.created 알림 발행 실패 (무시):", (err as Error).message);
        }
      }

      // 알림 직접 발행: 대댓글 → 부모 댓글 작성자에게 comment.replied (본인 제외)
      // 게시글 작성자 comment.created 와 중복되지 않도록 parentId 있을 때만 발행
      if (parentId && parentCommentAuthorId && parentCommentAuthorId !== user.id) {
        try {
          await publishNotification(
            parentCommentAuthorId,
            {
              type: "comment.replied",
              title: "댓글에 답글이 달렸습니다.",
              body: content.trim().length > 60
                ? content.trim().slice(0, 60) + "…"
                : content.trim(),
              targetType: targetType,
              // 게시글 댓글의 답글이면 상세경로로 이동, 그 외 대상은 기존 식별자 유지
              targetId: targetType === "post" ? (postNotificationTarget ?? targetId) : targetId,
            },
            db,
            getRedisPublisher(),
          );
        } catch (err) {
          console.error("[comments] comment.replied 알림 발행 실패 (무시):", (err as Error).message);
        }
      }

      return reply.code(201).send({ id: commentId });
    },
  );

  // ── PATCH /comments/:id — 수정 ───────────────────────────────────────────────
  typed.patch(
    "/comments/:id",
    {
      preHandler: [requireAuthHook, checkSuspendedHook],
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

  // ── DELETE /comments/:id — 대댓글 없으면 완전삭제 / 있으면 soft-delete ────────
  typed.delete(
    "/comments/:id",
    {
      preHandler: [requireAuthHook],
      schema: {
        description:
          "댓글 삭제. 소유자만 가능. 대댓글이 하나도 없으면 행·반응까지 완전삭제(흔적 없음), " +
          "대댓글이 달린 경우에만 스레드 구조 보존을 위해 soft-delete(자리표시).",
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

      // 자식(대댓글) 존재 여부 — 하나라도 있으면 스레드 보존 위해 자리표시 유지
      const childRows = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(schema.comments)
        .where(eq(schema.comments.parentId, id));
      const hasChildren = (childRows[0]?.count ?? 0) > 0;

      await db.transaction(async (tx) => {
        if (hasChildren) {
          // 대댓글이 있으므로 soft-delete(자리표시 "삭제된 댓글입니다.")
          await tx
            .update(schema.comments)
            .set({ status: "deleted", deletedAt: new Date() })
            .where(eq(schema.comments.id, id));
        } else {
          // 대댓글이 없으므로 반응·행까지 완전삭제 — 흔적 없음
          await tx
            .delete(schema.reactions)
            .where(
              and(
                eq(schema.reactions.targetType, "comment"),
                eq(schema.reactions.targetId, id),
              ),
            );
          await tx.delete(schema.comments).where(eq(schema.comments.id, id));
        }

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
