/**
 * 태그 콘텐츠 & 인기 태그 라우트 — Story 8.3
 *
 * GET /api/v1/tags/:tag/content  — 태그별 통합 콘텐츠 조회
 * GET /api/v1/tags/popular        — 인기 태그 목록 (사이드바용)
 *
 * 주의: 이 라우트는 기존 tagsRoutes(GET /tags?q=) 와 prefix 충돌을 피하기 위해
 * v1/index.ts에서 별도 등록한다.
 *   await tagContentRoutes(app)
 * (prefix는 v1Routes 레벨에서 /api/v1 이 이미 붙어있으므로 내부 경로로만 정의)
 */

import {
  tagPageQuerySchema,
  tagContentResponseSchema,
  popularTagsResponseSchema,
} from "@ai-jakdang/contracts/tag";
import { errorResponseSchema } from "@ai-jakdang/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getTagContent, getPopularTags } from "../../services/tagService.js";

export async function tagContentRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /tags/popular — 인기 태그 목록 ────────────────────────────────────────
  // 주의: Express/Fastify 라우트 매칭 순서 — /popular 를 /:tag/content 보다 먼저 등록해야
  //       "popular"가 :tag 파라미터로 캡처되지 않는다.
  typed.get(
    "/tags/popular",
    {
      schema: {
        description: "인기 태그 목록. usage_count 내림차순 정렬. 사이드바 관련 태그 표시용.",
        tags: ["tags"],
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(50).default(20),
        }),
        response: {
          200: popularTagsResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { limit } = request.query;
      const result = await getPopularTags(limit);
      return reply.code(200).send(result);
    },
  );

  // ── GET /tags/:tag/content — 태그별 통합 콘텐츠 조회 ─────────────────────────
  typed.get(
    "/tags/:tag/content",
    {
      schema: {
        description:
          "태그별 게시글·질문·자료 통합 조회. type 필터 + sort 정렬 + 오프셋 페이지네이션.",
        tags: ["tags"],
        params: z.object({
          tag: z.string().min(1).max(100),
        }),
        querystring: tagPageQuerySchema,
        response: {
          200: tagContentResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { tag } = request.params;
      const { type, sort, page, pageSize } = request.query;

      // URL 인코딩 디코딩 (한글 태그 처리)
      const decodedTag = decodeURIComponent(tag);

      const result = await getTagContent({
        tagName: decodedTag,
        type,
        sort,
        page,
        pageSize,
      });

      if (result === null) {
        return reply.code(404).send({
          error: {
            code: "TAG_NOT_FOUND",
            message: "태그를 찾을 수 없습니다.",
          },
        });
      }

      return reply.code(200).send(result);
    },
  );
}
