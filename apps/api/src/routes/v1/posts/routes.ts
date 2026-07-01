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
  updatePostSchema,
  creativeSpecSchema,
  recruitPostSchema,
} from "@ai-jakdang/contracts";
import { paginationQuerySchema } from "@ai-jakdang/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { requireAuthHook, checkSuspendedHook } from "../../../plugins/require-auth.js";
import { contentGuard } from "../../../middleware/contentGuard.js";
import { getPosts, createPost, getDraft, getPostBySlug, updatePost, deletePost, pinPost, toggleRecruitStatus, ForbiddenError, PostNotFoundError, type SortOption } from "./service.js";
import { uploadPostAttachments, AttachmentValidationError, type UploadedAttachmentData } from "./attachments.service.js";
import { resolveLocalFilePath, getPublicBaseUrl } from "../../../services/storage/index.js";
import { userAuth } from "../../../auth/user-auth.js";
import { adminAuth } from "../../../auth/admin-auth.js";
import { registerPopularPostsRoute } from "./popular.route.js"; // Story 8.5

/** 세션 user 타입 헬퍼 */
type RequestWithUser = { user?: { id: string } };

/** 허용되는 정렬 옵션 */
const sortEnum = z.enum(["latest", "popular", "most-comments"]).default("latest");

/** GET /api/v1/posts 쿼리 스키마 */
const postsQuerySchema = paginationQuerySchema.extend({
  board: z.string().trim().min(1).max(50),
  sort: sortEnum,
  /** Story 2.12: gigs 필터 파라미터 */
  postKind: z.enum(["request", "offer"]).optional(),
  fields: z.string().optional(),
  recruitStatus: z.enum(["open", "closed"]).optional(),
});

