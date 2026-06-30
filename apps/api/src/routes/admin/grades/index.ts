/**
 * 등급 관리 API (Story 9.13).
 *
 * GET    /api/v1/admin/grades      — 등급 목록 조회 (staff+)
 * POST   /api/v1/admin/grades      — 등급 신규 생성 (super_admin)
 * PATCH  /api/v1/admin/grades/:id  — 등급 수정 (staff+)
 * DELETE /api/v1/admin/grades/:id  — 등급 삭제 (super_admin)
 */

import type { FastifyInstance } from "fastify";
import { getDb } from "@ai-jakdang/database";
import { grades } from "@ai-jakdang/database/schema";
import { eq, asc } from "drizzle-orm";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
import { adminCreateGradeSchema, adminPatchGradeSchema } from "@ai-jakdang/contracts";
import { uploadImage, ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "../../../services/storage/index.js";

export async function registerAdminGradesRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/admin/grades ─────────────────────────────────────────────────
  app.get("/admin/grades", async (request, reply) => {
    const db = getDb();
    try {
      const rows = await db
        .select()
        .from(grades)
        .orderBy(asc(grades.level));

      return reply.send({
        items: rows.map((r) => ({
          id: r.id,
          level: r.level,
          name: r.name,
          minPoints: r.minPoints,
          maxPoints: r.maxPoints,
          imageUrl: r.imageUrl ?? null,
        })),
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── POST /api/v1/admin/grades/upload-badge — 뱃지 이미지 업로드 (super_admin) ──
  app.post(
    "/admin/grades/upload-badge",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const reqWithFile = request as typeof request & {
        isMultipart?: () => boolean;
        file?: () => Promise<
          | {
              filename: string;
              mimetype: string;
              file: { truncated: boolean };
              toBuffer: () => Promise<Buffer>;
            }
          | undefined
        >;
      };

      if (!reqWithFile.isMultipart?.()) {
        return reply.status(400).send({
          error: { code: "INVALID_CONTENT_TYPE", message: "multipart/form-data 형식으로 전송해주세요." },
        });
      }

      const part = await reqWithFile.file?.();
      if (!part) {
        return reply.status(400).send({ error: { code: "NO_FILE", message: "업로드할 파일이 없습니다." } });
      }

      if (!ALLOWED_IMAGE_TYPES.has(part.mimetype)) {
        return reply.status(400).send({
          error: { code: "INVALID_FILE_TYPE", message: "jpg·png·webp·gif 형식만 허용됩니다." },
        });
      }

      const buffer = await part.toBuffer();
      if (part.file.truncated || buffer.length > MAX_UPLOAD_BYTES) {
        return reply.status(400).send({
          error: { code: "FILE_TOO_LARGE", message: "파일 크기는 5MB 이하여야 합니다." },
        });
      }

      const result = await uploadImage(
        { filename: part.filename, mimetype: part.mimetype, data: buffer },
        "avatars",
      );
      return reply.status(200).send({ url: result.url });
    },
  );

  // ── PATCH /api/v1/admin/grades/:id ──────────────────────────────────────────
  app.patch("/admin/grades/:id", async (request, reply) => {
    const db = getDb();
    const { id } = request.params as { id: string };
    const parsed = adminPatchGradeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
      });
    }

    try {
      const existing = await db
        .select()
        .from(grades)
        .where(eq(grades.id, id))
        .limit(1);

      if (existing.length === 0) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "등급을 찾을 수 없습니다." } });
      }

      const updateData: Partial<typeof grades.$inferInsert> = {};
      if (parsed.data.minPoints !== undefined) updateData.minPoints = parsed.data.minPoints;
      if (parsed.data.maxPoints !== undefined) updateData.maxPoints = parsed.data.maxPoints;
      if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
      if (parsed.data.imageUrl !== undefined) updateData.imageUrl = parsed.data.imageUrl;

      const [updated] = await db
        .update(grades)
        .set(updateData)
        .where(eq(grades.id, id))
        .returning();

      return reply.send({
        id: updated.id,
        level: updated.level,
        name: updated.name,
        minPoints: updated.minPoints,
        maxPoints: updated.maxPoints,
        imageUrl: updated.imageUrl ?? null,
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── POST /api/v1/admin/grades — super_admin 전용 ─────────────────────────────
  app.post(
    "/admin/grades",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const db = getDb();
      const parsed = adminCreateGradeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
        });
      }

      try {
        const [created] = await db
          .insert(grades)
          .values({
            level: parsed.data.level,
            name: parsed.data.name,
            minPoints: parsed.data.minPoints,
            maxPoints: parsed.data.maxPoints ?? null,
            imageUrl: parsed.data.imageUrl ?? null,
          })
          .returning();

        return reply.status(201).send({
          id: created.id,
          level: created.level,
          name: created.name,
          minPoints: created.minPoints,
          maxPoints: created.maxPoints,
          imageUrl: created.imageUrl ?? null,
        });
      } catch (err: unknown) {
        const e = err as Error & { code?: string };
        if (e.code === "23505") {
          return reply.status(409).send({
            error: { code: "CONFLICT", message: "동일한 레벨(level)의 등급이 이미 존재합니다." },
          });
        }
        request.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );

  // ── DELETE /api/v1/admin/grades/:id — super_admin 전용 ──────────────────────
  app.delete(
    "/admin/grades/:id",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const db = getDb();
      const { id } = request.params as { id: string };

      try {
        const existing = await db
          .select()
          .from(grades)
          .where(eq(grades.id, id))
          .limit(1);

        if (existing.length === 0) {
          return reply.status(404).send({ error: { code: "NOT_FOUND", message: "등급을 찾을 수 없습니다." } });
        }

        await db.delete(grades).where(eq(grades.id, id));

        return reply.send({ id, deleted: true });
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );
}
