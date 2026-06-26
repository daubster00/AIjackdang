/**
 * 뱃지 관리 API (Story 9.13).
 *
 * GET    /api/v1/admin/badges      — 목록 조회 (staff+)
 * POST   /api/v1/admin/badges      — 신규 추가 (staff+)
 * PATCH  /api/v1/admin/badges/:id  — 수정 (staff+, 비활성화는 super_admin)
 * DELETE /api/v1/admin/badges/:id  — 삭제 (super_admin 전용)
 */

import type { FastifyInstance } from "fastify";
import { getDb } from "@ai-jakdang/database";
import { badges } from "@ai-jakdang/database/schema";
import { eq, asc } from "drizzle-orm";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
import { adminCreateBadgeSchema, adminPatchBadgeSchema } from "@ai-jakdang/contracts";

export async function registerAdminBadgesRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/admin/badges ─────────────────────────────────────────────────
  app.get("/admin/badges", async (request, reply) => {
    const db = getDb();
    try {
      const rows = await db
        .select()
        .from(badges)
        .orderBy(asc(badges.name));

      return reply.send({
        items: rows.map((r) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          description: r.description,
          iconUrl: r.iconUrl,
          isAuto: r.isAuto,
          condition: r.condition,
          isActive: r.isActive,
        })),
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── POST /api/v1/admin/badges ────────────────────────────────────────────────
  app.post("/admin/badges", async (request, reply) => {
    const db = getDb();
    const parsed = adminCreateBadgeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
      });
    }

    try {
      const [created] = await db
        .insert(badges)
        .values({
          slug: parsed.data.slug,
          name: parsed.data.name,
          description: parsed.data.description ?? "",
          iconUrl: parsed.data.iconUrl ?? "/badges/default.png",
          isAuto: parsed.data.isAuto ?? false,
          condition: parsed.data.condition ?? null,
          isActive: true,
        })
        .returning();

      return reply.status(201).send({
        id: created.id,
        slug: created.slug,
        name: created.name,
        description: created.description,
        iconUrl: created.iconUrl,
        isAuto: created.isAuto,
        condition: created.condition,
        isActive: created.isActive,
      });
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "23505") {
        return reply.status(409).send({ error: { code: "CONFLICT", message: "동일한 slug 의 뱃지가 이미 존재합니다." } });
      }
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── PATCH /api/v1/admin/badges/:id ──────────────────────────────────────────
  app.patch("/admin/badges/:id", async (request, reply) => {
    const db = getDb();
    const { id } = request.params as { id: string };
    const parsed = adminPatchBadgeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
      });
    }

    // 비활성화(isActive: false)는 super_admin 전용
    if (parsed.data.isActive === false && request.adminSession?.role !== "super_admin") {
      return reply.status(403).send({
        error: { code: "FORBIDDEN", message: "뱃지 비활성화는 최고 관리자(super_admin) 권한이 필요합니다." },
      });
    }

    try {
      const existing = await db
        .select()
        .from(badges)
        .where(eq(badges.id, id))
        .limit(1);

      if (existing.length === 0) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "뱃지를 찾을 수 없습니다." } });
      }

      const updateData: Partial<typeof badges.$inferInsert> = {};
      if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
      if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
      if (parsed.data.iconUrl !== undefined) updateData.iconUrl = parsed.data.iconUrl;
      if (parsed.data.isAuto !== undefined) updateData.isAuto = parsed.data.isAuto;
      if (parsed.data.condition !== undefined) updateData.condition = parsed.data.condition;
      if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

      const [updated] = await db
        .update(badges)
        .set(updateData)
        .where(eq(badges.id, id))
        .returning();

      return reply.send({
        id: updated.id,
        slug: updated.slug,
        name: updated.name,
        description: updated.description,
        iconUrl: updated.iconUrl,
        isAuto: updated.isAuto,
        condition: updated.condition,
        isActive: updated.isActive,
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── DELETE /api/v1/admin/badges/:id — super_admin 전용 ───────────────────────
  app.delete(
    "/admin/badges/:id",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const db = getDb();
      const { id } = request.params as { id: string };

      try {
        const existing = await db
          .select()
          .from(badges)
          .where(eq(badges.id, id))
          .limit(1);

        if (existing.length === 0) {
          return reply.status(404).send({ error: { code: "NOT_FOUND", message: "뱃지를 찾을 수 없습니다." } });
        }

        await db.delete(badges).where(eq(badges.id, id));

        return reply.send({ id, deleted: true });
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );
}
