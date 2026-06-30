/**
 * 운영자 계정 관리 서비스 레이어 (Story 9.4).
 *
 * approveAdmin, rejectAdmin, suspendAdmin, activateAdmin, changeAdminRole
 */

import { getDb } from "@ai-jakdang/database";
import { adminUsers, adminSessions } from "@ai-jakdang/database/schema";
import { eq } from "drizzle-orm";

// ── 승인 ──────────────────────────────────────────────────────────────────────

export async function approveAdmin(
  targetId: string,
  approverId: string,
  role: string,
  note: string,
) {
  const db = getDb();

  // 대상 관리자 확인
  const [target] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, targetId))
    .limit(1);

  if (!target) {
    throw Object.assign(new Error("관리자를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  if (target.status !== "pending") {
    throw Object.assign(
      new Error("승인 대기 상태의 관리자만 승인할 수 있습니다."),
      { code: "INVALID_STATUS" },
    );
  }

  const now = new Date();
  const [updated] = await db
    .update(adminUsers)
    .set({
      status: "active",
      role,
      approvedBy: approverId,
      approvedAt: now,
      note,
      updatedAt: now,
    })
    .where(eq(adminUsers.id, targetId))
    .returning();

  return updated;
}

// ── 반려 ──────────────────────────────────────────────────────────────────────

export async function rejectAdmin(targetId: string, note: string) {
  const db = getDb();

  const [target] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, targetId))
    .limit(1);

  if (!target) {
    throw Object.assign(new Error("관리자를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  if (target.status !== "pending") {
    throw Object.assign(
      new Error("승인 대기 상태의 관리자만 반려할 수 있습니다."),
      { code: "INVALID_STATUS" },
    );
  }

  const now = new Date();
  const [updated] = await db
    .update(adminUsers)
    .set({
      status: "disabled",
      note,
      updatedAt: now,
    })
    .where(eq(adminUsers.id, targetId))
    .returning();

  return updated;
}

// ── 정지 ──────────────────────────────────────────────────────────────────────

export async function suspendAdmin(targetId: string, note: string) {
  const db = getDb();

  const [target] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, targetId))
    .limit(1);

  if (!target) {
    throw Object.assign(new Error("관리자를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  if (target.status !== "active") {
    throw Object.assign(
      new Error("활성 상태의 관리자만 정지할 수 있습니다."),
      { code: "INVALID_STATUS" },
    );
  }

  const now = new Date();
  const [updated] = await db
    .update(adminUsers)
    .set({
      status: "suspended",
      note,
      updatedAt: now,
    })
    .where(eq(adminUsers.id, targetId))
    .returning();

  // 정지 시 해당 관리자의 모든 세션 삭제
  await db.delete(adminSessions).where(eq(adminSessions.adminUserId, targetId));

  return updated;
}

// ── 재활성 ────────────────────────────────────────────────────────────────────

export async function activateAdmin(targetId: string, note: string) {
  const db = getDb();

  const [target] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, targetId))
    .limit(1);

  if (!target) {
    throw Object.assign(new Error("관리자를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  if (target.status !== "suspended") {
    throw Object.assign(
      new Error("정지 상태의 관리자만 재활성화할 수 있습니다."),
      { code: "INVALID_STATUS" },
    );
  }

  const now = new Date();
  const [updated] = await db
    .update(adminUsers)
    .set({
      status: "active",
      note,
      updatedAt: now,
    })
    .where(eq(adminUsers.id, targetId))
    .returning();

  return updated;
}

// ── 역할 변경 ─────────────────────────────────────────────────────────────────

export async function changeAdminRole(
  targetId: string,
  requesterId: string,
  role: string,
  note: string,
) {
  // 자기 자신의 역할은 변경 불가
  if (targetId === requesterId) {
    throw Object.assign(
      new Error("자신의 역할을 변경할 수 없습니다."),
      { code: "FORBIDDEN_SELF" },
    );
  }

  const db = getDb();

  const [target] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, targetId))
    .limit(1);

  if (!target) {
    throw Object.assign(new Error("관리자를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const [updated] = await db
    .update(adminUsers)
    .set({
      role,
      note,
      updatedAt: now,
    })
    .where(eq(adminUsers.id, targetId))
    .returning();

  // 역할 변경 시 해당 관리자의 모든 세션 삭제 (권한 즉시 적용)
  await db.delete(adminSessions).where(eq(adminSessions.adminUserId, targetId));

  return updated;
}
