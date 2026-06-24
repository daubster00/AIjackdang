/**
 * 게시글(posts) 스키마 — AR-6 다형성 모델
 *
 * post 단일 테이블을 board/category 조합으로 인스턴스화.
 * 본문은 Tiptap JSON(content_json)으로만 저장 — HTML 원본 금지(AR-5).
 * soft-delete: status enum + deleted_at (AR-7).
 * view_count는 직접 UPDATE 금지 — Redis 버퍼 → worker flush (Story 2.4).
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

// ── Enum ──────────────────────────────────────────────────────────────────────

export const postStatus = pgEnum("post_status", ["draft", "published", "hidden", "deleted"]);

// ── posts ─────────────────────────────────────────────────────────────────────

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // 작성자 (탈퇴 시 null — ON DELETE SET NULL)
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),

    // 게시판 분류 (AR-6 다형성 — board slug)
    board: varchar("board", { length: 50 }).notNull(),
    category: varchar("category", { length: 50 }),

    // 제목 / slug
    title: varchar("title", { length: 300 }).notNull(),
    slug: varchar("slug", { length: 350 }).notNull().unique(),

    // 본문 — Tiptap JSON 전용 (HTML 저장 절대 금지)
    contentJson: jsonb("content_json").notNull(),

    // 요약 (Story 2.2 generateSummary()가 자동 생성 — 현재 nullable)
    summary: varchar("summary", { length: 500 }),

    // 운영 상태 (AR-7 soft-delete)
    status: postStatus("status").notNull().default("draft"),

    // 관리 플래그
    // isPinned = 고정(sticky). 공지 핀·게시판 상단 고정에 재사용(Story 2.9·9.6).
    isPinned: boolean("is_pinned").notNull().default(false),
    // 어드민 운영 플래그 (Story 9.6) — 공지/추천/메인노출. 고정은 isPinned 재사용.
    isNotice: boolean("is_notice").notNull().default(false),
    isFeatured: boolean("is_featured").notNull().default(false),
    isMainFeatured: boolean("is_main_featured").notNull().default(false),

    // SEO (architecture.md 2026-06-22 보강분)
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),

    // 통계 — 직접 UPDATE 금지, Redis 버퍼 경유 (Story 2.4)
    viewCount: integer("view_count").notNull().default(0),

    // 전문 검색 — pg_bigm GIN 인덱스 대상 (Story 8.1, AR-5)
    // text GENERATED ALWAYS AS STORED: title || ' ' || coalesce(content_json::text, '')
    searchVector: text("search_vector").generatedAlwaysAs(
      sql`title || ' ' || coalesce(content_json::text, '')`,
    ),

    // 공통 타임스탬프
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("posts_user_id_idx").on(t.userId),
    index("posts_board_idx").on(t.board),
    index("posts_status_idx").on(t.status),
    index("posts_board_status_idx").on(t.board, t.status),
    uniqueIndex("posts_slug_uq").on(t.slug),
    index("posts_created_at_idx").on(t.createdAt),
  ],
);

export type PostRow = typeof posts.$inferSelect;
export type NewPostRow = typeof posts.$inferInsert;
