/**
 * 포인트 규칙 관리 API (Story 9.13).
 *
 * GET    /api/v1/admin/points/rules            — 목록 조회 (staff+)
 * PATCH  /api/v1/admin/points/rules/:actionType — 규칙 수정 (staff+)
 */

import type { FastifyInstance } from "fastify";
import { getDb } from "@ai-jakdang/database";
import { pointRules } from "@ai-jakdang/database/schema";
import { eq } from "drizzle-orm";
import { adminPatchPointRuleSchema } from "@ai-jakdang/contracts";

export async function registerAdminPointsRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/admin/points/rules ───────────────────────────────────────────
  app.get("/api/v1/admin/points/rules", async (request, reply) => {
    const db = getDb();
    try {
      const rows = await db
        .select()
        .from(pointRules)
        .orderBy(pointRules.actionType);

      return reply.send({
        items: rows.map((r) => ({
          actionType: r.actionType,
          points: r.points,
          description: r.description,
          isActive: r.isActive,
          updatedAt: r.updatedAt.toISOString(),
        })),
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── PATCH /api/v1/admin/points/rules/:actionType ─────────────────────────────
  app.patch("/api/v1/admin/points/rules/:actionType", async (request, reply) => {
    const db = getDb();
    const { actionType } = request.params as { actionType: string };
    const parsed = adminPatchPointRuleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
      });
    }

    try {
      const existing = await db
        .select()
        .from(pointRules)
        .where(eq(pointRules.actionType, actionType))
        .limit(1);

      if (existing.length === 0) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "포인트 규칙을 찾을 수 없습니다." } });
      }

      const updateData: Partial<typeof pointRules.$inferInsert> & { updatedAt: Date } = {
        updatedAt: new Date(),
      };
      if (parsed.data.points !== undefined) updateData.points = parsed.data.points;
      if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
      if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

      const [updated] = await db
        .update(pointRules)
        .set(updateData)
        .where(eq(pointRules.actionType, actionType))
        .returning();

      return reply.send({
        actionType: updated.actionType,
        points: updated.points,
        description: updated.description,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt.toISOString(),
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });
}
