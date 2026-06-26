/**
 * 관리자 본인 계정(셀프 프로필) 조회·수정 API.
 *
 * GET   /api/v1/admin/account/me  — 로그인한 관리자 본인 정보(name·email·phone·role) 조회
 * PATCH /api/v1/admin/account/me  — 본인 name·phone 수정
 *
 * adminGuardHook 이후 실행되므로 request.adminSession.adminUserId 가 존재한다.
 * (BetterAuth get-session 과 달리 일반 Fastify 라우트라 @fastify/cors 가 정상 적용된다.)
 */

import { getDb, schema } from "@ai-jakdang/database";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

export async function registerAdminAccountRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/admin/account/me ────────────────────────────────────────────
  app.get("/admin/account/me", async (request, reply) => {
    const adminUserId = request.adminSession?.adminUserId;
    if (!adminUserId) {
      return reply.status(401).send({ error: { code: "ADMIN_UNAUTHORIZED", message: "관리자 인증이 필요합니다." } });
    }

    const db = getDb();
    const [row] = await db
      .select({
        id: schema.adminUsers.id,
        name: schema.adminUsers.name,
        email: schema.adminUsers.email,
        phone: schema.adminUsers.phone,
        role: schema.adminUsers.role,
        status: schema.adminUsers.status,
      })
      .from(schema.adminUsers)
      .where(eq(schema.adminUsers.id, adminUserId))
      .limit(1);

    if (!row) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "관리자 계정을 찾을 수 없습니다." } });
    }

    return reply.send({ admin: row });
  });

  // ── PATCH /api/v1/admin/account/me ──────────────────────────────────────────
  app.patch("/admin/account/me", async (request, reply) => {
    const adminUserId = request.adminSession?.adminUserId;
    if (!adminUserId) {
      return reply.status(401).send({ error: { code: "ADMIN_UNAUTHORIZED", message: "관리자 인증이 필요합니다." } });
    }

    const body = (request.body ?? {}) as { name?: unknown; phone?: unknown };
    const patch: { name?: string; phone?: string; updatedAt: Date } = { updatedAt: new Date() };

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (name.length < 1) {
        return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "이름을 입력해 주세요." } });
      }
      patch.name = name;
    }
    if (body.phone !== undefined) {
      const phone = typeof body.phone === "string" ? body.phone.trim() : "";
      if (phone.length < 1) {
        return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "연락처를 입력해 주세요." } });
      }
      patch.phone = phone;
    }

    const db = getDb();
    const [updated] = await db
      .update(schema.adminUsers)
      .set(patch)
      .where(eq(schema.adminUsers.id, adminUserId))
      .returning({
        id: schema.adminUsers.id,
        name: schema.adminUsers.name,
        email: schema.adminUsers.email,
        phone: schema.adminUsers.phone,
        role: schema.adminUsers.role,
        status: schema.adminUsers.status,
      });

    if (!updated) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "관리자 계정을 찾을 수 없습니다." } });
    }

    return reply.send({ admin: updated });
  });
}
