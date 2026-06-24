/**
 * GET /api/v1/resources/popular — 홈 페이지 실전자료 인기 목록 (Story 8.5)
 *
 * 쿼리 파라미터:
 *   limit : 1~20 (기본 4)
 *
 * 응답: { items: ResourceItem[] }
 *
 * Redis 캐시: 키 = MAIN_RESOURCES_POPULAR, TTL 3600s (AR-17).
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getDb, schema } from "@ai-jakdang/database";
import { popularResourcesResponseSchema } from "@ai-jakdang/contracts/home";
import { errorResponseSchema } from "@ai-jakdang/contracts";
import { eq, and, isNull, desc } from "drizzle-orm";
import { getApiRedis } from "../../../lib/redis.js";
import { MAIN_RESOURCES_POPULAR } from "../../../lib/cache.js";

/** resourceType → 배지 tone 매핑 */
const RESOURCE_TYPE_TONE: Record<string, string> = {
  prompt: "primary",
  "claude-code-skill": "primary",
  mcp: "success",
  "rules-config": "info",
  "template-checklist": "warning",
};

/** resourceType → 사람이 읽을 수 있는 meta 라벨 */
const RESOURCE_TYPE_LABEL: Record<string, string> = {
  prompt: "프롬프트",
  "claude-code-skill": "Claude Code Skill",
  mcp: "MCP·Skills",
  "rules-config": "Rules·설정",
  "template-checklist": "템플릿·체크리스트",
};

const popularResourcesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(4),
});

export async function registerPopularResourcesRoute(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/resources/popular",
    {
      schema: {
        description:
          "홈 페이지 실전자료 인기 목록. download_count DESC. Redis TTL 1h. 비회원 공개.",
        tags: ["resources"],
        querystring: popularResourcesQuerySchema,
        response: {
          200: popularResourcesResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { limit } = request.query;

      // ── Redis 캐시 hit 확인 ──────────────────────────────────────────────────
      const redis = getApiRedis();
      try {
        const cached = await redis.get(MAIN_RESOURCES_POPULAR);
        if (cached) {
          return reply.code(200).send(JSON.parse(cached));
        }
      } catch {
        // Redis 오류는 무시하고 DB 직접 조회
      }

      // ── DB 조회 ──────────────────────────────────────────────────────────────
      const db = getDb();

      const rows = await db
        .select({
          id: schema.resources.id,
          slug: schema.resources.slug,
          title: schema.resources.title,
          description: schema.resources.summary,
          downloadCount: schema.resources.downloadCount,
          avgRating: schema.resources.avgRating,
          resourceType: schema.resources.resourceType,
        })
        .from(schema.resources)
        .where(
          and(
            eq(schema.resources.status, "published"),
            isNull(schema.resources.deletedAt),
          ),
        )
        .orderBy(desc(schema.resources.downloadCount))
        .limit(limit);

      const items = rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        description: r.description ?? null,
        downloadCount: r.downloadCount,
        avgRating: r.avgRating ? parseFloat(String(r.avgRating)) : null,
        meta: RESOURCE_TYPE_LABEL[r.resourceType] ?? r.resourceType,
        tone: RESOURCE_TYPE_TONE[r.resourceType] ?? "primary",
      }));

      const result = { items };

      // ── Redis 캐시 저장 (TTL 3600s) ──────────────────────────────────────────
      try {
        await redis.setex(MAIN_RESOURCES_POPULAR, 3600, JSON.stringify(result));
      } catch {
        // 캐시 저장 실패는 무시
      }

      return reply.code(200).send(result);
    },
  );
}
