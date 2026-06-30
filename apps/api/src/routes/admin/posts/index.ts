/**
 * 게시글 관리 API 등록 진입점 (Story 9.6 + 9.17).
 *
 * POST   /api/v1/admin/posts                — 공지 작성 (Story 9.17, admin 전용)
 * GET    /api/v1/admin/posts                — 목록 조회
 * GET    /api/v1/admin/posts/:id            — 상세 조회
 * PATCH  /api/v1/admin/posts/:id/flags      — 플래그 토글
 * PATCH  /api/v1/admin/posts/:id/hide       — 숨김
 * PATCH  /api/v1/admin/posts/:id/restore    — 복구
 * PATCH  /api/v1/admin/posts/:id            — 내용 수정 (Story 9.17)
 * DELETE /api/v1/admin/posts/:id            — 소프트 삭제 (super_admin)
 * PATCH  /api/v1/admin/posts/:id/seo        — SEO 메타
 * POST   /api/v1/admin/posts/bulk           — 벌크 액션
 */

import type { FastifyInstance } from "fastify";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
import {
  adminPostsQuerySchema,
  adminPostsFlagsSchema,
  adminPostsSeoSchema,
  adminPostsBulkSchema,
} from "@ai-jakdang/contracts";
import {
  createAdminPost,
  getPostDetail,
  listPosts,
  updatePostContent,
  updatePostFlags,
  hidePost,
  restorePost,
  deletePost,
  updatePostSeo,
  bulkPostAction,
} from "./service.js";
import {
  uploadPostAttachments,
  AttachmentValidationError,
  type UploadedAttachmentData,
} from "../../v1/posts/attachments.service.js";

