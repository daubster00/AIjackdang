/**
 * 관리자 신원 스키마 (ADR-0003).
 *
 * - users(사이트 회원)와 FK·공유 컬럼 없이 완전 분리.
 * - adminRole: staff(일반 운영자) | super_admin(최고 관리자)
 * - adminStatus: pending(승인 대기) | active | suspended | disabled
 * - admin_accounts: credential 전용 (소셜 연동 없음)
 */

import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ── Enum ──────────────────────────────────────────────────────────────────────

export const adminRole = pgEnum("admin_role", ["staff", "super_admin"]);
export const adminStatus = pgEnum("admin_status", ["pending", "active", "suspended", "disabled"]);

// ── admin_users ───────────────────────────────────────────────────────────────

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  role: adminRole("role").notNull().default("staff"),
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
});

export type AdminVerificationRow = typeof adminVerifications.$inferSelect;
export type NewAdminVerificationRow = typeof adminVerifications.$inferInsert;
