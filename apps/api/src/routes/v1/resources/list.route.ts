/**
 * GET /api/v1/resources — 실전자료 목록 라우트 (Story 4.2)
 *
 * 비회원 포함 공개. listResourcesQuerySchema 쿼리 파라미터로 필터·정렬·페이지네이션.
 * 응답: paginatedResponseSchema(resourceCardSchema)
 */

import {
  listResourcesQuerySchema,
  resourceCardSchema,
  paginatedResponseSchema,
  errorResponseSchema,
} from "@ai-jakdang/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { listResources } from "./list.service.js";

export async function registerResourceListRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /resources — 실전자료 목록 (비회원 공개) ──────────────────────────────
  typed.get(
    "/resources",
    {
      schema: {
        description:
          "실전자료 목록. 유형(type)/환경(environment)/난이도(difficulty)/정렬(sort)/검색(q) 필터. 비회원도 열람 가능.",
        tags: ["resources"],
        querystring: listResourcesQuerySchema,
        response: {
          200: paginatedResponseSchema(resourceCardSchema),
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await listResources(request.query);
      return reply.code(200).send(result);
    },
  );
}
