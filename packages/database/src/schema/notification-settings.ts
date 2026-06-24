/**
 * 알림 설정 스키마 — Story 7.1
 *
 * notification_settings 테이블: 사용자별 알림 타입 on/off 설정.
 * settings jsonb 기본값: 7종 모두 true (sanction.applied 는 7.3 UI에서 비활성 표시).
 * inquiry.replied 는 설정 UI 대상이 아니므로 기본값에 포함하지 않는다.
 */

import { index, jsonb, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

// ── 기본 설정값 ───────────────────────────────────────────────────────────────

export const DEFAULT_NOTIFICATION_SETTINGS = {
  "comment.created": true,
  "answer.created": true,
  "comment.replied": true,
  "reaction.received": true,
  "helpful_answer.marked": true,
  "message.received": true,
  "sanction.applied": true,
} as const;

export type NotificationSettingsJson = {
  "comment.created"?: boolean;
  "answer.created"?: boolean;
  "comment.replied"?: boolean;
  "reaction.received"?: boolean;
  "helpful_answer.marked"?: boolean;
  "message.received"?: boolean;
  "sanction.applied"?: boolean;
  "inquiry.replied"?: boolean;
  [key: string]: boolean | undefined;
};

// ── notification_settings ─────────────────────────────────────────────────────

export const notificationSettings = pgTable(
  "notification_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    settings: jsonb("settings")
      .notNull()
      .$type<NotificationSettingsJson>()
      .default(DEFAULT_NOTIFICATION_SETTINGS),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("notification_settings_user_id_unique").on(t.userId),
    index("notification_settings_user_id_idx").on(t.userId),
  ],
);

export type NotificationSettingsRow = typeof notificationSettings.$inferSelect;
export type NewNotificationSettingsRow = typeof notificationSettings.$inferInsert;
