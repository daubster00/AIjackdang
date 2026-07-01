/**
 * 유저 인증 스키마 (ADR-0002).
 *
 * users.password_hash 는 없음 — 비밀번호는 accounts.password(Argon2id)에만 저장.
 * 포인트·등급: users 에 저장하지 않고 points_ledger + packages/core 로 도출.
 * 관리자 테이블(admin_users 등)은 packages/database/src/schema/admin.ts 에 별도 분리(ADR-0003).
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ── Enum ──────────────────────────────────────────────────────────────────────

export const userStatus = pgEnum("user_status", ["active", "suspended", "withdrawn"]);

/** 성별 (회원정보 — 선택 입력). 'male'|'female'|'other'. */
export const userGender = pgEnum("user_gender", ["male", "female", "other"]);

export const sanctionType = pgEnum("sanction_type", [
  "warning",
  "suspend",
  "permaban",
  // [9.18] 쪽지 발신만 제한 (계정 정지와 독립)
  "message_restriction",
]);

// ── users ─────────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // 인증 핵심 필드 (Better Auth 필수)
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    /** Better Auth 코어 필드. 이메일 가입 시 이메일, 소셜 가입 시 provider 프로필명으로 채워진다.
     *  사용자 표시 이름은 nickname 을 쓰며, name 은 Better Auth 내부 정합을 위해 보존한다. */
    name: text("name"),

    // 프로필 필드
    nickname: text("nickname").notNull().unique(),
    image: text("image"),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    bannerUrl: text("banner_url"),
    /** jsonb: [{label: string, url: string}] 형식 */
    links: jsonb("links"),
    /** 기본 아바타 인덱스 (0~N). avatarUrl 이 없을 때 사용. */
    defaultAvatarIndex: integer("default_avatar_index").notNull().default(0),
    /** 계정 페이지에 노출할 사용자가 직접 선택한 글 id 배열(본인 글 중에서). jsonb: string[] */
    featuredPostIds: jsonb("featured_post_ids").notNull().default(sql`'[]'::jsonb`),

    // 상태
    status: userStatus("status").notNull().default("active"),
    suspendedUntil: timestamp("suspended_until", { withTimezone: true }),

    /** 봇 계정 여부 (Epic 11 시딩 봇). true 면 통계·랭킹 제외 필터의 기준이 된다. */
    isBot: boolean("is_bot").notNull().default(false),

    // 회원정보 (수정요청 F — 휴대폰 필수, 성별·생년월일 선택)
    /** 휴대폰 번호. 회원정보 화면에서 필수 입력(기존 사용자는 null 가능). */
    phone: text("phone"),
    /** 성별 (선택). */
    gender: userGender("gender"),
    /** 생년월일 (선택). 'YYYY-MM-DD'. */
    birthDate: date("birth_date"),

    // 약관 동의
    termsAgreedAt: timestamp("terms_agreed_at", { withTimezone: true }),
    termsVersion: text("terms_version"),
    /** 마케팅 수신 동의 시각 (선택). null 이면 미동의. */
    marketingAgreedAt: timestamp("marketing_agreed_at", { withTimezone: true }),

    // 공통 타임스탬프
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("users_email_idx").on(t.email),
    index("users_nickname_idx").on(t.nickname),
    index("users_status_idx").on(t.status),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

// ── sessions ──────────────────────────────────────────────────────────────────

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sessions_user_id_idx").on(t.userId),
    index("sessions_token_idx").on(t.token),
  ],
);

export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;

// ── accounts ──────────────────────────────────────────────────────────────────
// 소셜·credential 계정 연결. password 는 credential providerId 일 때만 설정(Argon2id 해시).

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** 'credential' | 'google' | 'naver' | 'kakao' */
    providerId: text("provider_id").notNull(),
    accountId: text("account_id").notNull(),
    /** credential 일 때 Argon2id 해시. 소셜 계정은 null. */
    password: text("password"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("accounts_provider_account_uq").on(t.providerId, t.accountId),
    index("accounts_user_id_idx").on(t.userId),
  ],
);

export type AccountRow = typeof accounts.$inferSelect;
export type NewAccountRow = typeof accounts.$inferInsert;

// ── verifications ─────────────────────────────────────────────────────────────
// 이메일 인증 토큰 등 임시 검증 코드 저장.

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

export type VerificationRow = typeof verifications.$inferSelect;
export type NewVerificationRow = typeof verifications.$inferInsert;

// ── user_sanctions ────────────────────────────────────────────────────────────
// 회원 제재 이력. issuedBy 는 admin_users.id (FK 대신 id 보관 — 완전 분리 원칙).

export const userSanctions = pgTable(
  "user_sanctions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: sanctionType("type").notNull(),
    reason: text("reason").notNull(),
    /** 처리 관리자 admin_users.id — 크로스 도메인 FK 대신 id 값만 보관 */
    issuedBy: uuid("issued_by"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("user_sanctions_user_id_idx").on(t.userId),
    index("user_sanctions_type_idx").on(t.type),
  ],
);

export type UserSanctionRow = typeof userSanctions.$inferSelect;
export type NewUserSanctionRow = typeof userSanctions.$inferInsert;
