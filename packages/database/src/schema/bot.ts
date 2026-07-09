/**
 * Epic 11: 시딩 봇 (Seeding Bot) 스키마.
 *
 * 봇 신원·페르소나·주제 풀·활동 리듬·모델 할당·생성 잡·보류 큐·활동 로그·전역 설정을 저장한다.
 * [Source: docs/seeding-bot/ARCHITECTURE.md#2 — 봇 테이블 9종 컬럼 정의 전체]
 *
 * 설계 원칙:
 *  - 모델 할당은 bot_model_assignments 가 persona_id 로 bot_personas 를 역참조한다(#5 정합).
 *    bot_personas 에는 gen_model_id/censor_model_id 컬럼을 두지 않는다.
 *  - 크로스 도메인(posts/comments/admin_users) 참조는 FK 미설정, uuid 값만 저장(기존 issuedBy 패턴).
 *  - bot_settings 는 site_settings 와 동일한 key-value jsonb 패턴.
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

// ── pgEnum 정의 ──────────────────────────────────────────────────────────────

/** AI 프로바이더. */
export const botAiProvider = pgEnum("bot_ai_provider", ["openai", "anthropic", "google"]);

/** 모델 용도. */
export const botModelPurpose = pgEnum("bot_model_purpose", ["generation", "censor", "image"]);

/** 잡 종류. question(Q&A 질문)·resource(실전자료) 작성 경로 포함(#6 정합). */
export const botJobKind = pgEnum("bot_job_kind", [
  "post",
  "comment",
  "reply",
  "question",
  "resource",
]);

/** 잡 상태(생성 후보의 수명주기). */
export const botJobStatus = pgEnum("bot_job_status", [
  "pending",
  "generating",
  "censoring",
  "held",
  "approved",
  "published",
  "discarded",
  "blocked",
]);

/** 주제 종류. */
export const botTopicKind = pgEnum("bot_topic_kind", ["fixed", "realtime", "auto"]);

/** 주제 상태. */
export const botTopicStatus = pgEnum("bot_topic_status", ["unused", "used", "cooling"]);

/** 보류 사유. observation_mode 는 관찰 모드 ON 시 게시 전 전량 보류(Story 11.12). */
export const botHoldReason = pgEnum("bot_hold_reason", [
  "ambiguous",
  "injection_suspect",
  "copyright_risk",
  "observation_mode",
]);

/** 보류 결정. */
export const botHoldDecision = pgEnum("bot_hold_decision", ["approved", "discarded"]);

/** 활동 이벤트 유형. planned 는 일일 계획 기록(Story 11.11), discarded 는 폐기(재생성 한도·보류 폐기). */
export const botEventType = pgEnum("bot_event_type", [
  "post.published",
  "comment.published",
  "held",
  "blocked",
  "regenerated",
  "skipped",
  "cost",
  "discarded",
  "planned",
]);

// ── bot_personas (봇 페르소나 = 캐릭터 시트) ───────────────────────────────────
// 다른 모든 봇 테이블이 persona_id 로 참조하므로 가장 먼저 정의한다.

export const botPersonas = pgTable("bot_personas", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** 이 페르소나가 연결된 봇 계정(users.is_bot=true). */
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  /** 화면 닉네임(예: dubu_2). */
  nickname: varchar("nickname", { length: 64 }).notNull(),
  /** 숨은 정체성(내부 전용). */
  hiddenIdentity: text("hidden_identity"),
  /** 나이대·직업. */
  ageJob: varchar("age_job", { length: 128 }),
  /** 말투·입버릇. */
  tone: text("tone"),
  /** 사전 프롬프트(시스템 컨텍스트) — 관리자 편집 대상. */
  personaPrompt: text("persona_prompt"),
  /** 정보형 vs 잡담형 비율(0~100). */
  infoRatio: integer("info_ratio").notNull().default(50),
  /** 의도적 약점·버릇(오타 빈도 등). */
  intentionalFlaws: text("intentional_flaws"),
  /** 관리자 캐릭터(AI작당지기) 여부. */
  isAdminPersona: boolean("is_admin_persona").notNull().default(false),
  /** 개별 ON/OFF. */
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BotPersonaRow = typeof botPersonas.$inferSelect;
export type NewBotPersonaRow = typeof botPersonas.$inferInsert;

// ── bot_model_assignments (모델 할당 — persona별) ──────────────────────────────
// persona_id 로 bot_personas 를 역참조. (persona_id, purpose) unique.

export const botModelAssignments = pgTable(
  "bot_model_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personaId: uuid("persona_id")
      .notNull()
      .references(() => botPersonas.id, { onDelete: "cascade" }),
    /** openai|anthropic|google. */
    provider: botAiProvider("provider").notNull(),
    /** 모델명(DB값, 하드코딩 금지). */
    model: varchar("model", { length: 128 }).notNull(),
    /** generation|censor|image. */
    purpose: botModelPurpose("purpose").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    personaPurposeUq: unique("bot_model_assignments_persona_purpose_uq").on(
      t.personaId,
      t.purpose,
    ),
  }),
);

