/**
 * 게시글 관리 API 등록 진입점 (Story 9.6 + 9.17).
 *
 * POST   /api/v1/admin/posts                — 공지 작성 (Story 9.17, admin 전용)
 * GET    /api/v1/admin/posts                — 목록 조회
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
  createNoticePost,
  listPosts,
  updatePostContent,
  updatePostFlags,
  hidePost,
  restorePost,
  deletePost,
  updatePostSeo,
  bulkPostAction,
} from "./service.js";

export async function registerAdminPostsRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /api/v1/admin/posts — 공지 작성 (Story 9.17, admin 전용) ─────────────
  // ADR-0003: admin_users ↔ users 완전 분리. 공지 posts.user_id = null.
  // 작성자는 "(운영자)"로 표시된다. 관리자 세션은 adminGuardHook 이 이미 검증했다.
  app.post("/admin/posts", async (request, reply) => {
    const body = request.body as {
      title?: string;
      contentJson?: Record<string, unknown>;
      tags?: string[];
      status?: "draft" | "published";
      isPinned?: boolean;
      isMainFeatured?: boolean;
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
      const result = await createNoticePost({
        title: body.title.trim(),
        contentJson: body.contentJson,
        tags: Array.isArray(body.tags) ? body.tags : [],
        status: body.status === "draft" ? "draft" : "published",
        isPinned: body.isPinned === true,
        isMainFeatured: body.isMainFeatured === true,
      });
      return reply.status(201).send(result);
    } catch (err) {
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
    };

    try {
      const result = await updatePostContent(id, {
        title: typeof body?.title === "string" ? body.title : undefined,
        contentJson: body?.contentJson && typeof body.contentJson === "object" ? body.contentJson : undefined,
        tags: Array.isArray(body?.tags) ? body.tags : undefined,
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
