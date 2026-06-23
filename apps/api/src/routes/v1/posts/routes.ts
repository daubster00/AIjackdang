/**
 * /api/v1/posts 라우트 — Story 2.3 (GET 목록) + Story 2.7 (POST 작성/임시저장)
 *
 * GET /api/v1/posts
 *   게시판 게시글 목록. 비회원 포함 공개.
 *   쿼리 파라미터: board(필수), sort, page, pageSize
 *   응답: { items: PostCard[], meta: { page, pageSize, totalItems, totalPages } }
 *
 * POST /api/v1/posts
 *   게시글 작성 또는 임시저장(draft). 인증 필수.
 *   요청: { board, title, contentJson, tags[], status?, category?, summary? }
 *   응답 201: { id, slug, board, category, status }
 *
 * GET /api/v1/posts/drafts/:id
 *   본인 임시저장 단건 조회. 인증 필수.
 *   응답 200: { id, title, contentJson, summary, tags, board, category, status }
 *
 * commentCount · likeCount 는 Epic 5 활성화 전까지 0 고정.
 */

import {
  isValidBoard,
  paginatedPostsSchema,
  errorResponseSchema,
  createPostSchema,
  postDetailSchema,
} from "@ai-jakdang/contracts";
import { paginationQuerySchema } from "@ai-jakdang/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireAuthHook } from "../../../plugins/require-auth.js";
import { getPosts, createPost, getDraft, getPostBySlug, type SortOption } from "./service.js";
import { userAuth } from "../../../auth/user-auth.js";

/** 세션 user 타입 헬퍼 */
type RequestWithUser = { user?: { id: string } };

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

  // ── POST /posts — 게시글 작성 / 임시저장 (인증 필수) ──────────────────────────
  /**
   * `createPostSchema` (contracts) 에 `status` 를 추가 확장한다.
   * contracts 의 createPostSchema 는 status 필드가 없으므로 API 레이어에서 extend.
   */
  const createPostBodySchema = createPostSchema.extend({
    status: z.enum(["draft", "published"]).default("published"),
  });

  /** 201 응답 스키마 */
  const createPostResponseSchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    board: z.string(),
    category: z.string().nullable(),
    status: z.enum(["draft", "published"]),
  });

  typed.post(
    "/posts",
    {
      preHandler: [requireAuthHook],
      schema: {
        description:
          "게시글 작성 또는 임시저장. 인증 필수. status='draft' → 임시저장, 기본='published'.",
        tags: ["posts"],
        body: createPostBodySchema,
        response: {
          201: createPostResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const sessionUser = (request as typeof request & RequestWithUser).user;
      if (!sessionUser?.id) {
        return reply.code(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }

      const body = request.body;

      // board 유효성 검사
      if (!isValidBoard(body.board)) {
        return reply.code(400).send({
          error: {
            code: "BOARD_NOT_FOUND",
            message: "존재하지 않는 게시판입니다.",
          },
        });
      }

      const result = await createPost({
        input: body,
        userId: sessionUser.id,
      });

      return reply.code(201).send(result);
    },
  );

  // ── GET /posts/drafts/:id — 본인 임시저장 단건 조회 (인증 필수) ────────────────
  const draftParamsSchema = z.object({ id: z.string().uuid() });

  const draftResponseSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    contentJson: z.record(z.string(), z.unknown()),
    summary: z.string().nullable(),
    tags: z.array(z.string()),
    board: z.string(),
    category: z.string().nullable(),
    status: z.string(),
  });

  typed.get(
    "/posts/drafts/:id",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "본인의 임시저장(draft) 게시글 단건 조회. 인증 필수.",
        tags: ["posts"],
        params: draftParamsSchema,
        response: {
          200: draftResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const sessionUser = (request as typeof request & RequestWithUser).user;
      if (!sessionUser?.id) {
        return reply.code(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }

      const { id } = request.params;

      const draft = await getDraft({ postId: id, userId: sessionUser.id });

      if (!draft) {
        return reply.code(404).send({
          error: { code: "DRAFT_NOT_FOUND", message: "임시저장 게시글을 찾을 수 없습니다." },
        });
      }

      return reply.code(200).send(draft);
    },
  );

  // ── GET /posts/:slug — 게시글 상세 (비회원 공개) ─────────────────────────────
  // NOTE: /posts/drafts/:id 보다 반드시 나중에 등록해야 Fastify가 정확한 경로를 매칭한다.
  const slugParamsSchema = z.object({ slug: z.string() });

  typed.get(
    "/posts/:slug",
    {
      schema: {
        description:
          "게시글 slug로 상세 조회. 비회원 포함 공개. published 게시글만 노출 (본인 draft 제외).",
        tags: ["posts"],
        params: slugParamsSchema,
        response: {
          200: postDetailSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params;

      // 선택적 인증 — 실패해도 비회원으로 처리 (401 미반환)
      let currentUserId: string | undefined;
      try {
        const session = await userAuth.api.getSession({
          headers: request.headers as unknown as Headers,
        });
        currentUserId = session?.user?.id;
      } catch { /* 비회원 */ }

      const result = await getPostBySlug(slug, currentUserId);

      if (!result) {
        return reply.code(404).send({
          error: { code: "POST_NOT_FOUND", message: "게시글을 찾을 수 없습니다." },
        });
      }

      return reply.code(200).send(result);
    },
  );
}
