/**
 * 운영자 계정 관리 API 라우트 (Story 9.4).
 *
 * GET  /admin/admin-members         — 목록 조회 (page, pageSize, status, q)
 * PATCH /admin/admin-members/:id/approve  — 승인
 * PATCH /admin/admin-members/:id/reject   — 반려
 * PATCH /admin/admin-members/:id/suspend  — 정지 (세션 삭제)
 * PATCH /admin/admin-members/:id/activate — 재활성
 * PATCH /admin/admin-members/:id/role     — 역할 변경 (세션 삭제, 자기자신 403)
 *
 * 모든 라우트에 requireSuperAdmin preHandler 적용.
 */

import {
  adminMembersQuerySchema,
  adminMemberApproveSchema,
  adminMemberNoteSchema,
  adminMemberRoleSchema,
} from "@ai-jakdang/contracts";
import { getDb } from "@ai-jakdang/database";
import { adminUsers } from "@ai-jakdang/database/schema";
import { and, count, eq, ilike, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
import {
  activateAdmin,
  approveAdmin,
  changeAdminRole,
  rejectAdmin,
  suspendAdmin,
} from "./service.js";
import { registerAdminPermissionsRoutes } from "../permissions/index.js";
import { registerAdminRolesRoutes, roleExists } from "../roles/index.js";

const idParamsSchema = z.object({ id: z.string().uuid("올바른 관리자 ID가 아닙니다") });

export async function registerAdminMembersRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /admin/admin-members ────────────────────────────────────────────────

  typed.get(
    "/admin/admin-members",
    {
      preHandler: [requireSuperAdmin],
      schema: {
        description: "관리자(운영자) 목록 조회. super_admin 전용.",
        tags: ["admin-members"],
        querystring: adminMembersQuerySchema,
      },
    },
    async (request, reply) => {
      const { page, pageSize, status, q } = request.query;
      const db = getDb();

      const conditions = [];
      if (status) conditions.push(eq(adminUsers.status, status));
      if (q) {
        conditions.push(
          or(ilike(adminUsers.name, `%${q}%`), ilike(adminUsers.email, `%${q}%`)),
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [{ total }] = await db
        .select({ total: count() })
        .from(adminUsers)
        .where(where);

      const items = await db
        .select()
        .from(adminUsers)
        .where(where)
        .orderBy(adminUsers.createdAt)
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      const totalPages = Math.ceil(total / pageSize);

      return reply.code(200).send({
        items: items.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: u.role,
          status: u.status,
          approvedBy: u.approvedBy ?? null,
          approvedAt: u.approvedAt ? u.approvedAt.toISOString() : null,
          note: u.note ?? null,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
        })),
        meta: { page, pageSize, totalItems: total, totalPages },
      });
    },
  );

  // ── PATCH /admin/admin-members/:id/approve ─────────────────────────────────

  typed.patch(
    "/admin/admin-members/:id/approve",
    {
      preHandler: [requireSuperAdmin],
      schema: {
        description: "승인 대기 관리자를 승인. super_admin 전용.",
        tags: ["admin-members"],
        params: idParamsSchema,
        body: adminMemberApproveSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { role, note } = request.body;
      const approverId = request.adminSession!.adminUserId;

      if (!(await roleExists(role))) {
        return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "존재하지 않는 역할입니다." } });
      }

      try {
        const updated = await approveAdmin(id, approverId, role, note);
        return reply.code(200).send({
          id: updated.id,
          status: updated.status,
          role: updated.role,
          updatedAt: updated.updatedAt.toISOString(),
        });
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === "NOT_FOUND") {
          return reply.code(404).send({ error: { code: "NOT_FOUND", message: e.message } });
        }
        if (e.code === "INVALID_STATUS") {
          return reply.code(409).send({ error: { code: "INVALID_STATUS", message: e.message } });
        }
        throw err;
      }
    },
  );

  // ── PATCH /admin/admin-members/:id/reject ──────────────────────────────────

  typed.patch(
    "/admin/admin-members/:id/reject",
    {
      preHandler: [requireSuperAdmin],
      schema: {
        description: "승인 대기 관리자를 반려. super_admin 전용.",
        tags: ["admin-members"],
        params: idParamsSchema,
        body: adminMemberNoteSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { note } = request.body;

      try {
        const updated = await rejectAdmin(id, note);
        return reply.code(200).send({
          id: updated.id,
          status: updated.status,
          role: updated.role,
          updatedAt: updated.updatedAt.toISOString(),
        });
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === "NOT_FOUND") {
          return reply.code(404).send({ error: { code: "NOT_FOUND", message: e.message } });
        }
        if (e.code === "INVALID_STATUS") {
          return reply.code(409).send({ error: { code: "INVALID_STATUS", message: e.message } });
        }
        throw err;
      }
    },
  );

  // ── PATCH /admin/admin-members/:id/suspend ─────────────────────────────────

  typed.patch(
    "/admin/admin-members/:id/suspend",
    {
      preHandler: [requireSuperAdmin],
      schema: {
        description: "활성 관리자를 정지. 세션 전체 삭제. super_admin 전용.",
        tags: ["admin-members"],
        params: idParamsSchema,
        body: adminMemberNoteSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { note } = request.body;

      try {
        const updated = await suspendAdmin(id, note);
        return reply.code(200).send({
          id: updated.id,
          status: updated.status,
          role: updated.role,
          updatedAt: updated.updatedAt.toISOString(),
        });
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === "NOT_FOUND") {
          return reply.code(404).send({ error: { code: "NOT_FOUND", message: e.message } });
        }
        if (e.code === "INVALID_STATUS") {
          return reply.code(409).send({ error: { code: "INVALID_STATUS", message: e.message } });
        }
        throw err;
      }
    },
  );

  // ── PATCH /admin/admin-members/:id/activate ────────────────────────────────

  typed.patch(
    "/admin/admin-members/:id/activate",
    {
      preHandler: [requireSuperAdmin],
      schema: {
        description: "정지된 관리자를 재활성화. super_admin 전용.",
        tags: ["admin-members"],
        params: idParamsSchema,
        body: adminMemberNoteSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { note } = request.body;

      try {
        const updated = await activateAdmin(id, note);
        return reply.code(200).send({
          id: updated.id,
          status: updated.status,
          role: updated.role,
          updatedAt: updated.updatedAt.toISOString(),
        });
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === "NOT_FOUND") {
          return reply.code(404).send({ error: { code: "NOT_FOUND", message: e.message } });
        }
        if (e.code === "INVALID_STATUS") {
          return reply.code(409).send({ error: { code: "INVALID_STATUS", message: e.message } });
        }
        throw err;
      }
    },
  );

  // ── PATCH /admin/admin-members/:id/role ────────────────────────────────────

  typed.patch(
    "/admin/admin-members/:id/role",
    {
      preHandler: [requireSuperAdmin],
      schema: {
        description: "관리자 역할 변경. 자기 자신은 403. 세션 전체 삭제. super_admin 전용.",
        tags: ["admin-members"],
        params: idParamsSchema,
        body: adminMemberRoleSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { role, note } = request.body;
      const requesterId = request.adminSession!.adminUserId;

      if (!(await roleExists(role))) {
        return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "존재하지 않는 역할입니다." } });
      }

      try {
        const updated = await changeAdminRole(id, requesterId, role, note);
        return reply.code(200).send({
          id: updated.id,
          status: updated.status,
          role: updated.role,
          updatedAt: updated.updatedAt.toISOString(),
        });
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === "FORBIDDEN_SELF") {
          return reply.code(403).send({ error: { code: "FORBIDDEN", message: e.message } });
        }
        if (e.code === "NOT_FOUND") {
          return reply.code(404).send({ error: { code: "NOT_FOUND", message: e.message } });
        }
        throw err;
      }
    },
  );

  // ── GET /admin/admin-members/:id ─────────────────────────────────────────────

  typed.get(
    "/admin/admin-members/:id",
    {
      preHandler: [requireSuperAdmin],
      schema: {
        description: "관리자(운영자) 단건 조회. super_admin 전용.",
        tags: ["admin-members"],
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const db = getDb();

      const [u] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, id))
        .limit(1);

      if (!u) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "관리자를 찾을 수 없습니다." },
        });
      }

      return reply.code(200).send({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
        approvedBy: u.approvedBy ?? null,
        approvedAt: u.approvedAt ? u.approvedAt.toISOString() : null,
        note: u.note ?? null,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
      });
    },
  );

  // 권한 매트릭스 라우트 (GET/PATCH /admin/permissions) — admin/index.ts 편집 없이 여기서 등록
  await registerAdminPermissionsRoutes(app);
  // 역할 관리 라우트 (GET/POST/PATCH/DELETE /admin/roles) — M12
  await registerAdminRolesRoutes(app);
}
