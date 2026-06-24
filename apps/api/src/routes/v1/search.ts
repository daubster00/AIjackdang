/**
 * GET /api/v1/search — 통합 검색 (Story 8.1)
 *
 * AR-5: pg_bigm bigm_similarity 기반 전문 검색.
 * AR-13: REST 계약 — /api/v1/search, 오류 {error:{code,message}}.
 *
 * 비회원 포함 공개 엔드포인트.
 * q 파라미터는 1~200자. 위반 시 422 VALIDATION_ERROR.
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { searchQuerySchema, searchResponseSchema, errorResponseSchema } from "@ai-jakdang/contracts";
import { search } from "../../services/searchService.js";

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── GET / — 통합 검색 ─────────────────────────────────────────────────────
  typed.get(
    "/",
    {
      schema: {
        description:
          "통합 검색. posts·questions·resources 를 pg_bigm 유사도로 검색. " +
          "type=all(기본) 시 3개 테이블 UNION ALL 후 정규화 재정렬. " +
          "결과 0건 & type=all 시 suggestedTags(인기 태그 최대 5개) 포함.",
        tags: ["search"],
        querystring: searchQuerySchema,
        response: {
          200: searchResponseSchema,
          422: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { q, type, page, pageSize } = request.query;

      const result = await search({ q, type, page, pageSize });

      return reply.code(200).send(result);
    },
  );
}
