/**
 * 실전자료 관리 API 등록 진입점 (Story 9.8).
 *
 * GET    /api/v1/admin/resources                      — 목록 조회
 * POST   /api/v1/admin/resources                      — 운영자 자료 등록
 * GET    /api/v1/admin/resources/:id                  — 상세 (파일 목록 포함)
 * PATCH  /api/v1/admin/resources/:id                  — 운영자 자료 수정
 * PATCH  /api/v1/admin/resources/:id/hide             — 자료 숨김
 * DELETE /api/v1/admin/resources/:id                  — 자료 소프트딜리트 (super_admin)
 * DELETE /api/v1/admin/resources/:id/files/:fileId    — 첨부파일 소프트딜리트
 * GET    /api/v1/admin/resources/:id/reviews          — 후기 목록
 * PATCH  /api/v1/admin/reviews/:commentId/hide        — 후기 숨김
 * DELETE /api/v1/admin/reviews/:commentId             — 후기 소프트딜리트 (super_admin)
 */

import type { FastifyInstance } from "fastify";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
import {
  adminResourcesQuerySchema,
  adminResourceHideSchema,
  adminResourceDeleteSchema,
  adminResourceFileDeleteSchema,
  adminReviewDeleteSchema,
} from "@ai-jakdang/contracts/admin/resources";
import {
  createAdminResource,
  listResources,
  getResourceDetail,
  updateAdminResource,
  hideResource,
  deleteResource,
  deleteResourceFile,
  listResourceReviews,
  hideReview,
  deleteReview,
} from "./service.js";
import {
  uploadResourceFiles,
  UploadValidationError,
  type UploadedFileData,
} from "../../v1/resources/upload.service.js";

const resourceTypes = ["prompt", "claude-code-skill", "mcp", "rules-config", "template-checklist"] as const;
const difficulties = ["beginner", "intermediate", "advanced"] as const;
const writeStatuses = ["draft", "published", "hidden"] as const;

function isOneOf<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function parseWriteBody(body: unknown, partial = false) {
  const b = body as Record<string, unknown> | null;
  if (!b) return { error: "요청 본문이 필요합니다." };

  const title = typeof b.title === "string" ? b.title.trim() : undefined;
  const summary = typeof b.summary === "string" ? b.summary.trim() : undefined;
  const resourceType = b.resourceType;
  const environment = Array.isArray(b.environment) ? b.environment.filter((v): v is string => typeof v === "string") : undefined;
  const difficulty = b.difficulty;
  const status = b.status;
  const descriptionJson = b.descriptionJson && typeof b.descriptionJson === "object" ? b.descriptionJson as Record<string, unknown> : undefined;
  const usageJson = b.usageJson && typeof b.usageJson === "object" ? b.usageJson as Record<string, unknown> : undefined;
  const version = typeof b.version === "string" ? b.version.trim() : undefined;

  if (!partial && (!title || !summary || !descriptionJson || !usageJson)) {
    return { error: "제목, 요약, 본문, 사용법은 필수입니다." };
  }
  if (title !== undefined && title.length < 2) return { error: "제목은 2자 이상 입력하세요." };
  if (summary !== undefined && summary.length < 1) return { error: "요약을 입력하세요." };
  if (resourceType !== undefined && !isOneOf(resourceTypes, resourceType)) return { error: "자료유형이 올바르지 않습니다." };
  if (difficulty !== undefined && !isOneOf(difficulties, difficulty)) return { error: "난이도가 올바르지 않습니다." };
  if (status !== undefined && !isOneOf(writeStatuses, status)) return { error: "상태가 올바르지 않습니다." };

  return {
    data: {
      title,
      summary,
      resourceType: isOneOf(resourceTypes, resourceType) ? resourceType : undefined,
      environment,
      difficulty: isOneOf(difficulties, difficulty) ? difficulty : undefined,
      status: isOneOf(writeStatuses, status) ? status : undefined,
      descriptionJson,
      usageJson,
      version,
    },
  };
}