export type BotModelAssignmentRow = typeof botModelAssignments.$inferSelect;
export type NewBotModelAssignmentRow = typeof botModelAssignments.$inferInsert;

// ── bot_persona_boards (담당 게시판, N:M) ──────────────────────────────────────

export const botPersonaBoards = pgTable(
  "bot_persona_boards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personaId: uuid("persona_id")
      .notNull()
      .references(() => botPersonas.id, { onDelete: "cascade" }),
    /** 게시판 슬러그(packages/contracts/board.ts BOARDS 키). */
    board: varchar("board", { length: 64 }).notNull(),
    /** 배분 가중치. */
    weight: integer("weight").notNull().default(1),
    /** 이 게시판에서 퍼오기(큐레이션) 모드를 켤지 여부. */
    curationEnabled: boolean("curation_enabled").notNull().default(false),
    /** 퍼오기 가중치({ youtube?: number, meme?: number, ai?: number }). null이면 기본값 사용. */
    curationWeights: jsonb("curation_weights"),
  },
  (t) => ({
    personaBoardUq: unique("bot_persona_boards_persona_board_uq").on(t.personaId, t.board),
  }),
);

export type BotPersonaBoardRow = typeof botPersonaBoards.$inferSelect;
export type NewBotPersonaBoardRow = typeof botPersonaBoards.$inferInsert;

// ── bot_activity_rhythm (활동 리듬) ────────────────────────────────────────────

