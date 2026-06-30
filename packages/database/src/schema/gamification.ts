/**
 * 게이미피케이션 스키마 — Epic 6.
 *
 * points_ledger · grades 테이블.
 * 포인트 원장은 적립/차감 이벤트 행으로 관리한다 (Event Sourcing 패턴).
 *
 * (업적 뱃지(badges·user_badges)는 수정요청으로 전면 제거됨 — 마이그 0023.)
 */

import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
    /** 등급 뱃지 이미지 URL (관리자 업로드, 없으면 level 기반 정적 에셋 폴백) */
    imageUrl: text("image_url"),
  },
  (t) => [index("grades_level_idx").on(t.level)],
);

export type GradeTableRow = typeof grades.$inferSelect;
export type NewGradeTableRow = typeof grades.$inferInsert;
