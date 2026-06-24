/**
 * GET /api/v1/posts/popular — 홈 페이지 실전 인기글 (Story 8.5)
 *
 * 쿼리 파라미터:
 *   category : 'vibe-coding'|'ai-automation'|'ai-monetization'|'lounge' (선택, 없으면 전체)
 *   period   : '7d'|'30d' (기본 '7d')
 *   board    : 쉼표 구분 다중 보드 슬러그 (선택, category 대신 직접 보드 지정 시 사용)
 *   sort     : 'popular'|'latest' (기본 'popular')
 *   limit    : 1~20 (기본 5)
 *
 * 응답: { items: PopularPostItem[] }
 *
 * Redis 캐시: TTL 3600s (AR-17).
 *   키 = buildPopularKey(category, period) 또는 MAIN_LOUNGE_LATEST.
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getDb, schema } from "@ai-jakdang/database";
import { popularPostsResponseSchema } from "@ai-jakdang/contracts/home";
import { errorResponseSchema } from "@ai-jakdang/contracts";
import { eq, and, isNull, desc, sql, inArray } from "drizzle-orm";
import { getApiRedis } from "../../../lib/redis.js";
import { buildPopularKey, MAIN_LOUNGE_LATEST } from "../../../lib/cache.js";

const popularQuerySchema = z.object({
  category: z.string().trim().max(50).optional(),
  period: z.enum(["7d", "30d"]).default("7d"),
  board: z.string().trim().max(200).optional(), // 쉼표 구분 다중 보드
  sort: z.enum(["popular", "latest"]).default("popular"),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export async function registerPopularPostsRoute(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/posts/popular",
    {
      schema: {
        description:
          "홈 페이지 인기글. category 또는 board 파라미터로 필터. Redis TTL 1h. 비회원 공개.",
        tags: ["posts"],
        querystring: popularQuerySchema,
        response: {
          200: popularPostsResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { category, period, board, sort, limit } = request.query;

      // ── 캐시 키 결정 ──────────────────────────────────────────────────────────
      let cacheKey: string;
      if (board) {
        cacheKey = MAIN_LOUNGE_LATEST;
      } else {
        cacheKey = buildPopularKey(category ?? "all", period);
      }

      // ── Redis 캐시 hit 확인 ──────────────────────────────────────────────────
      const redis = getApiRedis();
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return reply.code(200).send(JSON.parse(cached));
        }
      } catch {
        // Redis 오류는 무시하고 DB 직접 조회
      }

      // ── DB 조회 ──────────────────────────────────────────────────────────────
      const db = getDb();

      // 기간 계산
      const periodDays = period === "30d" ? 30 : 7;
      const since = new Date();
      since.setDate(since.getDate() - periodDays);

      // board 필터 — 쉼표 구분 다중 보드 파싱
      const boardList = board ? board.split(",").map((b) => b.trim()).filter(Boolean) : [];

      // WHERE 조건 구성
      const conditions = [
        eq(schema.posts.status, "published"),
        isNull(schema.posts.deletedAt),
        sql`${schema.posts.createdAt} >= ${since.toISOString()}`,
      ];

      if (boardList.length > 0) {
        conditions.push(inArray(schema.posts.board, boardList));
      } else if (category) {
        conditions.push(eq(schema.posts.category, category));
      }

      // 정렬 컬럼 — popular: view_count + like_count 합산 DESC
      // like_count는 reactions 테이블 집계 서브쿼리
      const likeCountSq = db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.reactions)
        .where(
          and(
            eq(schema.reactions.targetType, "post"),
            sql`${schema.reactions.targetId} = ${schema.posts.id}`,
            eq(schema.reactions.reactionType, "like"),
          ),
        );

      const commentCountSq = db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.comments)
        .where(
          and(
            eq(schema.comments.targetType, "post"),
            sql`${schema.comments.targetId} = ${schema.posts.id}`,
            eq(schema.comments.status, "visible"),
          ),
        );

      const rows = await db
        .select({
          id: schema.posts.id,
          title: schema.posts.title,
          description: schema.posts.summary,
          category: schema.posts.category,
          board: schema.posts.board,
          viewCount: schema.posts.viewCount,
          createdAt: schema.posts.createdAt,
          likeCount: sql<number>`(${likeCountSq})`,
          commentCount: sql<number>`(${commentCountSq})`,
        })
        .from(schema.posts)
        .where(and(...conditions))
        .orderBy(
          sort === "popular"
            ? desc(sql`${schema.posts.viewCount} + (${likeCountSq})`)
            : desc(schema.posts.createdAt),
        )
        .limit(limit);

      // 태그 배치 조회 (N+1 방지)
      const postIds = rows.map((r) => r.id);
      const tagsMap = new Map<string, string[]>();

      if (postIds.length > 0) {
        const tagRows = await db
          .select({
            targetId: schema.taggable.targetId,
            name: schema.tags.name,
          })
          .from(schema.taggable)
          .innerJoin(schema.tags, eq(schema.taggable.tagId, schema.tags.id))
          .where(
            and(
              eq(schema.taggable.targetType, "post"),
              inArray(schema.taggable.targetId, postIds),
            ),
          );

        for (const row of tagRows) {
          const existing = tagsMap.get(row.targetId) ?? [];
          existing.push(row.name);
          tagsMap.set(row.targetId, existing);
        }
      }

      const items = rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description ?? null,
        category: r.category ?? null,
        board: r.board,
        viewCount: r.viewCount,
        likeCount: r.likeCount ?? 0,
        commentCount: r.commentCount ?? 0,
        createdAt: r.createdAt.toISOString(),
        tags: tagsMap.get(r.id) ?? [],
      }));

      const result = { items };

      // ── Redis 캐시 저장 (TTL 3600s) ──────────────────────────────────────────
      try {
        await redis.setex(cacheKey, 3600, JSON.stringify(result));
      } catch {
        // 캐시 저장 실패는 무시
      }

      return reply.code(200).send(result);
    },
  );
}
