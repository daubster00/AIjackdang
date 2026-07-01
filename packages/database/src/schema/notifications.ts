/**
 * 알림 스키마 — Story 7.1
 *
 * notifications 테이블: 사용자별 알림 레코드.
 * notificationType pgEnum 8종 (inquiry.replied 포함 — Story 7.5 마이그레이션 충돌 방지 크로스 스토리 최적화).
 */

import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

// ── Enum ──────────────────────────────────────────────────────────────────────

/**
 * 알림 타입 — 8종.
 *
 * 원래 스토리 7.1 명세 7종 + `inquiry.replied`(Story 7.5)를 처음부터 포함.
 * → Story 7.5에서 enum 추가용 2차 마이그레이션 불필요 (크로스 스토리 최적화).
 */
export const notificationType = pgEnum("notification_type", [
  "comment.created",
  "answer.created",
  "comment.replied",
  "reaction.received",
  "helpful_answer.marked",
  "message.received",
  "sanction.applied",
  "inquiry.replied",
]);

// ── notifications ─────────────────────────────────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    /** 대상 엔티티 종류 (예: 'post', 'comment', 'question') */
    targetType: text("target_type"),
    /**
     * 대상 엔티티 ID.
     * text 타입 — 게시글/댓글은 UUID, 질문(question)은 slug 문자열을 저장한다.
     * (질문 알림 URL은 /questions/{slug} 이므로 slug 보관 필요 — 0026 마이그레이션에서 uuid→text 정합화)
     */
    targetId: text("target_id"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_id_idx").on(t.userId),
    index("notifications_created_at_idx").on(t.createdAt),
    index("notifications_is_read_idx").on(t.isRead),
  ],
);

export type NotificationRow = typeof notifications.$inferSelect;
export type NewNotificationRow = typeof notifications.$inferInsert;
