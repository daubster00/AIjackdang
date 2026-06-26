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
        })),
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

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
          })
          .returning();

        return reply.status(201).send({
          id: created.id,
          level: created.level,
          name: created.name,
          minPoints: created.minPoints,
          maxPoints: created.maxPoints,
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
