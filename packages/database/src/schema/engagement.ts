/**
 * 다형 참여(engagement) 스키마 — Epic 5.
 *
 * comment · reaction · bookmark · report · block · follows 테이블.
 * 모든 참여 테이블은 (target_type, target_id) 복합 키로 다형 참조한다(AR-6).
 */

import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

// ── Enums ─────────────────────────────────────────────────────────────────────

export const commentTargetType = pgEnum("comment_target_type", [
  "post",
  "question",
  "answer",
  "resource",
  "comment",
]);

export const commentStatus = pgEnum("comment_status", ["visible", "deleted"]);

export const reactionTargetType = pgEnum("reaction_target_type", [
  "post",
  "question",
  "answer",
  "resource",
  "comment",
]);

export const reactionType = pgEnum("reaction_type", ["like", "dislike"]);

export const bookmarkTargetType = pgEnum("bookmark_target_type", [
  "post",
  "question",
  "resource",
]);

export const reportTargetType = pgEnum("report_target_type", [
  "post",
  "question",
  "answer",
  "resource",
  "comment",
]);

export const reportStatus = pgEnum("report_status", [
  "pending",
  "reviewing",
  "resolved",
  "dismissed",
]);

// ── comments ──────────────────────────────────────────────────────────────────

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    targetType: commentTargetType("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    parentId: uuid("parent_id"),
    content: text("content").notNull(),
    status: commentStatus("status").notNull().default("visible"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_comments_target").on(t.targetType, t.targetId)],
);

export type CommentRow = typeof comments.$inferSelect;
export type NewCommentRow = typeof comments.$inferInsert;

// ── reactions ─────────────────────────────────────────────────────────────────

export const reactions = pgTable(
  "reactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    targetType: reactionTargetType("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reactionType: reactionType("reaction_type").notNull().default("like"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_reactions_target").on(t.targetType, t.targetId),
    uniqueIndex("idx_reactions_unique").on(
      t.userId,
      t.targetType,
      t.targetId,
      t.reactionType,
    ),
  ],
);

export type ReactionRow = typeof reactions.$inferSelect;
export type NewReactionRow = typeof reactions.$inferInsert;

// ── bookmarks ─────────────────────────────────────────────────────────────────

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    targetType: bookmarkTargetType("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bookmarks_target").on(t.targetType, t.targetId),
    uniqueIndex("idx_bookmarks_unique").on(t.userId, t.targetType, t.targetId),
  ],
);

export type BookmarkRow = typeof bookmarks.$inferSelect;
export type NewBookmarkRow = typeof bookmarks.$inferInsert;

// ── reports ───────────────────────────────────────────────────────────────────

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id),
    targetType: reportTargetType("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reasonCode: text("reason_code").notNull(),
    detail: text("detail"),
    status: reportStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_reports_target").on(t.targetType, t.targetId)],
);

export type ReportRow = typeof reports.$inferSelect;
export type NewReportRow = typeof reports.$inferInsert;

// ── blocks ────────────────────────────────────────────────────────────────────

export const blocks = pgTable(
  "blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("idx_blocks_unique").on(t.blockerId, t.blockedId)],
);

export type BlockRow = typeof blocks.$inferSelect;
export type NewBlockRow = typeof blocks.$inferInsert;

// ── follows ───────────────────────────────────────────────────────────────────

export const follows = pgTable(
  "follows",
  {
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id),
    followingId: uuid("following_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followingId] }),
    index("idx_follows_follower").on(t.followerId),
    index("idx_follows_following").on(t.followingId),
    check("chk_no_self_follow", sql`follower_id <> following_id`),
  ],
);

export type FollowRow = typeof follows.$inferSelect;
export type NewFollowRow = typeof follows.$inferInsert;
