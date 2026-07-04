/**
 * Epic 13: 가이드 커리큘럼 스키마.
 *
 * 관리자 봇 가이드 강의 커리큘럼을 정식 DB 테이블로 승격한다.
 * 프로토타입(curriculum.ts 코드 파일 + bot_settings jsonb)을 아래 3개 테이블로 이관.
 *
 * 설계 원칙:
 *  - 크로스 도메인(posts.id) 참조는 FK 미설정, uuid 값만 저장(기존 bot.ts 패턴).
 *  - chapters.continuity_summary: guide_progress.summaries[N] 이관 대상(연속성 요약).
 *  - image_slots.(chapter_id, asset_key) unique: 챕터 내 assetKey 중복 방지.
 *  - series.title unique: guide_progress 키 및 ON CONFLICT 시드 기준.
 *
 * [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#4]
 */

import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// ── pgEnum 정의 ──────────────────────────────────────────────────────────────

/** 챕터 수명주기 상태. */
export const botCurriculumChapterStatus = pgEnum("bot_curriculum_chapter_status", [
  "planned",
  "drafted",
  "ready",
  "published",
  "skipped",
]);

/** 슬롯 이미지 출처 종류. */
export const botCurriculumSlotSourceKind = pgEnum("bot_curriculum_slot_source_kind", [
  "ai_diagram",
  "web_download",
  "capture",
  "user_upload",
]);

/** 슬롯 준비 상태. */
export const botCurriculumSlotStatus = pgEnum("bot_curriculum_slot_status", [
  "pending",
  "ready",
]);

// ── bot_curriculum_series (시리즈 헤더) ───────────────────────────────────────
// 다른 테이블이 series_id FK로 참조하므로 가장 먼저 정의한다.

export const botCurriculumSeries = pgTable(
  "bot_curriculum_series",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 표시·식별 제목(guide_progress 키 기준, unique). */
    title: text("title").notNull(),
    /** 대상 게시판 슬러그(BOARDS 키). */
    board: text("board").notNull(),
    /** 주력 도구명(프롬프트 맥락). */
    tool: text("tool").notNull(),
    /** 한 줄 소개(1강 도입·프롬프트 맥락). */
    intro: text("intro").notNull(),
    /** 활성 여부. */
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    titleUq: unique("bot_curriculum_series_title_uq").on(t.title),
  }),
);

export type BotCurriculumSeriesRow = typeof botCurriculumSeries.$inferSelect;
export type NewBotCurriculumSeriesRow = typeof botCurriculumSeries.$inferInsert;

// ── bot_curriculum_chapters (챕터 = 편) ───────────────────────────────────────

export const botCurriculumChapters = pgTable(
  "bot_curriculum_chapters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 시리즈 FK. */
    seriesId: uuid("series_id")
      .notNull()
      .references(() => botCurriculumSeries.id, { onDelete: "cascade" }),
    /** 1-based 편 번호. */
    orderIndex: integer("order_index").notNull(),
    /** 편 소제목. */
    title: text("title").notNull(),
    /** 학습목표. */
    goal: text("goal").notNull(),
    /** 소주제 배열. */
    outline: jsonb("outline").notNull().default([]),
    /** Tiptap JSON 초안(생성 전 null). */
    draftContent: jsonb("draft_content"),
    /** 사람이 수정한 본문 텍스트. */
    draftTextEditable: text("draft_text_editable"),
    /**
     * 연속성 요약(다음 편 프롬프트 주입용).
     * guide_progress.summaries[String(order)] 이관 대상.
     */
    continuitySummary: text("continuity_summary"),
    /** 챕터 수명주기 상태. */
    status: botCurriculumChapterStatus("status").notNull().default("planned"),
    /** 챕터별 예약 게시 시각(null=미예약). */
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    /** 게시 결과 포스트 ID(크로스도메인, FK 미설정). */
    publishedPostId: uuid("published_post_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    seriesOrderUq: unique("bot_curriculum_chapters_series_order_uq").on(
      t.seriesId,
      t.orderIndex,
    ),
  }),
);

export type BotCurriculumChapterRow = typeof botCurriculumChapters.$inferSelect;
export type NewBotCurriculumChapterRow = typeof botCurriculumChapters.$inferInsert;

// ── bot_curriculum_image_slots (챕터의 이미지 자리) ───────────────────────────

export const botCurriculumImageSlots = pgTable(
  "bot_curriculum_image_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 챕터 FK. */
    chapterId: uuid("chapter_id")
      .notNull()
      .references(() => botCurriculumChapters.id, { onDelete: "cascade" }),
    /** 본문 [[IMG:키]] 매칭용 전역 유일 키. */
    assetKey: text("asset_key").notNull(),
    /** 본문 캡션. */
    caption: text("caption").notNull(),
    /** 이미지 대체 텍스트(접근성·SEO). */
    alt: text("alt").notNull(),
    /** 관리자용 상세 준비 안내(어떤 이미지를 어떻게 준비하는지). */
    guidance: text("guidance"),
    /** 대략 어느 설명 옆에 배치되는지(선택). */
    positionHint: text("position_hint"),
    /** 이미지 출처 종류. */
    sourceKind: botCurriculumSlotSourceKind("source_kind").notNull(),
    /** 슬롯 준비 상태. */
    status: botCurriculumSlotStatus("status").notNull().default("pending"),
    /** 버킷 업로드 URL(준비 전 null). */
    imageUrl: text("image_url"),
    /** ai_diagram용 이미지 생성 프롬프트. */
    diagramPrompt: text("diagram_prompt"),
    /** web_download/capture 원본 URL. */
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    chapterAssetKeyUq: unique("bot_curriculum_image_slots_chapter_asset_key_uq").on(
      t.chapterId,
      t.assetKey,
    ),
  }),
);

export type BotCurriculumImageSlotRow = typeof botCurriculumImageSlots.$inferSelect;
export type NewBotCurriculumImageSlotRow = typeof botCurriculumImageSlots.$inferInsert;