export async function registerAdminPostsRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /api/v1/admin/posts/attachments — 관리자 게시글 첨부 업로드 ───────────
  // 유저용 POST /posts/attachments 와 동일 로직(공개 버킷 업로드·확장자 검증)이나
  // 관리자 세션(adminGuardHook)으로만 접근. 반환된 files 를 POST /admin/posts 본문에 포함.
  const ADMIN_ATTACH_MAX_FILES = 5;
  const ADMIN_ATTACH_MAX_SIZE = 10 * 1024 * 1024; // 10MB

  app.post("/admin/posts/attachments", async (request, reply) => {
    const collected: UploadedAttachmentData[] = [];
    try {
      const parts = (request as typeof request & {
        files: (opts: { limits: { fileSize: number; files: number } }) => AsyncIterable<{
          filename?: string;
          mimetype: string;
          file: AsyncIterable<Buffer> & { resume: () => void };
        }>;
      }).files({ limits: { fileSize: ADMIN_ATTACH_MAX_SIZE, files: ADMIN_ATTACH_MAX_FILES } });

      for await (const part of parts) {
        const chunks: Buffer[] = [];
        let totalSize = 0;
        let truncated = false;
        for await (const chunk of part.file) {
          totalSize += chunk.length;
          if (totalSize > ADMIN_ATTACH_MAX_SIZE) {
            truncated = true;
            part.file.resume();
            break;
          }
          chunks.push(chunk as Buffer);
        }
        if (truncated) {
          return reply.code(400).send({
            error: { code: "FILE_TOO_LARGE", message: `파일 크기 초과: ${part.filename ?? "unknown"} (최대 10MB)` },
          });
        }
        collected.push({
          originalName: part.filename ?? "unknown",
          mimetype: part.mimetype,
          buffer: Buffer.concat(chunks),
          size: totalSize,
        });
        if (collected.length > ADMIN_ATTACH_MAX_FILES) {
          return reply.code(400).send({
            error: { code: "TOO_MANY_FILES", message: `첨부파일은 최대 ${ADMIN_ATTACH_MAX_FILES}개까지 가능합니다.` },
          });
        }
      }
    } catch (err) {
      const error = err as Error;
      if (error.message?.includes("limit") || error.message?.includes("files")) {
        return reply.code(400).send({
          error: { code: "TOO_MANY_FILES", message: `첨부파일은 최대 ${ADMIN_ATTACH_MAX_FILES}개까지 가능합니다.` },
        });
      }
      throw err;
    }

    if (collected.length === 0) {
      return reply.code(400).send({ error: { code: "NO_FILES", message: "업로드할 파일이 없습니다." } });
    }

    try {
      const files = await uploadPostAttachments(collected);
      return reply.code(201).send({ files });
    } catch (err) {
      if (err instanceof AttachmentValidationError) {
        return reply.code(400).send({ error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });

  // ── POST /api/v1/admin/posts — 공지 작성 (Story 9.17, admin 전용) ─────────────
  // ADR-0003: admin_users ↔ users 완전 분리. 공지 posts.user_id = null.
  // 작성자는 "(운영자)"로 표시된다. 관리자 세션은 adminGuardHook 이 이미 검증했다.
  app.post("/admin/posts", async (request, reply) => {
    const body = request.body as {
      title?: string;
      contentJson?: Record<string, unknown>;
      board?: string;
      category?: string | null;
      tags?: string[];
      status?: "draft" | "published";
      isNotice?: boolean;
      isPinned?: boolean;
      isFeatured?: boolean;
      isMainFeatured?: boolean;
      attachments?: { url: string; name: string; size: number; mimeType: string }[];
    };

    if (!body?.title || typeof body.title !== "string" || !body.title.trim()) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "제목을 입력해주세요." },
      });
    }
    if (!body?.contentJson || typeof body.contentJson !== "object") {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "본문 JSON(contentJson)이 필요합니다." },
      });
    }

    try {
      const result = await createAdminPost({
        title: body.title.trim(),
        contentJson: body.contentJson,
        board: typeof body.board === "string" ? body.board.trim() : undefined,
        category: typeof body.category === "string" ? body.category.trim() : null,
        tags: Array.isArray(body.tags) ? body.tags : [],
        status: body.status === "draft" ? "draft" : "published",
        isNotice: body.isNotice === true,
        isPinned: body.isPinned === true,
        isFeatured: body.isFeatured === true,
        isMainFeatured: body.isMainFeatured === true,
        attachments: Array.isArray(body.attachments) ? body.attachments : [],
      });
      return reply.status(201).send(result);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── GET /api/v1/admin/posts/:id ─────────────────────────────────────────────
  app.get("/admin/posts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await getPostDetail(id);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── GET /api/v1/admin/posts ──────────────────────────────────────────────────
  app.get("/admin/posts", async (request, reply) => {
    const parsed = adminPostsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() },
      });
    }

    try {
      const result = await listPosts(parsed.data);
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── PATCH /api/v1/admin/posts/bulk — 벌크 액션 (경로 충돌 방지: :id 앞에 등록) ─
  app.post("/admin/posts/bulk", async (request, reply) => {
    const parsed = adminPostsBulkSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
      });
    }

    const { ids, action, note: _note } = parsed.data;

    // delete 는 super_admin 만
    if (action === "delete") {
      if (request.adminSession?.role !== "super_admin") {
        return reply.status(403).send({
          error: { code: "FORBIDDEN", message: "최고 관리자(super_admin) 권한이 필요합니다." },
        });
      }
    }

    try {
      const result = await bulkPostAction(ids, action);
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── PATCH /api/v1/admin/posts/:id/flags ─────────────────────────────────────
  app.patch("/admin/posts/:id/flags", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = adminPostsFlagsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
      });
    }

    try {
      const result = await updatePostFlags(id, parsed.data);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── PATCH /api/v1/admin/posts/:id/hide ──────────────────────────────────────
  app.patch("/admin/posts/:id/hide", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await hidePost(id);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── PATCH /api/v1/admin/posts/:id/restore ───────────────────────────────────
  app.patch("/admin/posts/:id/restore", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await restorePost(id);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── PATCH /api/v1/admin/posts/:id — 게시글 내용 수정 (Story 9.17) ────────────
  app.patch("/admin/posts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      title?: string;
      contentJson?: Record<string, unknown>;
      tags?: string[];
      status?: "draft" | "published" | "hidden";
      board?: string;
      category?: string | null;
    };

    try {
      const result = await updatePostContent(id, {
        title: typeof body?.title === "string" ? body.title : undefined,
        contentJson: body?.contentJson && typeof body.contentJson === "object" ? body.contentJson : undefined,
        tags: Array.isArray(body?.tags) ? body.tags : undefined,
        status:
          body?.status === "draft" || body?.status === "published" || body?.status === "hidden"
            ? body.status
            : undefined,
        board: typeof body?.board === "string" ? body.board : undefined,
        category: typeof body?.category === "string" ? body.category : undefined,
      });
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── DELETE /api/v1/admin/posts/:id — super_admin 전용 ───────────────────────
  app.delete(
    "/admin/posts/:id",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const result = await deletePost(id);
        return reply.send(result);
      } catch (err: unknown) {
        const e = err as Error & { code?: string };
        if (e.code === "NOT_FOUND") {
          return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
        }
        request.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );

  // ── PATCH /api/v1/admin/posts/:id/seo ───────────────────────────────────────
  app.patch("/admin/posts/:id/seo", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = adminPostsSeoSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
      });
    }

    try {
      const result = await updatePostSeo(id, {
        seoTitle: parsed.data.seoTitle,
        seoDescription: parsed.data.seoDescription,
      });
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });
}
