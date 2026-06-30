/**
 * 관리자 신원 스키마 (ADR-0003).
 *
 * - users(사이트 회원)와 FK·공유 컬럼 없이 완전 분리.
 * - role: text — staff/super_admin 은 고정 기본 역할(locked), 그 외 커스텀 역할은
 *   admin_roles 테이블에서 자유롭게 추가/수정/삭제 가능 (M12). enum 이 아닌 text.
 * - adminStatus: pending(승인 대기) | active | suspended | disabled
 * - admin_accounts: credential 전용 (소셜 연동 없음)
 */

import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ── Enum ──────────────────────────────────────────────────────────────────────

export const adminStatus = pgEnum("admin_status", ["pending", "active", "suspended", "disabled"]);

// ── admin_users ───────────────────────────────────────────────────────────────

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  /** Better Auth 코어 필드 — 관리자는 이메일 인증을 쓰지 않아 항상 true 로 둔다. */
  emailVerified: boolean("email_verified").notNull().default(true),
  name: text("name").notNull(),
  /** Better Auth 코어 user 필드(프로필 이미지). 관리자는 미사용이라 nullable. */
  image: text("image"),
  phone: text("phone").notNull(),
  /** 역할 키 — admin_roles.key 참조(논리적). staff/super_admin 고정 + 커스텀 역할(M12). */
  role: text("role").notNull().default("staff"),
  status: adminStatus("status").notNull().default("pending"),
  /** 승인한 관리자 admin_users.id — 크로스 도메인 FK 대신 id 값만 보관 (ADR-0003 §5) */
  approvedBy: uuid("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminUserRow = typeof adminUsers.$inferSelect;
export type NewAdminUserRow = typeof adminUsers.$inferInsert;

// ── admin_sessions ────────────────────────────────────────────────────────────

export const adminSessions = pgTable("admin_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminUserId: uuid("admin_user_id")
    .notNull()
    .references(() => adminUsers.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** Better Auth 코어 session 필드. */
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminSessionRow = typeof adminSessions.$inferSelect;
export type NewAdminSessionRow = typeof adminSessions.$inferInsert;

// ── admin_accounts ────────────────────────────────────────────────────────────
// credential 전용. password = Argon2id 해시.

export const adminAccounts = pgTable(
  "admin_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull().default("credential"),
    accountId: text("account_id").notNull(),
    /** Argon2id 해시 비밀번호. 항상 non-null (credential only). */
    password: text("password"),
    /** Better Auth 코어 account 필드(소셜 토큰). credential 전용이라 항상 null 이지만 스키마 정합 위해 보유. */
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    providerAccountUq: uniqueIndex("admin_accounts_provider_account_uq").on(
      t.providerId,
      t.accountId,
    ),
  }),
);

export type AdminAccountRow = typeof adminAccounts.$inferSelect;
export type NewAdminAccountRow = typeof adminAccounts.$inferInsert;

// ── admin_verifications ───────────────────────────────────────────────────────

export const adminVerifications = pgTable("admin_verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** Better Auth 코어 verification 필드. */
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminVerificationRow = typeof adminVerifications.$inferSelect;
export type NewAdminVerificationRow = typeof adminVerifications.$inferInsert;

// ── admin_role_permissions ──────────────────────────────────────────────────
/**
 * 역할별 권한 오버라이드 — 권한 설정 화면에서 토글한 결과를 영속한다.
 * (role, action) 복합 PK. 행이 없으면 코드 기본값(permissions.ts)을 따른다.
 */
export const adminRolePermissions = pgTable(
  "admin_role_permissions",
  {
    role: text("role").notNull(),
    action: text("action").notNull(),
    allowed: boolean("allowed").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: uniqueIndex("admin_role_permissions_pk").on(t.role, t.action),
  }),
);

export type AdminRolePermissionRow = typeof adminRolePermissions.$inferSelect;
export type NewAdminRolePermissionRow = typeof adminRolePermissions.$inferInsert;

// ── admin_roles ───────────────────────────────────────────────────────────────
/**
 * 관리자 역할 정의 (M12).
 * - staff/super_admin 은 시스템 고정 역할(locked=true, 삭제 불가).
 * - 그 외 커스텀 역할은 super_admin 이 자유롭게 추가/수정/삭제할 수 있다.
 * - 각 역할의 액션 권한은 admin_role_permissions(role,action) 오버라이드로 구성한다.
 *   super_admin 은 항상 모든 권한 보유(오버라이드 무시).
 */
export const adminRoles = pgTable("admin_roles", {
  /** 역할 키 — 영문 slug. admin_users.role / admin_role_permissions.role 가 참조. */
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  /** 고정 역할 여부 — staff/super_admin 만 true. true 면 삭제·키변경 불가. */
  locked: boolean("locked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminRoleRow = typeof adminRoles.$inferSelect;
export type NewAdminRoleRow = typeof adminRoles.$inferInsert;