export const botActivityRhythm = pgTable("bot_activity_rhythm", {
  id: uuid("id").primaryKey().defaultRandom(),
  personaId: uuid("persona_id")
    .notNull()
    .references(() => botPersonas.id, { onDelete: "cascade" }),
  /** 주당 글 수. */
  postsPerWeek: integer("posts_per_week").notNull().default(0),
  /** 주당 댓글 수. */
  commentsPerWeek: integer("comments_per_week").notNull().default(0),
  /** 활동 시간대 jsonb 배열(예: [{from:21,to:24},{from:12,to:13}]). */
  activeHours: jsonb("active_hours"),
  /** 활동 요일 성향 jsonb(예: {weekday:0.8, weekend:0.2}). */
  activeDays: jsonb("active_days"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BotActivityRhythmRow = typeof botActivityRhythm.$inferSelect;
export type NewBotActivityRhythmRow = typeof botActivityRhythm.$inferInsert;

// ── bot_topics (주제 풀) ───────────────────────────────────────────────────────

export const botTopics = pgTable("bot_topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  personaId: uuid("persona_id")
    .notNull()
    .references(() => botPersonas.id, { onDelete: "cascade" }),
  /** 올라갈 게시판. */
  board: varchar("board", { length: 64 }).notNull(),
  /** 주제 출발점 텍스트. */
  titleSeed: text("title_seed").notNull(),
  /** fixed|realtime|auto. */
  topicKind: botTopicKind("topic_kind").notNull().default("fixed"),
  /** unused|used|cooling. */
  status: botTopicStatus("status").notNull().default("unused"),
  /** 마지막 사용 시각(중복 방지 기준). */
  usedAt: timestamp("used_at", { withTimezone: true }),
  /** 관리자 대주제 그룹(장문 시리즈 묶음). */
  seriesGroup: varchar("series_group", { length: 128 }),
  /**
   * 이 주제로 실제 게시된 글 ID(발굴·실시간 주제를 게시 시 기록).
   * 게시글 영구삭제(purgePost) 시 이 행도 함께 삭제해 같은 주제를 다시 쓸 수 있게 한다.
   * FK 없음(posts는 크로스 도메인) — 삭제는 purgePost가 명시적으로 처리.
   */
  postId: uuid("post_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BotTopicRow = typeof botTopics.$inferSelect;
export type NewBotTopicRow = typeof botTopics.$inferInsert;

// ── bot_generation_jobs (생성 작업 추적) ───────────────────────────────────────

export const botGenerationJobs = pgTable("bot_generation_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  personaId: uuid("persona_id")
    .notNull()
    .references(() => botPersonas.id, { onDelete: "cascade" }),
  /** post|comment|reply|question|resource. */
  jobKind: botJobKind("job_kind").notNull(),
  /** 어디에. */
  targetBoard: varchar("target_board", { length: 64 }),
  /** 댓글 대상 게시글 ID(크로스 도메인, FK 미설정). */
  targetPostId: uuid("target_post_id"),
  /** 주제(댓글은 null). */
  topicId: uuid("topic_id").references(() => botTopics.id, { onDelete: "set null" }),
  status: botJobStatus("status").notNull().default("pending"),
  /** Tiptap JSON 후보. */
  draftContent: jsonb("draft_content"),
  /** 검열 결과(항목별 통과/탈락). */
  censorResult: jsonb("censor_result"),
  /** 재생성 횟수. */
  regenCount: integer("regen_count").notNull().default(0),
  /** 예정 게시 시각(분 단위 랜덤). */
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  /** 게시 결과 참조(크로스 도메인, FK 미설정). */
  publishedPostId: uuid("published_post_id"),
  publishedCommentId: uuid("published_comment_id"),
  /** 토큰·검색·이미지 비용 추정 jsonb. */
  cost: jsonb("cost"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BotGenerationJobRow = typeof botGenerationJobs.$inferSelect;
export type NewBotGenerationJobRow = typeof botGenerationJobs.$inferInsert;

// ── bot_hold_queue (보류 큐) ───────────────────────────────────────────────────

export const botHoldQueue = pgTable("bot_hold_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => botGenerationJobs.id, { onDelete: "cascade" }),
  /** ambiguous|injection_suspect|copyright_risk|observation_mode. */
  reason: botHoldReason("reason").notNull(),
  decided: boolean("decided").notNull().default(false),
  decision: botHoldDecision("decision"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  /** 결정한 관리자 ID(admin_users.id, 크로스 도메인 FK 미설정). */
  decidedBy: uuid("decided_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BotHoldQueueRow = typeof botHoldQueue.$inferSelect;
export type NewBotHoldQueueRow = typeof botHoldQueue.$inferInsert;

// ── bot_activity_log (활동 로그) ───────────────────────────────────────────────

export const botActivityLog = pgTable("bot_activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  personaId: uuid("persona_id")
    .notNull()
    .references(() => botPersonas.id, { onDelete: "cascade" }),
  /** post.published|comment.published|held|blocked|regenerated|skipped|cost|discarded|planned. */
  eventType: botEventType("event_type").notNull(),
  /** 참조 ID(잡·글·댓글 등). */
  refId: uuid("ref_id"),
  /** 이벤트 페이로드 jsonb. */
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BotActivityLogRow = typeof botActivityLog.$inferSelect;
export type NewBotActivityLogRow = typeof botActivityLog.$inferInsert;

// ── bot_settings (봇 전역 설정) — site_settings 패턴 ───────────────────────────

export const botSettings = pgTable("bot_settings", {
  /** 설정 키(예: bot_master_enabled, bot_daily_post_limit). */
  key: text("key").primaryKey(),
  /** 설정 값 — JSONB. */
  value: jsonb("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BotSettingRow = typeof botSettings.$inferSelect;
export type NewBotSettingRow = typeof botSettings.$inferInsert;

// ── ai_usage_log (AI 사용 로그 — 호출 단위 관측, Story 11.19) ──────────────────
// 세밀 비용 관측의 source of truth. bot_activity_log cost 이벤트(잡 단위)와 역할 분리.

export const aiUsageLog = pgTable(
  "ai_usage_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** AI 사용 기능 구분: 'seeding-bot' 등(비봇 기능 확장 대비 generic). */
    feature: text("feature").notNull(),
    /** openai|anthropic|google 등. */
    provider: text("provider").notNull(),
    /** 실제 모델명(예: gpt-4o-mini). */
    model: text("model").notNull(),
    /** generation|censor|image|search_summary|translation 등. */
    purpose: text("purpose").notNull(),
    /** 봇 페르소나 연계(있을 때만). */
    personaId: uuid("persona_id").references(() => botPersonas.id, { onDelete: "set null" }),
    /** bot_generation_jobs 연계(있을 때만, 크로스 참조 느슨). */
    jobId: uuid("job_id"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    /** 이 호출 비용(달러). */
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    createdIdx: index("ai_usage_log_created_idx").on(t.createdAt),
    providerModelIdx: index("ai_usage_log_provider_model_idx").on(t.provider, t.model),
    purposeIdx: index("ai_usage_log_purpose_idx").on(t.purpose),
    featureIdx: index("ai_usage_log_feature_idx").on(t.feature),
  }),
);

export type AiUsageLogRow = typeof aiUsageLog.$inferSelect;
export type NewAiUsageLogRow = typeof aiUsageLog.$inferInsert;
