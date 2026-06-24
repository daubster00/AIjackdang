/**
 * 쪽지(1:1 메시지) 스키마 — Story 7.1
 *
 * messages 테이블: 사용자 간 1:1 쪽지.
 * 본문 길이 제한(500자)은 앱 레벨에서 검증 (DB 레벨 불필요).
 */

import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

// ── messages ──────────────────────────────────────────────────────────────────

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    receiverId: uuid("receiver_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    /** 발신자가 대화함을 삭제했는지 여부 */
    deletedBySender: boolean("deleted_by_sender").notNull().default(false),
    /** 수신자가 대화함을 삭제했는지 여부 */
    deletedByReceiver: boolean("deleted_by_receiver").notNull().default(false),
    /** [9.18] 운영자가 모더레이션으로 숨긴 쪽지 (발신·수신 양쪽 비노출) */
    hiddenByAdmin: boolean("hidden_by_admin").notNull().default(false),
    /** [9.18] 운영자 soft-delete 시각 (30일 후 cleanup worker hard-delete) */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_sender_id_idx").on(t.senderId),
    index("messages_receiver_id_idx").on(t.receiverId),
    index("messages_created_at_idx").on(t.createdAt),
  ],
);

export type MessageRow = typeof messages.$inferSelect;
export type NewMessageRow = typeof messages.$inferInsert;