export async function postsRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /posts/popular — 홈 페이지 인기글 (Story 8.5, 비회원 공개) ────────────
  // NOTE: /posts/popular 는 /posts/:slug 보다 먼저 등록해야 정적 경로가 우선 매칭된다.
  await registerPopularPostsRoute(app);

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

      const { postKind, fields, recruitStatus } = request.query;
      const result = await getPosts({
        board,
        sort: sort as SortOption,
        page,
        pageSize,
        postKind,
        fields,
        recruitStatus,
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
    /** Story 2.11: AI 창작마당 창작 스펙 (board='ai-creation'에서만 유효, 선택) */
    creativeSpec: creativeSpecSchema.optional(),
    /** Story 2.12: 작당 의뢰소 구인·외주 스펙 (board='gigs'에서만 유효, 선택) */
    recruitPost: recruitPostSchema.optional(),
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
      preHandler: [requireAuthHook, checkSuspendedHook, contentGuard],
      schema: {
        description:
          "게시글 작성 또는 임시저장. 인증 필수. status='draft' → 임시저장, 기본='published'. notice 게시판은 관리자 세션(aj_admin_session 쿠키) 필수.",
        tags: ["posts"],
        body: createPostBodySchema,
        response: {
          201: createPostResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
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

      // notice 게시판 = 관리자 전용 (FR-15.1, FR-10.7, Story 2.9, Story 9.17)
      // adminAuth.api.getSession 으로 aj_admin_session 쿠키를 실제 검증한다.
      if (body.board === "notice") {
        let isValidAdmin = false;
        try {
          const adminSession = await adminAuth.api.getSession({
            headers: request.headers as unknown as Headers,
          });
          const adminUser = adminSession?.user as ({ status?: string } | undefined);
          isValidAdmin = !!adminUser && adminUser.status === "active";
        } catch {
          isValidAdmin = false;
        }
        if (!isValidAdmin) {
          return reply.code(403).send({
            error: {
              code: "FORBIDDEN",
              message: "공지 게시판은 운영자만 작성 가능합니다.",
            },
          });
        }
      }

      const result = await createPost({
        input: {
          ...body,
          creativeSpec: body.creativeSpec,
          recruitPost: body.recruitPost,
        },
        userId: sessionUser.id,
      });

      return reply.code(201).send(result);
    },
  );

  // ── POST /posts/attachments — 게시글 첨부파일 업로드 (인증 필수) ──────────────
  /**
   * multipart/form-data 로 파일들을 받아 공개 버킷에 업로드하고 메타데이터를 반환한다.
   * 글쓰기 폼이 게시글 작성 직전에 호출 → 반환된 attachments 를 createPost 본문에 포함한다.
   * 허용 확장자: 관리자 설정(file_allowed_extensions). 파일당 10MB·최대 5개.
   */
  const ATTACHMENT_MAX_FILES = 5;
  const ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

  app.post(
    "/posts/attachments",
    { preHandler: [requireAuthHook] },
    async (request, reply) => {
      const sessionUser = (request as typeof request & RequestWithUser).user;
      if (!sessionUser?.id) {
        return reply.code(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }

      const collected: UploadedAttachmentData[] = [];

      try {
        const parts = request.files({
          limits: { fileSize: ATTACHMENT_MAX_SIZE, files: ATTACHMENT_MAX_FILES },
        });

        for await (const part of parts) {
          const chunks: Buffer[] = [];
          let totalSize = 0;
          let truncated = false;

          for await (const chunk of part.file) {
            totalSize += chunk.length;
            if (totalSize > ATTACHMENT_MAX_SIZE) {
              truncated = true;
              part.file.resume();
              break;
            }
            chunks.push(chunk as Buffer);
          }

          if (truncated) {
            return reply.code(400).send({
              error: {
                code: "FILE_TOO_LARGE",
                message: `파일 크기 초과: ${part.filename ?? "unknown"} (최대 10MB)`,
              },
            });
          }

          collected.push({
            originalName: part.filename ?? "unknown",
            mimetype: part.mimetype,
            buffer: Buffer.concat(chunks),
            size: totalSize,
          });

          if (collected.length > ATTACHMENT_MAX_FILES) {
            return reply.code(400).send({
              error: {
                code: "TOO_MANY_FILES",
                message: `첨부파일은 최대 ${ATTACHMENT_MAX_FILES}개까지 가능합니다.`,
              },
            });
          }
        }
      } catch (err) {
        const error = err as Error;
        if (error.message?.includes("limit") || error.message?.includes("files")) {
          return reply.code(400).send({
            error: {
              code: "TOO_MANY_FILES",
              message: `첨부파일은 최대 ${ATTACHMENT_MAX_FILES}개까지 가능합니다.`,
            },
          });
        }
        throw err;
      }

      if (collected.length === 0) {
        return reply.code(400).send({
          error: { code: "NO_FILES", message: "업로드할 파일이 없습니다." },
        });
      }

      try {
        const files = await uploadPostAttachments(collected);
        return reply.code(201).send({ files });
      } catch (err) {
        if (err instanceof AttachmentValidationError) {
          return reply.code(400).send({
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
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

  // ── PATCH /posts/:id — 게시글 수정 (인증 필수, 작성자만) ─────────────────────
  const patchPostParamsSchema = z.object({ id: z.string().uuid() });

  const patchPostResponseSchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    board: z.string(),
    category: z.string().nullable(),
  });

  typed.patch(
    "/posts/:id",
    {
      preHandler: [requireAuthHook, checkSuspendedHook],
      schema: {
        description: "게시글 수정. 인증 필수. 작성자만 수정 가능. slug 는 변경되지 않는다 (NFR-8).",
        tags: ["posts"],
        params: patchPostParamsSchema,
        body: updatePostSchema,
        response: {
          200: patchPostResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
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
      const body = request.body;

      try {
        const result = await updatePost({
          postId: id,
          userId: sessionUser.id,
          input: body,
        });
        return reply.code(200).send(result);
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return reply.code(403).send({
            error: { code: "FORBIDDEN", message: "수정 권한이 없습니다." },
          });
        }
        if (err instanceof PostNotFoundError) {
          return reply.code(404).send({
            error: { code: "POST_NOT_FOUND", message: "게시글을 찾을 수 없습니다." },
          });
        }
        throw err;
      }
    },
  );

  // ── DELETE /posts/:id — 게시글 삭제 (soft-delete, 인증 필수, 작성자만) ────────
  const deletePostParamsSchema = z.object({ id: z.string().uuid() });

  const deletePostResponseSchema = z.object({
    success: z.literal(true),
  });

  typed.delete(
    "/posts/:id",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "게시글 soft-delete. 인증 필수. 작성자만 삭제 가능. status=deleted + deleted_at=NOW().",
        tags: ["posts"],
        params: deletePostParamsSchema,
        response: {
          200: deletePostResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
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

      try {
        await deletePost({ postId: id, userId: sessionUser.id });
        return reply.code(200).send({ success: true });
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return reply.code(403).send({
            error: { code: "FORBIDDEN", message: "삭제 권한이 없습니다." },
          });
        }
        if (err instanceof PostNotFoundError) {
          return reply.code(404).send({
            error: { code: "POST_NOT_FOUND", message: "게시글을 찾을 수 없습니다." },
          });
        }
        throw err;
      }
    },
  );

  // ── PATCH /posts/:id/pin — 공지 핀 고정 토글 (관리자 전용, Story 2.9) ────────
  const pinPostParamsSchema = z.object({ id: z.string().uuid() });
  const pinPostResponseSchema = z.object({ id: z.string().uuid(), isPinned: z.boolean() });

  typed.patch(
    "/posts/:id/pin",
    {
      schema: {
        description: "공지 핀 고정 토글. 관리자 세션(aj_admin_session 쿠키) 필수.",
        tags: ["posts"],
        params: pinPostParamsSchema,
        response: {
          200: pinPostResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const cookieHeader = request.headers.cookie ?? "";
      const hasAdminSession = cookieHeader.includes("aj_admin_session=");
      if (!hasAdminSession) {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "공지 핀 설정은 운영자만 가능합니다." },
        });
      }

      const { id } = request.params;
      try {
        const result = await pinPost({ postId: id });
        return reply.code(200).send(result);
      } catch (err) {
        if (err instanceof PostNotFoundError) {
          return reply.code(404).send({
            error: { code: "POST_NOT_FOUND", message: "게시글을 찾을 수 없습니다." },
          });
        }
        throw err;
      }
    },
  );

  // ── PATCH /posts/:id/recruit-status — 모집상태 토글 (인증 필수, 작성자만, Story 2.12) ──
  const recruitStatusParamsSchema = z.object({ id: z.string().uuid() });
  const recruitStatusBodySchema = z.object({
    recruitStatus: z.enum(["open", "closed"]),
  });
  const recruitStatusResponseSchema = z.object({
    recruitStatus: z.enum(["open", "closed"]),
  });

  typed.patch(
    "/posts/:id/recruit-status",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "구인·외주 글 모집상태 토글. 인증 필수. 작성자만 변경 가능.",
        tags: ["posts"],
        params: recruitStatusParamsSchema,
        body: recruitStatusBodySchema,
        response: {
          200: recruitStatusResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
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
      const { recruitStatus } = request.body;

      try {
        const result = await toggleRecruitStatus({
          postId: id,
          userId: sessionUser.id,
          recruitStatus,
        });
        return reply.code(200).send(result);
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return reply.code(403).send({
            error: { code: "FORBIDDEN", message: "모집상태 변경 권한이 없습니다." },
          });
        }
        if (err instanceof PostNotFoundError) {
          return reply.code(404).send({
            error: { code: "POST_NOT_FOUND", message: "게시글을 찾을 수 없습니다." },
          });
        }
        throw err;
      }
    },
  );

  // ── GET /posts/attachments/download — 첨부파일 강제 다운로드 프록시 ───────────
  // NOTE: 정적 경로(/posts/attachments/download)가 동적 경로(/posts/:slug)보다 먼저 등록되어야 한다.
  // 브라우저가 파일을 인라인으로 열지 않도록 Content-Disposition: attachment 헤더를 서버에서 붙여 반환.
  // SSRF 방지: 허용된 스토리지 출처(공개 S3 버킷 or 로컬 /uploads/)만 프록시한다.
  app.get("/posts/attachments/download", async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const fileUrl = query.url;
    const fileName = query.name;

    if (!fileUrl || !fileName) {
      return reply.code(400).send({
        error: { code: "BAD_REQUEST", message: "url과 name 파라미터가 필요합니다." },
      });
    }

    // SSRF 방지: 로컬 /uploads/ 경로 또는 우리 S3 공개 버킷 URL만 허용
    const isLocalUrl = fileUrl.startsWith("/uploads/");
    const s3Base = getPublicBaseUrl();
    const isS3Url = !isLocalUrl && s3Base.length > 0 && fileUrl.startsWith(s3Base);

    if (!isLocalUrl && !isS3Url) {
      return reply.code(400).send({
        error: { code: "INVALID_URL", message: "허용되지 않는 파일 URL입니다." },
      });
    }

    // 파일명 정제 (슬래시·백슬래시 제거) 및 RFC 5987 인코딩
    const safeFileName = fileName.replace(/[/\\]/g, "_");
    const encodedFileName = encodeURIComponent(safeFileName);

    void reply.header(
      "Content-Disposition",
      `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`,
    );
    void reply.header("Content-Type", "application/octet-stream");
    void reply.header("Cache-Control", "private, no-cache");

    if (isLocalUrl) {
      // 로컬 파일시스템에서 읽어 반환
      const filePath = resolveLocalFilePath(fileUrl);
      if (!filePath || !existsSync(filePath)) {
        return reply.code(404).send({
          error: { code: "FILE_NOT_FOUND", message: "파일을 찾을 수 없습니다." },
        });
      }
      const data = await readFile(filePath);
      return reply.send(data);
    } else {
      // S3/R2 에서 fetch 후 버퍼링하여 반환 (최대 10MB 첨부 제한 내에서 안전)
      let upstream: Response;
      try {
        upstream = await fetch(fileUrl);
      } catch {
        return reply.code(502).send({
          error: { code: "UPSTREAM_ERROR", message: "파일을 가져올 수 없습니다." },
        });
      }
      if (!upstream.ok) {
        return reply.code(502).send({
          error: { code: "UPSTREAM_ERROR", message: `스토리지 응답 오류: ${upstream.status}` },
        });
      }
      const buffer = Buffer.from(await upstream.arrayBuffer());
      return reply.send(buffer);
    }
  });

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
