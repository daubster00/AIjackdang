/**
 * Q&A 도메인 스키마 — AR-6 다형성 모델 / AR-7 soft-delete / AR-8 content_json
 *
 * 마이그레이션 순서 주의 (AC #3):
 *   answers 테이블을 먼저 생성해야 questions.helpful_answer_id → answers.id FK 가 성립한다.
 *   drizzle-kit 은 파일 내 선언 순서를 기준으로 DDL 를 생성하므로 이 파일에서
 *   answers 를 questions 보다 위에 선언한다.
 *
 * taggable 다형 참조 설계 (AC #4):
 *   질문↔태그 연결은 Epic 2 / Story 2.x 에서 소유하는 `taggable` 테이블을 재사용한다.
 *   taggable.target_type = 'question', taggable.target_id = questions.id 로 연결.
 *   현재 taggable 테이블이 미존재하므로 실제 FK 는 이 파일에 없으며, 향후 Epic 2·5 에서 생성 예정.
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
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

// ── Enum ──────────────────────────────────────────────────────────────────────

/** 질문 상태. DB enum 값. UI 표시는 packages/core/src/qna.ts deriveQuestionStatus 로 도출. */
export const questionStatus = pgEnum("question_status", [
  "draft",
  "published",
  "hidden",
  "deleted",
]);

/** 답변 상태. soft-delete 포함(AR-7). */
export const answerStatus = pgEnum("answer_status", ["published", "hidden", "deleted"]);

// ── answers ───────────────────────────────────────────────────────────────────
// questions.helpful_answer_id → answers.id FK 가 있으므로 answers 를 먼저 선언한다.

export const answers = pgTable(
  "answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** 소속 질문 (cascade delete: 질문 삭제 시 답변도 삭제) */
    questionId: uuid("question_id")
      .notNull()
      .references((): AnyPgColumn => questions.id, { onDelete: "cascade" }),

    /** 작성자 (탈퇴 시 null — SET NULL) */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),

    /** 답변 본문 — Tiptap JSON 전용 (HTML 저장 절대 금지, AR-8) */
    contentJson: jsonb("content_json").notNull(),

    /** 운영 상태 (AR-7 soft-delete) */
    status: answerStatus("status").notNull().default("published"),

    /** soft-delete 타임스탬프 (null = 살아있는 답변) */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("answers_question_id_idx").on(t.questionId),
    index("answers_user_id_idx").on(t.userId),
    index("answers_status_idx").on(t.status),
    index("answers_created_at_idx").on(t.createdAt),
  ],
);

export type AnswerRow = typeof answers.$inferSelect;
export type NewAnswerRow = typeof answers.$inferInsert;

// ── questions ─────────────────────────────────────────────────────────────────

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** 작성자 (탈퇴 시 null — SET NULL) */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),

    title: varchar("title", { length: 300 }).notNull(),

    /**
     * SEO URL 슬러그 — posts.slug 와 동일 컨벤션(프로젝트 전역 slug 기반 라우팅).
     * `/questions/{slug}` 라우팅·canonical·QAPage JSON-LD(Story 3.2/3.5/3.9)에서 사용.
     * 서버가 slugify(title) → generateUniqueSlug(중복 시 -{nanoid6}) 로 생성.
     */
    slug: varchar("slug", { length: 350 }).notNull().unique(),

    /** 질문 본문 — Tiptap JSON 전용 (HTML 저장 절대 금지, AR-8) */
    contentJson: jsonb("content_json").notNull(),

    /**
     * 질문자가 직접 "해결됨" 표시한 플래그.
     * helpful_answer_id 와 독립: 도움된 답변 지정이 자동 해결을 의미하지 않음.
     * deriveQuestionStatus 호출 시 is_resolved=true → acceptedAnswerId=<non-null> 로 매핑.
     */
    isResolved: boolean("is_resolved").notNull().default(false),

    /**
     * 질문자가 지정한 "도움된 답변" FK → answers.id (nullable).
     * questions.helpful_answer_id → answers.id 참조: answers 테이블이 먼저 생성되어야 함(AC #3).
     * 순환처럼 보이지만 (answers.question_id → questions.id) 와 방향이 다름.
     *
     * taggable 연결:
     *   taggable.target_type = 'question', taggable.target_id = this.id 로 태그 연결.
     *   taggable 테이블은 Epic 2 / Story 2.x 에서 생성 예정이므로 여기서는 FK 없이 설계적으로만 명시.
     */
    helpfulAnswerId: uuid("helpful_answer_id").references((): AnyPgColumn => answers.id, {
      onDelete: "set null",
    }),

    viewCount: integer("view_count").notNull().default(0),

    // 전문 검색 — pg_bigm GIN 인덱스 대상 (Story 8.1, AR-5)
    searchVector: text("search_vector").generatedAlwaysAs(
      sql`title || ' ' || coalesce(content_json::text, '')`,
    ),

    /** 운영 상태 (AR-7 soft-delete) */
    status: questionStatus("status").notNull().default("published"),

    /** soft-delete 타임스탬프 (null = 살아있는 질문) */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("questions_slug_uq").on(t.slug),
    index("questions_user_id_idx").on(t.userId),
    index("questions_status_idx").on(t.status),
    index("questions_is_resolved_idx").on(t.isResolved),
    index("questions_created_at_idx").on(t.createdAt),
  ],
);

export type QuestionRow = typeof questions.$inferSelect;
export type NewQuestionRow = typeof questions.$inferInsert;
