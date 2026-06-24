/**
 * 문의 답변 스키마 — Story 7.1
 *
 * inquiry_replies 테이블: 1:1 문의에 대한 답변 (사용자 또는 관리자).
 * body 는 Tiptap JSON (jsonb).
 * author_id 는 users 또는 admin_users를 가리키므로 FK 없이 uuid로만 저장.
 */

import { index, jsonb, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { inquiries } from "./inquiries";

// ── Enum ──────────────────────────────────────────────────────────────────────

export const authorType = pgEnum("author_type", ["user", "admin"]);

// ── inquiry_replies ───────────────────────────────────────────────────────────

export const inquiryReplies = pgTable(
  "inquiry_replies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    inquiryId: uuid("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    /** 작성자 종류: 'user' | 'admin' */
    authorType: authorType("author_type").notNull(),
    /** users.id 또는 admin_users.id — 다형 참조이므로 FK 없이 uuid 저장 */
    authorId: uuid("author_id").notNull(),
    /** Tiptap JSON 본문 */
    body: jsonb("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("inquiry_replies_inquiry_id_idx").on(t.inquiryId),
    index("inquiry_replies_created_at_idx").on(t.createdAt),
  ],
);

export type InquiryReplyRow = typeof inquiryReplies.$inferSelect;
export type NewInquiryReplyRow = typeof inquiryReplies.$inferInsert;
