/**
 * 관리자 역할(role) 관리 API (M12).
 *
 * GET    /api/v1/admin/roles        — 역할 목록(+역할별 관리자 수)
 * POST   /api/v1/admin/roles        — 커스텀 역할 추가
 * PATCH  /api/v1/admin/roles/:key   — 역할 이름/설명 수정
 * DELETE /api/v1/admin/roles/:key   — 커스텀 역할 삭제(고정/사용중 불가)
 *
 * 모든 라우트 requireSuperAdmin. staff/super_admin 은 locked 고정 역할이라
 * 삭제·키변경 불가. 그 외 역할은 자유롭게 추가/수정/삭제할 수 있다.
 */

import type { FastifyInstance } from "fastify";
import { getDb } from "@ai-jakdang/database";
import { adminRoles, adminUsers } from "@ai-jakdang/database/schema";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";

/** 역할 키 — 영문 소문자/숫자/언더스코어 slug. 예약어(staff/super_admin)는 신규 생성 불가. */
const roleKeySchema = z
  .string()
  .min(2, "역할 키는 2자 이상이어야 합니다")
  .max(40)
  .regex(/^[a-z][a-z0-9_]*$/, "역할 키는 영문 소문자로 시작하고 영문/숫자/_ 만 사용할 수 있습니다");

const createRoleSchema = z.object({
  key: roleKeySchema,
  name: z.string().min(1, "역할 이름을 입력하세요").max(40),
  description: z.string().max(200).optional().default(""),
});

const updateRoleSchema = z.object({
  name: z.string().min(1, "역할 이름을 입력하세요").max(40),
  description: z.string().max(200).optional().default(""),
});

/**
 * 시스템 고정 역할 — 마이그레이션 0025 가 admin_roles 에 시드하지만,
 * 테이블이 비워지거나 시드가 누락돼도 역할 시스템(목록·배정 검증)이 깨지지 않도록
 * 코드 레벨에서 항상 보장한다. (권한 매트릭스의 "코드 기본값 + DB 오버라이드" 패턴과 동일)
 */
const BUILTIN_ROLES: { key: string; name: string; description: string; locked: true }[] = [
  {
    key: "super_admin",
    name: "마스터",
    description: "최고 관리자. 모든 관리 항목에 대한 전체 권한이 고정 부여됩니다.",
    locked: true,
  },
  {
    key: "staff",
    name: "운영자",
    description: "일반 운영진. 게시글 중재·신고 처리·회원 제재 권한을 보유합니다.",
    locked: true,
  },
];
const BUILTIN_KEYS = new Set(BUILTIN_ROLES.map((r) => r.key));

/** 주어진 역할 키가 존재하는지 확인 (admin-members 역할 배정 검증에 사용). 빌트인은 항상 true. */
export async function roleExists(key: string): Promise<boolean> {
  if (BUILTIN_KEYS.has(key)) return true;
  const db = getDb();
  const [row] = await db
    .select({ key: adminRoles.key })
    .from(adminRoles)
    .where(eq(adminRoles.key, key))
    .limit(1);
  return Boolean(row);
}

export async function registerAdminRolesRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /admin/roles ──────────────────────────────────────────────────────
  app.get("/admin/roles", { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const db = getDb();
    try {
      const dbRoles = await db.select().from(adminRoles);
      // 빌트인 + DB 병합 (key 기준 중복 제거). 빌트인 키는 항상 존재하며 locked 유지하되,
      // DB 에 같은 key 가 있으면 이름/설명은 DB 값을 우선한다.
      const byKey = new Map<string, { key: string; name: string; description: string; locked: boolean }>();
      for (const r of BUILTIN_ROLES) {
        byKey.set(r.key, { key: r.key, name: r.name, description: r.description, locked: true });
      }
      for (const r of dbRoles) {
        const isBuiltin = BUILTIN_KEYS.has(r.key);
        byKey.set(r.key, {
          key: r.key,
          name: r.name,
          description: r.description,
          locked: isBuiltin ? true : r.locked,
        });
      }

      // 역할별 관리자 수
      const counts = await db
        .select({ role: adminUsers.role, n: count() })
        .from(adminUsers)
        .groupBy(adminUsers.role);
      const countMap = new Map(counts.map((c) => [c.role, Number(c.n)]));

      return reply.send({
        roles: [...byKey.values()]
          // locked(고정) 먼저, 그다음 키순
          .sort((a, b) => Number(b.locked) - Number(a.locked) || a.key.localeCompare(b.key))
          .map((r) => ({
            key: r.key,
            name: r.name,
            description: r.description,
            locked: r.locked,
            memberCount: countMap.get(r.key) ?? 0,
          })),
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── POST /admin/roles ─────────────────────────────────────────────────────
  app.post("/admin/roles", { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const parsed = createRoleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." },
      });
    }
    const { key, name, description } = parsed.data;

    if (key === "staff" || key === "super_admin") {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "staff·super_admin 은 시스템 고정 역할이라 새로 만들 수 없습니다." },
      });
    }

    const db = getDb();
    try {
      if (await roleExists(key)) {
        return reply.status(409).send({
          error: { code: "CONFLICT", message: "이미 존재하는 역할 키입니다." },
        });
      }
      const now = new Date();
      const [created] = await db
        .insert(adminRoles)
        .values({ key, name, description, locked: false, createdAt: now, updatedAt: now })
        .returning();
      return reply.status(201).send({
        key: created.key,
        name: created.name,
        description: created.description,
        locked: created.locked,
        memberCount: 0,
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ── PATCH /admin/roles/:key ───────────────────────────────────────────────
  app.patch<{ Params: { key: string } }>(
    "/admin/roles/:key",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const parsed = updateRoleSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." },
        });
      }
      const { key } = request.params;
      const { name, description } = parsed.data;

      const db = getDb();
      try {
        if (!(await roleExists(key))) {
          return reply.status(404).send({ error: { code: "NOT_FOUND", message: "역할을 찾을 수 없습니다." } });
        }
        const [updated] = await db
          .update(adminRoles)
          .set({ name, description, updatedAt: new Date() })
          .where(eq(adminRoles.key, key))
          .returning();
        return reply.send({
          key: updated.key,
          name: updated.name,
          description: updated.description,
          locked: updated.locked,
        });
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );

  // ── DELETE /admin/roles/:key ──────────────────────────────────────────────
  app.delete<{ Params: { key: string } }>(
    "/admin/roles/:key",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { key } = request.params;
      const db = getDb();
      try {
        const [role] = await db.select().from(adminRoles).where(eq(adminRoles.key, key)).limit(1);
        if (!role) {
          return reply.status(404).send({ error: { code: "NOT_FOUND", message: "역할을 찾을 수 없습니다." } });
        }
        if (role.locked) {
          return reply.status(400).send({
            error: { code: "VALIDATION_ERROR", message: "고정 역할(마스터·운영자)은 삭제할 수 없습니다." },
          });
        }
        // 해당 역할을 사용 중인 관리자가 있으면 삭제 불가
        const [{ n }] = await db
          .select({ n: count() })
          .from(adminUsers)
          .where(eq(adminUsers.role, key));
        if (Number(n) > 0) {
          return reply.status(409).send({
            error: {
              code: "CONFLICT",
              message: `이 역할을 사용 중인 관리자가 ${n}명 있습니다. 먼저 다른 역할로 변경하세요.`,
            },
          });
        }
        await db.delete(adminRoles).where(eq(adminRoles.key, key));
        return reply.send({ key, deleted: true });
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
      }
    },
  );
}
