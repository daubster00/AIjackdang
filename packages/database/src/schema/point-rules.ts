/**
 * 포인트 규칙 스키마 — Story 9.13.
 *
 * point_rules: 활동 유형별 지급 포인트 규칙을 코드 재배포 없이 관리.
 * 게이미피케이션 적립 로직(packages/core)은 기본값을 쓰되, 운영자가 이 표로 조정한다.
 */

import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// ── point_rules ─────────────────────────────────────────────────────────────────

export const pointRules = pgTable("point_rules", {
  /** 활동 식별자 (예: 'post_create', 'comment_create', 'answer_helpful') */
  actionType: text("action_type").primaryKey(),
  /** 지급 포인트 */
  points: integer("points").notNull().default(0),
  /** 화면 표시용 설명 */
  description: text("description").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PointRuleRow = typeof pointRules.$inferSelect;
export type NewPointRuleRow = typeof pointRules.$inferInsert;
