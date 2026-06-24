/**
 * 게이미피케이션 스키마 — Epic 6.
 *
 * points_ledger · grades · badges · user_badges 테이블.
 * 포인트 원장은 적립/차감 이벤트 행으로 관리한다 (Event Sourcing 패턴).
 */

import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

// ── points_ledger ──────────────────────────────────────────────────────────────

/**
 * 포인트 원장.
 * delta 양수 = 적립, 음수 = 회수.
 * reason 은 'domain.action' 형식 문자열(예: 'post.created').
 */
export const pointsLedger = pgTable(
  "points_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    /** 'post.created' | 'answer.created' | 'comment.created' | 'resource.created' | 'reaction.received' | 'download.given' 등 */
    reason: text("reason").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("points_ledger_user_id_idx").on(t.userId),
    index("points_ledger_created_at_idx").on(t.createdAt),
    index("points_ledger_reason_idx").on(t.reason),
  ],
);

export type PointsLedgerRow = typeof pointsLedger.$inferSelect;
export type NewPointsLedgerRow = typeof pointsLedger.$inferInsert;

// ── grades ────────────────────────────────────────────────────────────────────

/**
 * 등급 테이블.
 * level 1~5 고정값. max_points 는 최고 등급(Lv5)에서 null.
 */
export const grades = pgTable(
  "grades",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    level: integer("level").notNull().unique(),
    name: text("name").notNull(),
    minPoints: integer("min_points").notNull(),
    maxPoints: integer("max_points"),
  },
  (t) => [index("grades_level_idx").on(t.level)],
);

export type GradeTableRow = typeof grades.$inferSelect;
export type NewGradeTableRow = typeof grades.$inferInsert;

// ── badges ────────────────────────────────────────────────────────────────────

/**
 * 뱃지 마스터 테이블.
 * is_auto=true: 자동 수여 조건 달성 시 부여.
 * is_auto=false: 운영자가 수동 부여.
 */
export const badges = pgTable(
  "badges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    iconUrl: text("icon_url").notNull(),
    isAuto: boolean("is_auto").notNull().default(true),
  },
  (t) => [index("badges_slug_idx").on(t.slug)],
);

export type BadgeTableRow = typeof badges.$inferSelect;
export type NewBadgeTableRow = typeof badges.$inferInsert;

// ── user_badges ───────────────────────────────────────────────────────────────

/**
 * 사용자 보유 뱃지.
 * granted_by: 자동 수여 시 null, 운영자 수여 시 admin user id.
 * (user_id, badge_id) UNIQUE — 중복 수여 방지.
 */
export const userBadges = pgTable(
  "user_badges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    badgeId: uuid("badge_id")
      .notNull()
      .references(() => badges.id, { onDelete: "cascade" }),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    /** 운영자 수여 시 운영자 user id, 자동 수여 시 null */
    grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("user_badges_user_badge_unique_idx").on(t.userId, t.badgeId),
    index("user_badges_user_id_idx").on(t.userId),
  ],
);

export type UserBadgeRow = typeof userBadges.$inferSelect;
export type NewUserBadgeRow = typeof userBadges.$inferInsert;
