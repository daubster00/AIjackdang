/**
 * /api/v1/tags 라우트 — Story 2.7 (AC #7)
 *
 * GET /api/v1/tags?q={query}
 *   태그 자동완성. 비회원 포함 공개.
 *   - q 파라미터 기반 LIKE '%q%' 검색 (pg_bigm 활성 시 bigm_similarity 로 전환 가능)
 *   - LIMIT 5
 *   응답: { items: { id, name, slug }[] }
 */

import { errorResponseSchema } from "@ai-jakdang/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getDb, schema } from "@ai-jakdang/database";
import { like, asc } from "drizzle-orm";

/** GET /api/v1/tags 쿼리 스키마 */
const tagsQuerySchema = z.object({
  q: z.string().trim().min(1).max(50),
});

/** 태그 아이템 스키마 */
const tagItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
});

/** 태그 목록 응답 스키마 */
const tagsResponseSchema = z.object({
  items: z.array(tagItemSchema),
});

export async function tagsRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /tags?q= — 태그 자동완성 (비회원 공개) ───────────────────────────────
  typed.get(
    "/tags",
    {
      schema: {
        description:
          "태그 자동완성. q 파라미터로 이름 유사도 검색. 최대 5개 반환. 비회원도 사용 가능.",
        tags: ["tags"],
        querystring: tagsQuerySchema,
        response: {
          200: tagsResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { q } = request.query;
      const db = getDb();

      const rows = await db
        .select({
          id: schema.tags.id,
          name: schema.tags.name,
          slug: schema.tags.slug,
        })
        .from(schema.tags)
        .where(like(schema.tags.name, `%${q}%`))
        .orderBy(asc(schema.tags.name))
        .limit(5);

      return reply.code(200).send({ items: rows });
    },
  );
}
