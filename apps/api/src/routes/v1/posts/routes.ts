/**
 * /api/v1/posts 라우트 — Story 2.3
 *
 * GET /api/v1/posts
 *   게시판 게시글 목록. 비회원 포함 공개.
 *   쿼리 파라미터: board(필수), sort, page, pageSize
 *   응답: { items: PostCard[], meta: { page, pageSize, totalItems, totalPages } }
 *
 * commentCount · likeCount 는 Epic 5 활성화 전까지 0 고정.
 */

import { isValidBoard, paginatedPostsSchema, errorResponseSchema } from "@ai-jakdang/contracts";
import { paginationQuerySchema } from "@ai-jakdang/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getPosts, type SortOption } from "./service.js";

/** 허용되는 정렬 옵션 */
const sortEnum = z.enum(["latest", "popular", "most-comments"]).default("latest");

/** GET /api/v1/posts 쿼리 스키마 */
const postsQuerySchema = paginationQuerySchema.extend({
  board: z.string().trim().min(1).max(50),
  sort: sortEnum,
});

export async function postsRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /posts — 게시판 게시글 목록 (비회원 공개) ────────────────────────────
  typed.get(
    "/posts",
    {
      schema: {
        description: "게시판 게시글 목록. board 슬러그 필수. 비회원도 열람 가능.",
        tags: ["posts"],
        querystring: postsQuerySchema,
        response: {
          200: paginatedPostsSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { board, sort, page, pageSize } = request.query;

      // board 슬러그 유효성 검사 (BOARDS 상수 기준)
      if (!isValidBoard(board)) {
        return reply.code(404).send({
          error: {
            code: "BOARD_NOT_FOUND",
            message: "존재하지 않는 게시판입니다.",
          },
        });
      }

      const result = await getPosts({
        board,
        sort: sort as SortOption,
        page,
        pageSize,
      });

      return reply.code(200).send(result);
    },
  );
}
