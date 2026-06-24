/**
 * GET /api/v1/notices/pinned — 홈 페이지 핀 공지 1건 (Story 8.5)
 *
 * posts 테이블의 board='notice' + is_pinned=true + status='published' 조건으로 최신 1건 반환.
 * Epic 2(공지 작성)에서 저장된 데이터를 읽기 전용으로 조회한다.
 *
 * 응답: { id, title, content, url, slug } 또는 null (핀된 공지 없음)
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getDb, schema } from "@ai-jakdang/database";
import { noticeBannerSchema } from "@ai-jakdang/contracts/home";
import { errorResponseSchema } from "@ai-jakdang/contracts";
import { eq, and, isNull, desc } from "drizzle-orm";

const pinnedNoticeQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(5).default(1),
});

/** 단일 공지 응답 또는 null */
const pinnedNoticeResponseSchema = noticeBannerSchema.nullable();

export async function registerNoticesRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/notices/pinned",
    {
      schema: {
        description:
          "핀된 공지 최신 1건. board=notice + is_pinned=true + status=published. 없으면 null. 비회원 공개.",
        tags: ["notices"],
        querystring: pinnedNoticeQuerySchema,
        response: {
          200: pinnedNoticeResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { limit } = request.query;

      const db = getDb();

      const rows = await db
        .select({
          id: schema.posts.id,
          title: schema.posts.title,
          slug: schema.posts.slug,
          summary: schema.posts.summary,
        })
        .from(schema.posts)
        .where(
          and(
            eq(schema.posts.board, "notice"),
            eq(schema.posts.isPinned, true),
            eq(schema.posts.status, "published"),
            isNull(schema.posts.deletedAt),
          ),
        )
        .orderBy(desc(schema.posts.createdAt))
        .limit(limit);

      if (rows.length === 0) {
        return reply.code(200).send(null);
      }

      const row = rows[0];
      const notice = {
        id: row.id,
        title: row.title,
        slug: row.slug,
        content: row.summary ?? null,
        url: `/notice/${row.slug}`,
      };

      return reply.code(200).send(notice);
    },
  );
}
