/**
 * recruit_post 스키마 — Story 2.12 작당 의뢰소 구인·외주 스펙
 *
 * posts 테이블과 1:1 관계 (post_id PK + FK, ON DELETE CASCADE).
 * board='gigs' 게시글에만 존재.
 *
 * post_kind: "request"(의뢰) | "offer"(구직)
 * fields: jsonb 배열 (분야 다중)
 * recruit_status: "open"(모집중) | "closed"(마감) DEFAULT "open"
 * contact_method: jsonb { types: string[], external?: string }
 */

import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { posts } from "./posts";

// ── Enums ─────────────────────────────────────────────────────────────────────

export const postKindEnum = pgEnum("post_kind_enum", ["request", "offer"]);
export const recruitStatusEnum = pgEnum("recruit_status_enum", ["open", "closed"]);
export const workModeEnum = pgEnum("work_mode_enum", ["remote", "onsite", "hybrid"]);

// ── recruit_post ──────────────────────────────────────────────────────────────

export const recruitPost = pgTable(
  "recruit_post",
  {
    // 1:1 FK — posts.id PK + CASCADE
    postId: uuid("post_id")
      .primaryKey()
      .references(() => posts.id, { onDelete: "cascade" }),

    // 글유형: 의뢰(request) | 구직(offer)
    postKind: postKindEnum("post_kind").notNull(),

    // 분야 다중 선택 (string[] jsonb)
    fields: jsonb("fields").notNull(),

    // 모집상태: 모집중(open) | 마감(closed)
    recruitStatus: recruitStatusEnum("recruit_status").notNull().default("open"),

    // 예산/희망단가 (선택)
    budget: text("budget"),

    // 작업기간/마감 (선택)
    duration: text("duration"),

    // 진행방식 (선택)
    workMode: workModeEnum("work_mode"),

    // 연락방법 { types: string[], external?: string }
    contactMethod: jsonb("contact_method").notNull(),

    // 타임스탬프
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // 복합 인덱스: (post_kind, recruit_status)
    index("idx_recruit_post_kind_status").on(t.postKind, t.recruitStatus),
    // GIN 인덱스: fields jsonb
    index("idx_recruit_post_fields").on(t.fields),
  ],
);

export type RecruitPostRow = typeof recruitPost.$inferSelect;
export type NewRecruitPostRow = typeof recruitPost.$inferInsert;
