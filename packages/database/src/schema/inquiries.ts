/**
 * 1:1 문의 스키마 — Story 7.1
 *
 * inquiries 테이블: 사용자가 관리자에게 보내는 1:1 문의.
 * body 는 Tiptap JSON (jsonb).
 */

import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

// ── Enum ──────────────────────────────────────────────────────────────────────

export const inquiryStatus = pgEnum("inquiry_status", ["pending", "in_progress", "resolved"]);

// ── inquiries ─────────────────────────────────────────────────────────────────

export const inquiries = pgTable(
  "inquiries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** Tiptap JSON 본문 */
    body: jsonb("body").notNull(),
    status: inquiryStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("inquiries_user_id_idx").on(t.userId),
    index("inquiries_status_idx").on(t.status),
    index("inquiries_created_at_idx").on(t.createdAt),
  ],
);

export type InquiryRow = typeof inquiries.$inferSelect;
export type NewInquiryRow = typeof inquiries.$inferInsert;
