/**
 * 권한 매트릭스 API (Item 24).
 *
 * GET  /api/v1/admin/permissions — 실효 권한 매트릭스 조회 (코드 기본값 + DB 오버라이드 병합)
 * PATCH /api/v1/admin/permissions — 역할·액션별 권한 오버라이드 저장
 *
 * 두 라우트 모두 requireSuperAdmin 가드.
 * 이 파일은 registerAdminMembersRoutes(admin-members/index.ts) 내에서 호출되므로
 * admin/index.ts 수정이 불필요하다.
 */

import type { FastifyInstance } from "fastify";
import { getDb } from "@ai-jakdang/database";
import { adminRolePermissions, adminRoles } from "@ai-jakdang/database/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";

// 코드 기본값 — packages/auth/src/permissions.ts 와 동기화 유지
type AdminAction =
  | "content:hide"
  | "content:delete"
  | "report:process"
  | "member:sanction"
  | "member:role-change"
  | "site:settings"
  | "ads:manage"
  | "admin:approve";

const ALL_ACTIONS: AdminAction[] = [
  "content:hide",
  "content:delete",
  "report:process",
  "member:sanction",
  "member:role-change",
  "site:settings",
  "ads:manage",
  "admin:approve",
];

/** staff 고정 역할의 코드 기본값 (DB 오버라이드 없을 때 사용). */
const STAFF_DEFAULTS: Record<AdminAction, boolean> = {
  "content:hide": true,
  "content:delete": false,
  "report:process": true,
  "member:sanction": true,
  "member:role-change": false,
  "site:settings": false,
  "ads:manage": false,
  "admin:approve": false,
};

/** 한 역할의 기본 권한 행을 만든다. super_admin=전부 true, staff=STAFF_DEFAULTS, 커스텀=전부 false. */
function baseRow(roleKey: string): Record<AdminAction, boolean> {
  if (roleKey === "super_admin") {
    return Object.fromEntries(ALL_ACTIONS.map((a) => [a, true])) as Record<AdminAction, boolean>;
  }
  if (roleKey === "staff") return { ...STAFF_DEFAULTS };
  return Object.fromEntries(ALL_ACTIONS.map((a) => [a, false])) as Record<AdminAction, boolean>;
}

const patchPermissionSchema = z.object({
  role: z.string().min(1),
  action: z.string().min(1),
  allowed: z.boolean(),
});

export async function registerAdminPermissionsRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/admin/permissions ─────────────────────────────────────────────
  app.get(
    "/admin/permissions",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const db = getDb();
      try {
        const roles = await db.select().from(adminRoles);
        const overrides = await db.select().from(adminRolePermissions);

        // 역할별 기본 권한 행 구성 (admin_roles 의 모든 역할에 대해)
        const matrix: Record<string, Record<string, boolean>> = {};
        for (const r of roles) {
          matrix[r.key] = baseRow(r.key) as Record<string, boolean>;
        }

        // DB 오버라이드 적용 (super_admin은 항상 전부 true, 오버라이드 무시)
        for (const ov of overrides) {
          if (ov.role === "super_admin") continue;
          if (matrix[ov.role] && ALL_ACTIONS.includes(ov.action as AdminAction)) {
            matrix[ov.role][ov.action] = ov.allowed;
          }
        }

        // 역할 메타(이름·locked·정렬) — 매트릭스 컬럼 렌더용
        const roleMeta = roles
          .sort((a, b) => Number(b.locked) - Number(a.locked) || a.key.localeCompare(b.key))
          .map((r) => ({ key: r.key, name: r.name, locked: r.locked }));

        return reply.send({ matrix, roles: roleMeta, actions: ALL_ACTIONS });
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );

  // ── PATCH /api/v1/admin/permissions ───────────────────────────────────────────
  app.patch(
    "/admin/permissions",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const parsed = patchPermissionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
        });
      }

      const { role, action, allowed } = parsed.data;

      // super_admin은 항상 전부 true — 변경 불가
      if (role === "super_admin") {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "마스터(super_admin) 권한은 변경할 수 없습니다." },
        });
      }

      if (!ALL_ACTIONS.includes(action as AdminAction)) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "유효하지 않은 액션입니다." },
        });
      }

      const db = getDb();
      try {
        // 존재하는 역할만 허용
        const [roleRow] = await db
          .select({ key: adminRoles.key })
          .from(adminRoles)
          .where(eq(adminRoles.key, role))
          .limit(1);
        if (!roleRow) {
          return reply.status(400).send({
            error: { code: "VALIDATION_ERROR", message: "존재하지 않는 역할입니다." },
          });
        }

        await db
          .insert(adminRolePermissions)
          .values({ role, action, allowed, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: [adminRolePermissions.role, adminRolePermissions.action],
            set: { allowed, updatedAt: new Date() },
          });

        return reply.send({ role, action, allowed });
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );
}
