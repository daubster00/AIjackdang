/**
 * 커리큘럼 플랜 API 라우트 — Story 13.5 Task 2
 *
 * 모든 라우트: preHandler: [requireSuperAdmin] (슈퍼관리자 전용).
 * 이중 prefix 방지: 경로는 /admin/bots/curriculum/... (app.ts가 /api/v1 자동 부여).
 * 구체 경로를 와일드카드 앞에 등록 (라우트 충돌 방지).
 *
 * 엔드포인트 10종:
 *  1. GET   /admin/bots/curriculum/series
 *  2. GET   /admin/bots/curriculum/series/:seriesId
 *  3. GET   /admin/bots/curriculum/chapters
 *  7. GET   /admin/bots/curriculum/chapters/:chapterId/preview   ← 서픽스 먼저
 *  5. PATCH /admin/bots/curriculum/chapters/:chapterId/draft     ← 서픽스 먼저
 *  6. PATCH /admin/bots/curriculum/chapters/:chapterId/schedule  ← 서픽스 먼저
 *  8. POST  /admin/bots/curriculum/chapters/:chapterId/slots/:slotId/upload
 *  9. POST  /admin/bots/curriculum/chapters/:chapterId/slots/:slotId/generate
 * 10. PATCH /admin/bots/curriculum/chapters/:chapterId/slots/:slotId/complete
 *  4. GET   /admin/bots/curriculum/chapters/:chapterId           ← 마지막에 등록
 */

import type { FastifyInstance } from "fastify";
import {
  adminCurriculumSeriesQuerySchema,
  adminCurriculumChaptersQuerySchema,
  curriculumChapterDraftUpdateSchema,
  curriculumChapterScheduleSchema,
  curriculumSlotGenerateSchema,
} from "@ai-jakdang/contracts";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "../../../services/storage/index.js";
import {
  listCurriculumSeries,
  getCurriculumSeries,
  listCurriculumChapters,
  getCurriculumChapter,
  updateChapterDraft,
  setChapterSchedule,
  getChapterPreviewHtml,
  uploadSlotImage,
  requestSlotGenerate,
  completeSlot,
} from "./curriculum.service.js";

/** 서비스 에러 처리 공통 헬퍼. */
function handleServiceError(err: unknown, reply: { status: (code: number) => { send: (body: unknown) => unknown } }, log: { error: (err: unknown) => void }) {
  const e = err as Error & { code?: string };
  if (e.code === "NOT_FOUND") {
    return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
  }
  if (e.code === "INVALID_SOURCE_KIND") {
    return reply.status(400).send({ error: { code: "INVALID_SOURCE_KIND", message: e.message } });
  }
  if (e.code === "IMAGE_URL_REQUIRED") {
    return reply.status(400).send({ error: { code: "IMAGE_URL_REQUIRED", message: e.message } });
  }
  log.error(err);
  return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
}