export async function registerAdminResourcesRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/admin/resources ─────────────────────────────────────────────
  app.get("/admin/resources", async (request, reply) => {
    const parsed = adminResourcesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "잘못된 쿼리 파라미터입니다.",
          details: parsed.error.flatten(),
        },
      });
    }

    try {
      const result = await listResources(parsed.data);
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply
        .status(500)
        .send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── POST /api/v1/admin/resources ────────────────────────────────────────────
  app.post("/admin/resources", async (request, reply) => {
    const parsed = parseWriteBody(request.body);
    if ("error" in parsed) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: parsed.error } });
    }

    try {
      const result = await createAdminResource({
        title: parsed.data.title!,
        summary: parsed.data.summary!,
        resourceType: parsed.data.resourceType ?? "prompt",
        environment: parsed.data.environment ?? [],
        difficulty: parsed.data.difficulty ?? "beginner",
        descriptionJson: parsed.data.descriptionJson!,
        usageJson: parsed.data.usageJson!,
        status: parsed.data.status ?? "published",
        version: parsed.data.version,
      });
      return reply.status(201).send(result);
    } catch (err) {
      request.log.error(err);
      return reply
        .status(500)
        .send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── GET /api/v1/admin/resources/:id ─────────────────────────────────────────
  app.get("/admin/resources/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await getResourceDetail(id);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply
        .status(500)
        .send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── PATCH /api/v1/admin/resources/:id ───────────────────────────────────────
  app.patch("/admin/resources/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = parseWriteBody(request.body, true);
    if ("error" in parsed) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: parsed.error } });
    }

    try {
      const result = await updateAdminResource(id, parsed.data);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply
        .status(500)
        .send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── PATCH /api/v1/admin/resources/:id/hide ──────────────────────────────────
  app.patch("/admin/resources/:id/hide", async (request, reply) => {
    const { id } = request.params as { id: string };
    // body는 선택적 note — 검증 실패여도 진행 (note 미입력 허용)
    adminResourceHideSchema.safeParse(request.body);

    try {
      const result = await hideResource(id);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply
        .status(500)
        .send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── DELETE /api/v1/admin/resources/:id — super_admin 전용 ──────────────────
  app.delete(
    "/admin/resources/:id",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = adminResourceDeleteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "삭제 사유를 입력하세요.",
            details: parsed.error.flatten(),
          },
        });
      }

      try {
        const result = await deleteResource(id);
        return reply.send(result);
      } catch (err: unknown) {
        const e = err as Error & { code?: string };
        if (e.code === "NOT_FOUND") {
          return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
        }
        request.log.error(err);
        return reply
          .status(500)
          .send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );

  // ── DELETE /api/v1/admin/resources/:id/files/:fileId ──────────────────────
  // 첨부파일 소프트딜리트 — fileStatus='deleted'. R2 실제 삭제는 9.10 worker.
  // UX-DR-A9: 안전성 보증 표시 없음.
  app.delete("/admin/resources/:id/files/:fileId", async (request, reply) => {
    const { id, fileId } = request.params as { id: string; fileId: string };
    const parsed = adminResourceFileDeleteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "삭제 사유를 입력하세요.",
          details: parsed.error.flatten(),
        },
      });
    }

    try {
      const result = await deleteResourceFile(id, fileId);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply
        .status(500)
        .send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── POST /api/v1/admin/resources/:id/files — 관리자 파일 업로드 ─────────────
  // adminGuardHook은 app.ts에서 전역 preHandler로 등록되어 자동 적용됨.
  // multipart 플러그인도 전역 등록; per-request limits으로 50MB/3파일 확장.
  app.post<{ Params: { id: string } }>(
    "/admin/resources/:id/files",
    {},
    async (request, reply) => {
      const { id } = request.params;
      const MAX_FILES = 3;
      const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

      const uploadedFiles: UploadedFileData[] = [];

      try {
        const files = request.files({
          limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
        });

        for await (const part of files) {
          const chunks: Buffer[] = [];
          let totalSize = 0;
          let truncated = false;

          for await (const chunk of part.file) {
            totalSize += chunk.length;
            if (totalSize > MAX_FILE_SIZE) {
              truncated = true;
              part.file.resume();
              break;
            }
            chunks.push(chunk as Buffer);
          }

          if (truncated) {
            return reply.status(400).send({
              error: {
                code: "FILE_TOO_LARGE",
                message: `파일 크기 초과: ${part.filename ?? "unknown"} (최대 50MB)`,
              },
            });
          }

          uploadedFiles.push({
            originalName: part.filename ?? "unknown",
            mimetype: part.mimetype,
            buffer: Buffer.concat(chunks),
            size: totalSize,
          });

          if (uploadedFiles.length > MAX_FILES) {
            return reply.status(400).send({
              error: {
                code: "TOO_MANY_FILES",
                message: `파일 최대 ${MAX_FILES}개까지 업로드 가능합니다.`,
              },
            });
          }
        }
      } catch (err) {
        const error = err as Error;
        if (error.message?.includes("limit") || error.message?.includes("files")) {
          return reply.status(400).send({
            error: {
              code: "TOO_MANY_FILES",
              message: `파일 최대 ${MAX_FILES}개까지 업로드 가능합니다.`,
            },
          });
        }
        throw err;
      }

      if (uploadedFiles.length === 0) {
        return reply.status(400).send({
          error: { code: "NO_FILES", message: "업로드할 파일이 없습니다." },
        });
      }

      try {
        const results = await uploadResourceFiles(id, uploadedFiles);
        return reply.status(201).send({ files: results });
      } catch (err) {
        if (err instanceof UploadValidationError) {
          return reply.status(400).send({
            error: { code: err.code, message: err.message },
          });
        }
        request.log.error(err);
        return reply
          .status(500)
          .send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );

  // ── GET /api/v1/admin/resources/:id/reviews ─────────────────────────────────
  app.get("/admin/resources/:id/reviews", async (request, reply) => {
    const { id } = request.params as { id: string };
    const q = request.query as { page?: string; pageSize?: string };
    const page = Math.max(1, Number(q.page ?? "1"));
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize ?? "20")));

    try {
      const result = await listResourceReviews(id, page, pageSize);
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply
        .status(500)
        .send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── PATCH /api/v1/admin/reviews/:commentId/hide ─────────────────────────────
  // comment_status enum이 visible|deleted 만 존재 — 숨김도 deleted로 처리.
  // 엔드포인트는 분리해 두어 추후 'hidden' enum 추가 시 동작만 교체 가능.
  app.patch("/admin/reviews/:commentId/hide", async (request, reply) => {
    const { commentId } = request.params as { commentId: string };

    try {
      const result = await hideReview(commentId);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      }
      request.log.error(err);
      return reply
        .status(500)
        .send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── DELETE /api/v1/admin/reviews/:commentId — super_admin 전용 ─────────────
  app.delete(
    "/admin/reviews/:commentId",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { commentId } = request.params as { commentId: string };
      const parsed = adminReviewDeleteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "사유를 입력하세요.",
            details: parsed.error.flatten(),
          },
        });
      }

      try {
        const result = await deleteReview(commentId);
        return reply.send(result);
      } catch (err: unknown) {
        const e = err as Error & { code?: string };
        if (e.code === "NOT_FOUND") {
          return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
        }
        request.log.error(err);
        return reply
          .status(500)
          .send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );
}
