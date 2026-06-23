/**
 * /api/v1/bookmarks 라우트 — Story 5.7
 *
 * POST   /api/v1/bookmarks                    북마크 추가 (인증 필수)
 * DELETE /api/v1/bookmarks/:id                북마크 해제 (인증 필수, 소유자만)
 * GET    /api/v1/users/me/bookmarks           내 북마크 목록 (인증 필수, 페이지네이션)
 * GET    /api/v1/users/me/bookmarks/status    특정 콘텐츠 북마크 여부 조회
 */

import { getDb, schema } from "@ai-jakdang/database";
import { createBookmarkInputSchema, errorResponseSchema } from "@ai-jakdang/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq, and, desc, inArray } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { requireAuthHook } from "../../plugins/require-auth.js";

type RequestWithUser = FastifyRequest & { user: { id: string } };

export async function bookmarksRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── POST /api/v1/bookmarks ─────────────────────────────────────────────────
  typed.post(
    "/bookmarks",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "북마크 추가",
        tags: ["bookmarks"],
        body: createBookmarkInputSchema,
        response: {
          201: z.object({ id: z.string().uuid() }),
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { targetType, targetId } = request.body;
      const db = getDb();

      const existing = await db
        .select({ id: schema.bookmarks.id })
        .from(schema.bookmarks)
        .where(
          and(
            eq(schema.bookmarks.userId, user.id),
            eq(schema.bookmarks.targetType, targetType),
            eq(schema.bookmarks.targetId, targetId),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        return reply.code(409).send({
          error: { code: "ALREADY_BOOKMARKED", message: "이미 북마크한 콘텐츠입니다." },
        });
      }

      const [row] = await db
        .insert(schema.bookmarks)
        .values({ userId: user.id, targetType, targetId })
        .returning({ id: schema.bookmarks.id });

      return reply.code(201).send({ id: row.id });
    },
  );

  // ── DELETE /api/v1/bookmarks/:id ──────────────────────────────────────────
  typed.delete(
    "/bookmarks/:id",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "북마크 해제",
        tags: ["bookmarks"],
        params: z.object({ id: z.string().uuid() }),
        response: {
          204: z.object({}),
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { id } = request.params;
      const db = getDb();

      const existing = await db
        .select({ userId: schema.bookmarks.userId })
        .from(schema.bookmarks)
        .where(eq(schema.bookmarks.id, id))
        .limit(1);

      if (!existing[0]) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "북마크를 찾을 수 없습니다." } });
      }
      if (existing[0].userId !== user.id) {
        return reply.code(403).send({ error: { code: "FORBIDDEN", message: "권한이 없습니다." } });
      }

      await db.delete(schema.bookmarks).where(eq(schema.bookmarks.id, id));
      return reply.code(204).send({});
    },
  );

  // ── GET /api/v1/users/me/bookmarks ────────────────────────────────────────
  typed.get(
    "/users/me/bookmarks",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "내 북마크 목록 (페이지네이션)",
        tags: ["bookmarks"],
        querystring: z.object({
          page: z.coerce.number().int().positive().default(1),
          pageSize: z.coerce.number().int().positive().max(50).default(20),
          targetType: z.enum(["post", "question", "resource"]).optional(),
        }),
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { page, pageSize, targetType } = request.query;
      const db = getDb();

      const conditions = [eq(schema.bookmarks.userId, user.id)];
      if (targetType) {
        conditions.push(eq(schema.bookmarks.targetType, targetType));
      }

      const rows = await db
        .select({
          id: schema.bookmarks.id,
          targetType: schema.bookmarks.targetType,
          targetId: schema.bookmarks.targetId,
          createdAt: schema.bookmarks.createdAt,
        })
        .from(schema.bookmarks)
        .where(and(...conditions))
        .orderBy(desc(schema.bookmarks.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      // N+1 방지: targetType별로 분류 후 배치 조회
      const postIds = rows.filter((r) => r.targetType === "post").map((r) => r.targetId);
      const questionIds = rows.filter((r) => r.targetType === "question").map((r) => r.targetId);
      const resourceIds = rows.filter((r) => r.targetType === "resource").map((r) => r.targetId);

      const [postRows, questionRows, resourceRows] = await Promise.all([
        postIds.length > 0
          ? db
              .select({ id: schema.posts.id, title: schema.posts.title, slug: schema.posts.slug, board: schema.posts.board })
              .from(schema.posts)
              .where(inArray(schema.posts.id, postIds))
          : [],
        questionIds.length > 0
          ? db
              .select({ id: schema.questions.id, title: schema.questions.title })
              .from(schema.questions)
              .where(inArray(schema.questions.id, questionIds))
          : [],
        resourceIds.length > 0
          ? db
              .select({ id: schema.resources.id, title: schema.resources.title, slug: schema.resources.slug })
              .from(schema.resources)
              .where(inArray(schema.resources.id, resourceIds))
          : [],
      ]);

      const postMap = new Map(postRows.map((r) => [r.id, r]));
      const questionMap = new Map(questionRows.map((r) => [r.id, r]));
      const resourceMap = new Map(resourceRows.map((r) => [r.id, r]));

      const items = rows.map((bm) => {
        let title = "(삭제된 콘텐츠)";
        let href = "";

        if (bm.targetType === "post") {
          const p = postMap.get(bm.targetId);
          if (p) { title = p.title; href = `/${p.board}/${p.slug}`; }
        } else if (bm.targetType === "question") {
          const q = questionMap.get(bm.targetId);
          if (q) { title = q.title; href = `/questions/${q.id}`; }
        } else if (bm.targetType === "resource") {
          const r = resourceMap.get(bm.targetId);
          if (r) { title = r.title; href = `/resources/${r.slug}`; }
        }

        return {
          id: bm.id,
          targetType: bm.targetType,
          targetId: bm.targetId,
          title,
          href,
          savedAt: bm.createdAt.toISOString(),
        };
      });

      return reply.send({ items, meta: { page, pageSize } });
    },
  );

  // ── GET /api/v1/users/me/bookmarks/status ─────────────────────────────────
  typed.get(
    "/users/me/bookmarks/status",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "특정 콘텐츠 북마크 여부 조회",
        tags: ["bookmarks"],
        querystring: z.object({
          targetType: z.enum(["post", "question", "resource"]),
          targetId: z.string().uuid(),
        }),
        response: {
          200: z.object({ bookmarked: z.boolean(), bookmarkId: z.string().uuid().nullable() }),
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { targetType, targetId } = request.query;
      const db = getDb();

      const row = await db
        .select({ id: schema.bookmarks.id })
        .from(schema.bookmarks)
        .where(
          and(
            eq(schema.bookmarks.userId, user.id),
            eq(schema.bookmarks.targetType, targetType),
            eq(schema.bookmarks.targetId, targetId),
          ),
        )
        .limit(1);

      return reply.send({ bookmarked: row.length > 0, bookmarkId: row[0]?.id ?? null });
    },
  );
}
