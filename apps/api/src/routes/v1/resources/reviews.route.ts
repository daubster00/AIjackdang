/**
 * 실전자료 후기 라우트 — comments 테이블 기반 별점 후기
 *
 * GET    /resources/:id/reviews                   후기 목록 (최상위+대댓글, 인증 옵션)
 * POST   /resources/:id/reviews                   후기 등록 (최상위: rating 1~5 필수, 대댓글: rating 없음)
 * DELETE /resources/:id/reviews/:reviewId         soft-delete + avg_rating/rating_count 재집계
 *
 * 설계:
 * - comments.rating(smallint)을 source of truth로 사용.
 * - 최상위 후기 등록/삭제 시 resources.avg_rating·rating_count를 동일 트랜잭션에서 재집계.
 * - 대댓글 수정/삭제는 기존 PATCH/DELETE /comments/:id 공용 엔드포인트를 그대로 사용.
 * - N+1 방지(AR-2): 최상위 SELECT → 대댓글 배치 → 반응 배치.
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getDb, schema } from "@ai-jakdang/database";
import { eq, and, isNull, inArray, sql, desc, asc } from "drizzle-orm";
import { requireAuthHook } from "../../../plugins/require-auth.js";
import { userAuth } from "../../../auth/user-auth.js";
import { getDefaultAvatarUrl } from "@ai-jakdang/core";
import { errorResponseSchema } from "@ai-jakdang/contracts";
import type { FastifyRequest } from "fastify";

type RequestWithUser = FastifyRequest & { user: { id: string } };

// ── 응답 스키마 ────────────────────────────────────────────────────────────────

const replyReviewSchema = z.object({
  id: z.string().uuid(),
  authorId: z.string().uuid(),
  authorNickname: z.string().nullable(),
  authorAvatarUrl: z.string().nullable(),
  targetType: z.literal("resource"),
  targetId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  content: z.string().nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  status: z.enum(["visible", "deleted"]),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  likeCount: z.number().int().nonnegative(),
  dislikeCount: z.number().int().nonnegative(),
  myReaction: z.enum(["like", "dislike"]).nullable(),
  myReactionId: z.string().uuid().nullable(),
});

const reviewItemSchema = replyReviewSchema.extend({
  replies: z.array(replyReviewSchema),
});

const reviewListResponseSchema = z.object({
  items: z.array(reviewItemSchema),
  meta: z.object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  }),
});

const aggregateSchema = z.object({
  avgRating: z.number(),
  ratingCount: z.number().int().nonnegative(),
});

// ── 재집계 헬퍼 ────────────────────────────────────────────────────────────────

type DbTx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

async function recomputeResourceRating(
  tx: DbTx,
  resourceId: string,
): Promise<{ avgRating: number; ratingCount: number }> {
  const [updated] = await tx
    .update(schema.resources)
    .set({
      avgRating: sql`(
        SELECT COALESCE(AVG(rating)::numeric(3,2), 0)
        FROM ${schema.comments}
        WHERE target_type = 'resource'
          AND target_id = ${resourceId}
          AND parent_id IS NULL
          AND rating IS NOT NULL
          AND status = 'visible'
      )`,
      ratingCount: sql`(
        SELECT COUNT(*)::int
        FROM ${schema.comments}
        WHERE target_type = 'resource'
          AND target_id = ${resourceId}
          AND parent_id IS NULL
          AND rating IS NOT NULL
          AND status = 'visible'
      )`,
      updatedAt: new Date(),
    })
    .where(eq(schema.resources.id, resourceId))
    .returning({
      avgRating: schema.resources.avgRating,
      ratingCount: schema.resources.ratingCount,
    });

  return {
    avgRating: updated ? parseFloat(String(updated.avgRating ?? 0)) : 0,
    ratingCount: updated?.ratingCount ?? 0,
  };
}

// ── 라우트 등록 ────────────────────────────────────────────────────────────────

export async function registerResourceReviewRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /resources/:id/reviews ──────────────────────────────────────────────
  typed.get(
    "/resources/:id/reviews",
    {
      schema: {
        description:
          "실전자료 후기 목록 조회. 최상위 최신순 + 각 부모의 대댓글 포함. 비인증 가능.",
        tags: ["resources", "reviews"],
        params: z.object({ id: z.string().uuid() }),
        querystring: z.object({
          page: z.coerce.number().int().positive().default(1),
          pageSize: z.coerce.number().int().positive().max(100).default(20),
        }),
        response: {
          200: reviewListResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id: resourceId } = request.params;
      const { page, pageSize } = request.query as { page: number; pageSize: number };
      const db = getDb();
      const offset = (page - 1) * pageSize;

      // 선택적 인증
      let currentUserId: string | null = null;
      try {
        const session = await userAuth.api.getSession({
          headers: request.headers as unknown as Headers,
        });
        currentUserId = session?.user?.id ?? null;
      } catch {
        // 비회원 허용
      }

      // 1. 최상위 후기
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
          rating: schema.comments.rating,
          status: schema.comments.status,
          deletedAt: schema.comments.deletedAt,
          createdAt: schema.comments.createdAt,
          updatedAt: schema.comments.updatedAt,
        })
        .from(schema.comments)
        .leftJoin(schema.users, eq(schema.comments.authorId, schema.users.id))
        .where(
          and(
            eq(schema.comments.targetType, "resource"),
            eq(schema.comments.targetId, resourceId),
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
            eq(schema.comments.targetType, "resource"),
            eq(schema.comments.targetId, resourceId),
            isNull(schema.comments.parentId),
          ),
        );
      const total = totalResult[0]?.count ?? 0;

      if (topRows.length === 0) {
        return reply.send({ items: [], meta: { total, page, pageSize } });
      }

      const topIds = topRows.map((r) => r.id);

      // 2. 대댓글 배치 (N+1 방지, AR-2)
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
          rating: schema.comments.rating,
          status: schema.comments.status,
          deletedAt: schema.comments.deletedAt,
          createdAt: schema.comments.createdAt,
          updatedAt: schema.comments.updatedAt,
        })
        .from(schema.comments)
        .leftJoin(schema.users, eq(schema.comments.authorId, schema.users.id))
        .where(inArray(schema.comments.parentId, topIds))
        .orderBy(asc(schema.comments.createdAt));

      // 3. 반응 수 배치
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

      // 4. 내 반응 배치 (인증 시)
      const myReactionMap = new Map<string, { type: "like" | "dislike"; id: string }>();
      if (currentUserId && allIds.length > 0) {
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

      // 5. 메모리 조합
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

      type RowType = (typeof topRows)[0];
      function toOut(row: RowType) {
        const counts = countMap.get(row.id) ?? { like: 0, dislike: 0 };
        const myR = myReactionMap.get(row.id) ?? null;
        const isDeleted = row.status === "deleted";
        return {
          id: row.id,
          authorId: row.authorId,
          authorNickname: row.authorNickname ?? null,
          authorAvatarUrl:
            row.authorNickname != null
              ? row.authorAvatarUrl ||
                row.authorImage ||
                getDefaultAvatarUrl(row.authorDefaultAvatarIndex ?? 0)
              : null,
          targetType: "resource" as const,
          targetId: row.targetId,
          parentId: row.parentId ?? null,
          content: isDeleted ? null : row.content,
          rating: isDeleted ? null : (row.rating ?? null),
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

      const items = topRows.map((row) => ({
        ...toOut(row),
        replies: (replyByParent.get(row.id) ?? []).map(toOut),
      }));

      return reply.send({ items, meta: { total, page, pageSize } });
    },
  );

  // ── POST /resources/:id/reviews ─────────────────────────────────────────────
  typed.post(
    "/resources/:id/reviews",
    {
      preHandler: [requireAuthHook],
      schema: {
        description:
          "후기 등록. 최상위(parentId 없음)는 rating(1~5) 필수 + avg_rating·rating_count 재집계. 대댓글은 rating 없음.",
        tags: ["resources", "reviews"],
        params: z.object({ id: z.string().uuid() }),
        body: z.object({
          content: z.string().min(1).max(5000),
          rating: z.number().int().min(1).max(5).optional(),
          parentId: z.string().uuid().optional(),
        }),
        response: {
          201: z.object({
            id: z.string().uuid(),
            avgRating: z.number(),
            ratingCount: z.number().int().nonnegative(),
          }),
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { id: resourceId } = request.params;
      const { content, rating, parentId } = request.body as {
        content: string;
        rating?: number;
        parentId?: string;
      };
      const db = getDb();

      const isTopLevel = !parentId;

      if (isTopLevel && (rating === undefined || rating < 1 || rating > 5)) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: "별점(1~5)을 선택해주세요." },
        });
      }

      // 대댓글 검증: 2단계 중첩 차단
      if (parentId) {
        const parentRows = await db
          .select({ id: schema.comments.id, parentId: schema.comments.parentId })
          .from(schema.comments)
          .where(eq(schema.comments.id, parentId))
          .limit(1);

        const parent = parentRows[0];
        if (!parent) {
          return reply.code(400).send({
            error: { code: "VALIDATION_ERROR", message: "부모 후기를 찾을 수 없습니다." },
          });
        }
        if (parent.parentId !== null) {
          return reply.code(400).send({
            error: { code: "NESTING_NOT_ALLOWED", message: "2단계 이상의 답글은 허용되지 않습니다." },
          });
        }
      }

      const result = await db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(schema.comments)
          .values({
            authorId: user.id,
            targetType: "resource",
            targetId: resourceId,
            parentId: parentId ?? null,
            content: content.trim(),
            rating: isTopLevel ? (rating as number) : null,
          })
          .returning({ id: schema.comments.id });

        if (!inserted) throw new Error("INSERT review returned no row");

        let avgRating = 0;
        let ratingCount = 0;

        if (isTopLevel) {
          const agg = await recomputeResourceRating(tx, resourceId);
          avgRating = agg.avgRating;
          ratingCount = agg.ratingCount;
        }

        return { id: inserted.id, avgRating, ratingCount };
      });

      return reply.code(201).send(result);
    },
  );

  // ── DELETE /resources/:id/reviews/:reviewId ─────────────────────────────────
  typed.delete(
    "/resources/:id/reviews/:reviewId",
    {
      preHandler: [requireAuthHook],
      schema: {
        description:
          "후기 soft-delete. 소유자만 가능. 최상위 후기 삭제 시 avg_rating·rating_count 재집계 후 반환.",
        tags: ["resources", "reviews"],
        params: z.object({
          id: z.string().uuid(),
          reviewId: z.string().uuid(),
        }),
        response: {
          200: aggregateSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { id: resourceId, reviewId } = request.params as {
        id: string;
        reviewId: string;
      };
      const db = getDb();

      const rows = await db
        .select({
          id: schema.comments.id,
          authorId: schema.comments.authorId,
          parentId: schema.comments.parentId,
        })
        .from(schema.comments)
        .where(eq(schema.comments.id, reviewId))
        .limit(1);

      const review = rows[0];
      if (!review) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "후기를 찾을 수 없습니다." },
        });
      }
      if (review.authorId !== user.id) {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "권한이 없습니다." },
        });
      }

      const isTopLevel = review.parentId === null;

      const result = await db.transaction(async (tx) => {
        await tx
          .update(schema.comments)
          .set({ status: "deleted", deletedAt: new Date() })
          .where(eq(schema.comments.id, reviewId));

        if (isTopLevel) {
          return recomputeResourceRating(tx, resourceId);
        }

        // 대댓글: 집계값 변동 없음, 현재 값 그대로 반환
        const [res] = await tx
          .select({
            avgRating: schema.resources.avgRating,
            ratingCount: schema.resources.ratingCount,
          })
          .from(schema.resources)
          .where(eq(schema.resources.id, resourceId))
          .limit(1);

        return {
          avgRating: res ? parseFloat(String(res.avgRating ?? 0)) : 0,
          ratingCount: res?.ratingCount ?? 0,
        };
      });

      return reply.code(200).send(result);
    },
  );
}