export async function registerAdminBotCurriculumRoutes(app: FastifyInstance): Promise<void> {
  // ── 1. GET /admin/bots/curriculum/series ─────────────────────────────────────
  app.get(
    "/admin/bots/curriculum/series",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const parsed = adminCurriculumSeriesQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() },
        });
      }
      try {
        return reply.send(await listCurriculumSeries(parsed.data));
      } catch (err) {
        return handleServiceError(err, reply, request.log);
      }
    },
  );

  // ── 2. GET /admin/bots/curriculum/series/:seriesId ────────────────────────────
  app.get(
    "/admin/bots/curriculum/series/:seriesId",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { seriesId } = request.params as { seriesId: string };
      try {
        return reply.send(await getCurriculumSeries(seriesId));
      } catch (err) {
        return handleServiceError(err, reply, request.log);
      }
    },
  );

  // ── 3. GET /admin/bots/curriculum/chapters ────────────────────────────────────
  app.get(
    "/admin/bots/curriculum/chapters",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const parsed = adminCurriculumChaptersQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() },
        });
      }
      try {
        return reply.send(await listCurriculumChapters(parsed.data));
      } catch (err) {
        return handleServiceError(err, reply, request.log);
      }
    },
  );

  // ── 7. GET /admin/bots/curriculum/chapters/:chapterId/preview (서픽스 먼저)
  app.get(
    "/admin/bots/curriculum/chapters/:chapterId/preview",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { chapterId } = request.params as { chapterId: string };
      try {
        return reply.send(await getChapterPreviewHtml(chapterId));
      } catch (err) {
        return handleServiceError(err, reply, request.log);
      }
    },
  );

  // ── 5. PATCH /admin/bots/curriculum/chapters/:chapterId/draft (서픽스 먼저)
  app.patch(
    "/admin/bots/curriculum/chapters/:chapterId/draft",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { chapterId } = request.params as { chapterId: string };
      const parsed = curriculumChapterDraftUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
        });
      }
      try {
        return reply.send(await updateChapterDraft(chapterId, parsed.data));
      } catch (err) {
        return handleServiceError(err, reply, request.log);
      }
    },
  );

  // ── 6. PATCH /admin/bots/curriculum/chapters/:chapterId/schedule (서픽스 먼저)
  app.patch(
    "/admin/bots/curriculum/chapters/:chapterId/schedule",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { chapterId } = request.params as { chapterId: string };
      const parsed = curriculumChapterScheduleSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
        });
      }
      try {
        return reply.send(await setChapterSchedule(chapterId, parsed.data.scheduledAt));
      } catch (err) {
        return handleServiceError(err, reply, request.log);
      }
    },
  );

  // ── 8. POST /admin/bots/curriculum/chapters/:chapterId/slots/:slotId/upload ──
  app.post(
    "/admin/bots/curriculum/chapters/:chapterId/slots/:slotId/upload",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { chapterId, slotId } = request.params as { chapterId: string; slotId: string };

      // multipart file 추출 (request.parts() 반복)
      let filePart:
        | { type: "file"; fieldname: string; filename: string; mimetype: string; toBuffer: () => Promise<Buffer> }
        | undefined;

      for await (const part of request.parts()) {
        if (part.type === "file" && part.fieldname === "file") {
          filePart = part as typeof filePart;
          break;
        }
      }

      if (!filePart) {
        return reply.status(400).send({ error: { code: "FILE_REQUIRED", message: "file 필드가 필요합니다." } });
      }
      if (!ALLOWED_IMAGE_TYPES.has(filePart.mimetype)) {
        return reply.status(400).send({ error: { code: "INVALID_FILE_TYPE", message: "jpg·png·webp·gif 형식만 허용됩니다." } });
      }
      const buffer = await filePart.toBuffer();
      if (buffer.length > MAX_UPLOAD_BYTES) {
        return reply.status(400).send({ error: { code: "FILE_TOO_LARGE", message: "파일 크기는 5MB 이하여야 합니다." } });
      }

      try {
        return reply.send(
          await uploadSlotImage(chapterId, slotId, {
            filename: filePart.filename,
            mimetype: filePart.mimetype,
            data: buffer,
          }),
        );
      } catch (err) {
        return handleServiceError(err, reply, request.log);
      }
    },
  );

  // ── 9. POST /admin/bots/curriculum/chapters/:chapterId/slots/:slotId/generate ─
  app.post(
    "/admin/bots/curriculum/chapters/:chapterId/slots/:slotId/generate",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { chapterId, slotId } = request.params as { chapterId: string; slotId: string };
      const parsed = curriculumSlotGenerateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
        });
      }
      try {
        return reply.send(await requestSlotGenerate(chapterId, slotId, parsed.data));
      } catch (err) {
        return handleServiceError(err, reply, request.log);
      }
    },
  );

  // ── 10. PATCH /admin/bots/curriculum/chapters/:chapterId/slots/:slotId/complete
  app.patch(
    "/admin/bots/curriculum/chapters/:chapterId/slots/:slotId/complete",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { chapterId, slotId } = request.params as { chapterId: string; slotId: string };
      try {
        return reply.send(await completeSlot(chapterId, slotId));
      } catch (err) {
        return handleServiceError(err, reply, request.log);
      }
    },
  );

  // ── 4. GET /admin/bots/curriculum/chapters/:chapterId (서픽스들 후 마지막 등록)
  app.get(
    "/admin/bots/curriculum/chapters/:chapterId",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { chapterId } = request.params as { chapterId: string };
      try {
        return reply.send(await getCurriculumChapter(chapterId));
      } catch (err) {
        return handleServiceError(err, reply, request.log);
      }
    },
  );
}
