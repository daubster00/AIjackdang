/**
 * sitemap 전용 API 라우트 — Story 8.7
 *
 * 공개(인증 불필요) 엔드포인트. Next.js sitemap.ts 에서 호출한다.
 * DB 직접 쿼리 (서비스 레이어 분리 불필요 — 경량 구현).
 *
 * 엔드포인트:
 *   GET /api/v1/sitemap/posts       — 전체 published 게시글 (board 포함)
 *   GET /api/v1/sitemap/questions   — 전체 published 질문
 *   GET /api/v1/sitemap/resources   — 전체 published 자료
 *   GET /api/v1/sitemap/notices     — board='notice' published 게시글
 *   GET /api/v1/sitemap/tags        — 콘텐츠 3개 이상인 태그
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { getDb, schema } from "@ai-jakdang/database";
import { eq, and, isNull, desc, gte, count } from "drizzle-orm";
import { z } from "zod";

// ── 로컬 응답 스키마 (contracts/index.ts 등록 전 임시 정의) ─────────────────
const sitemapPostItemSchema = z.object({
  slug: z.string(),
  board: z.string(),
  updatedAt: z.string(),
});
const sitemapPostsResponseSchema = z.object({ items: z.array(sitemapPostItemSchema) });

const sitemapQuestionItemSchema = z.object({
  slug: z.string(),
  updatedAt: z.string(),
});
const sitemapQuestionsResponseSchema = z.object({ items: z.array(sitemapQuestionItemSchema) });

const sitemapTagItemSchema = z.object({ name: z.string() });
const sitemapTagsResponseSchema = z.object({ items: z.array(sitemapTagItemSchema) });

export async function sitemapRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /sitemap/posts ────────────────────────────────────────────────────
  // published 게시글 목록 (board='notice' 제외)
  server.get(
    "/sitemap/posts",
    {
      schema: {
        response: {
          200: sitemapPostsResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      const db = getDb();

      const rows = await db
        .select({
          slug: schema.posts.slug,
          board: schema.posts.board,
          updatedAt: schema.posts.updatedAt,
        })
        .from(schema.posts)
        .where(
          and(
            eq(schema.posts.status, "published"),
            isNull(schema.posts.deletedAt),
          ),
        )
        .orderBy(desc(schema.posts.updatedAt));

      return reply.send({
        items: rows.map((r) => ({
          slug: r.slug,
          board: r.board,
          updatedAt: r.updatedAt.toISOString(),
        })),
      });
    },
  );

  // ── GET /sitemap/questions ────────────────────────────────────────────────
  server.get(
    "/sitemap/questions",
    {
      schema: {
        response: {
          200: sitemapQuestionsResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      const db = getDb();

      const rows = await db
        .select({
          slug: schema.questions.slug,
          updatedAt: schema.questions.updatedAt,
        })
        .from(schema.questions)
        .where(
          and(
            eq(schema.questions.status, "published"),
            isNull(schema.questions.deletedAt),
          ),
        )
        .orderBy(desc(schema.questions.updatedAt));

      return reply.send({
        items: rows.map((r) => ({
          slug: r.slug,
          updatedAt: r.updatedAt.toISOString(),
        })),
      });
    },
  );

  // ── GET /sitemap/resources ────────────────────────────────────────────────
  server.get(
    "/sitemap/resources",
    {
      schema: {
        response: {
          200: sitemapPostsResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      const db = getDb();

      const rows = await db
        .select({
          slug: schema.resources.slug,
          updatedAt: schema.resources.updatedAt,
        })
        .from(schema.resources)
        .where(
          and(
            eq(schema.resources.status, "published"),
            isNull(schema.resources.deletedAt),
          ),
        )
        .orderBy(desc(schema.resources.updatedAt));

      return reply.send({
        items: rows.map((r) => ({
          slug: r.slug,
          board: "resources",
          updatedAt: r.updatedAt.toISOString(),
        })),
      });
    },
  );

  // ── GET /sitemap/notices ──────────────────────────────────────────────────
  // board='notice' published 게시글
  server.get(
    "/sitemap/notices",
    {
      schema: {
        response: {
          200: sitemapPostsResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      const db = getDb();

      const rows = await db
        .select({
          slug: schema.posts.slug,
          board: schema.posts.board,
          updatedAt: schema.posts.updatedAt,
        })
        .from(schema.posts)
        .where(
          and(
            eq(schema.posts.board, "notice"),
            eq(schema.posts.status, "published"),
            isNull(schema.posts.deletedAt),
          ),
        )
        .orderBy(desc(schema.posts.updatedAt));

      return reply.send({
        items: rows.map((r) => ({
          slug: r.slug,
          board: r.board,
          updatedAt: r.updatedAt.toISOString(),
        })),
      });
    },
  );

  // ── GET /sitemap/tags ─────────────────────────────────────────────────────
  // 콘텐츠 3개 이상인 태그 목록
  server.get(
    "/sitemap/tags",
    {
      schema: {
        response: {
          200: sitemapTagsResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      const db = getDb();

      const rows = await db
        .select({
          name: schema.tags.name,
          cnt: count(schema.taggable.tagId),
        })
        .from(schema.tags)
        .innerJoin(schema.taggable, eq(schema.tags.id, schema.taggable.tagId))
        .groupBy(schema.tags.id, schema.tags.name)
        .having(gte(count(schema.taggable.tagId), 3));

      return reply.send({
        items: rows.map((r) => ({ name: r.name })),
      });
    },
  );
}
