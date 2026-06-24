/**
 * /api/v1/tags 라우트 — Story 2.7 (AC #7) + Story 8.4 (AC #1)
 *
 * GET /api/v1/tags?q={query}
 *   태그 자동완성. 비회원 포함 공개.
 *   - q 파라미터 기반 LIKE '%q%' 검색 (pg_bigm 활성 시 bigm_similarity 로 전환 가능)
 *   - LIMIT 5
 *   응답: { items: { id, name, slug }[] }
 *
 * GET /api/v1/tags/autocomplete?q=&limit=10
 *   태그 자동완성 (Story 8.4). 2자 이상 입력 시 이름 전방 일치(ILIKE name%) 검색.
 *   - q 2자 미만이면 빈 배열 즉시 반환
 *   - taggable COUNT 내림차순 정렬
 *   응답: { items: { id, name, usageCount }[] }
 */

import { errorResponseSchema } from "@ai-jakdang/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getDb, schema } from "@ai-jakdang/database";
import { like, asc, sql } from "drizzle-orm";
import { slugify } from "@ai-jakdang/utilities";
import { requireAuthHook } from "../../../plugins/require-auth.js";

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

// ── Story 8.4: POST /tags 스키마 ─────────────────────────────────────────────

/** POST /api/v1/tags 요청 바디 */
const createTagBodySchema = z.object({
  name: z.string().trim().min(1).max(30),
});

/** POST /api/v1/tags 응답 스키마 */
const createTagResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.string(),
});

// ── Story 8.4: autocomplete 스키마 ──────────────────────────────────────────

/** GET /api/v1/tags/autocomplete 쿼리 스키마 */
const tagAutocompleteQuerySchema = z.object({
  q: z.string().trim().default(""),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

/** autocomplete 응답 아이템 스키마 */
const tagAutocompleteItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  usageCount: z.number().int(),
});

/** autocomplete 응답 스키마 */
const tagAutocompleteResponseSchema = z.object({
  items: z.array(tagAutocompleteItemSchema),
});

export async function tagsRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /tags/autocomplete — 태그 자동완성 (Story 8.4) ───────────────────────
  // 주의: 경로 순서 — /autocomplete 를 /tags 보다 먼저 등록해야
  //       Fastify가 정적 세그먼트를 우선 매칭한다.
  typed.get(
    "/tags/autocomplete",
    {
      schema: {
        description:
          "태그 자동완성. q가 2자 이상일 때 name ILIKE $q% 전방 일치 검색. usageCount 내림차순. 최대 limit개 반환.",
        tags: ["tags"],
        querystring: tagAutocompleteQuerySchema,
        response: {
          200: tagAutocompleteResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { q, limit } = request.query;

      // q가 2자 미만이면 빈 배열 즉시 반환
      if (q.trim().length < 2) {
        return reply.code(200).send({ items: [] });
      }

      const db = getDb();

      // taggable COUNT를 서브쿼리로 계산 (tags 테이블에 usage_count 컬럼 없음)
      const rows = await db.execute<{ id: string; name: string; usage_count: string }>(
        sql`
          SELECT
            t.id::text AS id,
            t.name AS name,
            COUNT(tb.tag_id)::integer AS usage_count
          FROM tags t
          LEFT JOIN taggable tb ON tb.tag_id = t.id
          WHERE t.name ILIKE ${q.trim() + "%"}
          GROUP BY t.id, t.name
          ORDER BY usage_count DESC, t.name ASC
          LIMIT ${limit}
        `,
      );

      return reply.code(200).send({
        items: rows.rows.map((row) => ({
          id: row.id,
          name: row.name,
          usageCount: parseInt(String(row.usage_count), 10),
        })),
      });
    },
  );

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

  // ── POST /tags — 신규 태그 생성 (Story 8.4 AC #5) ────────────────────────────
  // 인증된 사용자만 신규 태그 생성 가능. 중복 시 기존 태그 반환 (upsert 패턴).
  typed.post(
    "/tags",
    {
      preHandler: [requireAuthHook],
      schema: {
        description:
          "신규 태그 생성. 이미 존재하면 기존 태그를 반환(201 → 200). 인증 필요.",
        tags: ["tags"],
        body: createTagBodySchema,
        response: {
          200: createTagResponseSchema,
          201: createTagResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { name } = request.body;
      const db = getDb();

      // 기존 태그 조회 (대소문자 무관)
      const existing = await db
        .select({
          id: schema.tags.id,
          name: schema.tags.name,
          slug: schema.tags.slug,
          createdAt: schema.tags.createdAt,
        })
        .from(schema.tags)
        .where(sql`LOWER(${schema.tags.name}) = LOWER(${name.trim()})`)
        .limit(1);

      if (existing.length > 0) {
        const tag = existing[0]!;
        return reply.code(200).send({
          id: tag.id,
          name: tag.name,
          slug: tag.slug,
          createdAt: tag.createdAt.toISOString(),
        });
      }

      // 신규 태그 생성
      const tagSlug = slugify(name.trim()) || name.trim().toLowerCase().replace(/\s+/g, "-");

      const [newTag] = await db
        .insert(schema.tags)
        .values({
          name: name.trim(),
          slug: tagSlug,
        })
        .returning({
          id: schema.tags.id,
          name: schema.tags.name,
          slug: schema.tags.slug,
          createdAt: schema.tags.createdAt,
        });

      if (!newTag) {
        throw new Error("태그 생성에 실패했습니다.");
      }

      return reply.code(201).send({
        id: newTag.id,
        name: newTag.name,
        slug: newTag.slug,
        createdAt: newTag.createdAt.toISOString(),
      });
    },
  );
}
