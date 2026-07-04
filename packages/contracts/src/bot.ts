/**
 * 봇 Zod 계약 (Story 11.2) — 봇 도메인 단일 진실원.
 *
 * 사용 범위:
 *  - API: apps/api/src/routes/admin/bots/ — 요청·응답 유효성 검사
 *  - Worker: apps/worker/src/processors/bot/ — 잡 페이로드 직렬화
 *  - Admin: apps/admin/app/bots/ — 타입 안전 클라이언트 요청
 *
 * 단일 진실원 원칙 (ARCHITECTURE §0.7):
 *  - 모든 봇 타입은 이 파일에서만 정의한다.
 *  - API/Worker/Admin 레이어는 즉석 z.object(...) 정의 없이 여기서 import한다.
 *  - DB enum 값은 packages/database/src/schema/bot.ts pgEnum과 글자 그대로 일치.
 */

import { z } from "zod";
import { paginatedResponseSchema } from "./common";

// ── Task 1: Enum 스키마 ────────────────────────────────────────────────────────

/** AI 프로바이더 enum — bot_ai_provider pgEnum과 1:1 일치. */
export const botProviderSchema = z.enum(["openai", "anthropic", "google"]);
export type BotProvider = z.infer<typeof botProviderSchema>;

/** 모델 용도 enum — bot_model_purpose pgEnum과 1:1 일치. */
export const botPurposeSchema = z.enum(["generation", "censor", "image"]);
export type BotPurpose = z.infer<typeof botPurposeSchema>;

/** 주제 종류 enum — bot_topic_kind pgEnum과 1:1 일치. */
export const botTopicKindSchema = z.enum(["fixed", "realtime", "auto"]);
export type BotTopicKind = z.infer<typeof botTopicKindSchema>;

/** 주제 상태 enum — bot_topic_status pgEnum과 1:1 일치. */
export const botTopicStatusSchema = z.enum(["unused", "used", "cooling"]);
export type BotTopicStatus = z.infer<typeof botTopicStatusSchema>;

/**
 * 잡 종류 enum — bot_job_kind pgEnum과 1:1 일치.
 * question(Q&A 질문)·resource(실전자료) 작성 경로 포함(#6 정합).
 */
export const botJobKindSchema = z.enum([
  "post",
  "comment",
  "reply",
  "question",
  "resource",
]);
export type BotJobKind = z.infer<typeof botJobKindSchema>;

/** 잡 상태 enum — bot_job_status pgEnum과 1:1 일치. */
export const botJobStatusSchema = z.enum([
  "pending",
  "generating",
  "censoring",
  "held",
  "approved",
  "published",
  "discarded",
  "blocked",
]);
export type BotJobStatus = z.infer<typeof botJobStatusSchema>;

/**
 * 활동 이벤트 유형 enum — bot_event_type pgEnum과 1:1 일치.
 * discarded(폐기)·planned(일일 계획 기록) 포함.
 */
export const botActivityEventTypeSchema = z.enum([
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
export type BotActivityEventType = z.infer<typeof botActivityEventTypeSchema>;

/**
 * 보류 사유 enum — bot_hold_reason pgEnum과 1:1 일치.
 * observation_mode: 관찰 모드 ON 시 게시 전 전량 보류(Story 11.12).
 */
export const botHoldReasonSchema = z.enum([
  "ambiguous",
  "injection_suspect",
  "copyright_risk",
  "observation_mode",
]);
export type BotHoldReason = z.infer<typeof botHoldReasonSchema>;

/** 보류 결정 enum — bot_hold_decision pgEnum과 1:1 일치. */
export const botHoldDecisionSchema = z.enum(["approved", "discarded"]);
export type BotHoldDecision = z.infer<typeof botHoldDecisionSchema>;

// ── Task 2: 단위 도메인 스키마 ────────────────────────────────────────────────

/**
 * 활동 시간대 항목.
 * 자정을 넘는 구간은 {from:23,to:2,crossesMidnight:true}처럼 명시.
 * to>24 처리·% 24 연산 금지.
 */
export const botActiveHourSchema = z.object({
  from: z.number().int().min(0).max(23),
  to: z.number().int().min(0).max(23),
  crossesMidnight: z.boolean().optional().default(false),
});
export type BotActiveHour = z.infer<typeof botActiveHourSchema>;

/**
 * 활동 리듬 응답 스키마 (bot_activity_rhythm 테이블).
 * activeHours·activeDays는 jsonb — nullable 컬럼 반영.
 */
export const botActivityRhythmSchema = z.object({
  personaId: z.string().uuid(),
  postsPerWeek: z.number().int(),
  commentsPerWeek: z.number().int(),
  /** 활동 시간대 jsonb 배열 (nullable). */
  activeHours: z.array(botActiveHourSchema).nullable(),
  /** 활동 요일 성향 jsonb 객체 (nullable). */
  activeDays: z.unknown().nullable(),
});
export type BotActivityRhythm = z.infer<typeof botActivityRhythmSchema>;

/**
 * 모델 할당 항목 (bot_model_assignments 테이블).
 * 목록/상세 동일 형태. 조회 키: (personaId, purpose) unique.
 */
export const botModelAssignmentSchema = z.object({
  id: z.string().uuid(),
  personaId: z.string().uuid(),
  provider: botProviderSchema,
  model: z.string(),
  purpose: botPurposeSchema,
  isActive: z.boolean(),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BotModelAssignment = z.infer<typeof botModelAssignmentSchema>;

/**
 * 주제 풀 항목 (bot_topics 테이블).
 * nullable 컬럼(usedAt·seriesGroup) 반영.
 */
export const botTopicSchema = z.object({
  id: z.string().uuid(),
  personaId: z.string().uuid(),
  board: z.string(),
  titleSeed: z.string(),
  topicKind: botTopicKindSchema,
  status: botTopicStatusSchema,
  usedAt: z.string().nullable(),
  seriesGroup: z.string().nullable(),
  createdAt: z.string(),
});
export type BotTopic = z.infer<typeof botTopicSchema>;

/**
 * 활동 로그 항목 (bot_activity_log 테이블).
 * payload는 유동 jsonb — z.unknown() 처리.
 */
export const botActivityLogItemSchema = z.object({
  id: z.string().uuid(),
  personaId: z.string().uuid(),
  eventType: botActivityEventTypeSchema,
  refId: z.string().uuid().nullable(),
  payload: z.unknown(),
  createdAt: z.string(),
});
export type BotActivityLogItem = z.infer<typeof botActivityLogItemSchema>;

/**
 * 보류 큐 항목 (bot_hold_queue 테이블 + join).
 * 목록용 요약 필드(draftPreview·personaNickname) 포함.
 */
export const botHoldQueueItemSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  reason: botHoldReasonSchema,
  decided: z.boolean(),
  decision: botHoldDecisionSchema.nullable(),
  decidedAt: z.string().nullable(),
  decidedBy: z.string().uuid().nullable(),
  /** 초안 미리보기 (bot_generation_jobs join 집계). */
  draftPreview: z.string().nullable(),
  /** 페르소나 닉네임 (bot_personas join 집계). */
  personaNickname: z.string().nullable(),
  createdAt: z.string(),
});
export type BotHoldQueueItem = z.infer<typeof botHoldQueueItemSchema>;

/**
 * 생성 잡 항목 (bot_generation_jobs 테이블).
 * jsonb 필드(draftContent·censorResult·cost)는 z.unknown() 처리.
 * nullable 컬럼(targetBoard·targetPostId·topicId·scheduledAt·publishedPostId·publishedCommentId) 반영.
 */
export const botGenerationJobSchema = z.object({
  id: z.string().uuid(),
  personaId: z.string().uuid(),
  jobKind: botJobKindSchema,
  targetBoard: z.string().nullable(),
  targetPostId: z.string().uuid().nullable(),
  topicId: z.string().uuid().nullable(),
  status: botJobStatusSchema,
  /** Tiptap JSON 후보 — 구조 고정 불가, z.unknown() 처리. */
  draftContent: z.unknown(),
  /** 검열 결과(항목별 통과/탈락) — z.unknown() 처리. */
  censorResult: z.unknown(),
  regenCount: z.number().int(),
  scheduledAt: z.string().nullable(),
  publishedPostId: z.string().uuid().nullable(),
  publishedCommentId: z.string().uuid().nullable(),
  /** 토큰·검색·이미지 비용 추정 jsonb — z.unknown() 처리. */
  cost: z.unknown(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BotGenerationJob = z.infer<typeof botGenerationJobSchema>;

/**
 * 페르소나 목록 카드 항목 (bot_personas 테이블 요약).
 * lastActivityAt은 bot_activity_log join 집계 필드.
 */
export const botPersonaItemSchema = z.object({
  id: z.string().uuid(),
  nickname: z.string(),
  isActive: z.boolean(),
  isAdminPersona: z.boolean(),
  infoRatio: z.number().int(),
  createdAt: z.string(),
  lastActivityAt: z.string().nullable(),
});
export type BotPersonaItem = z.infer<typeof botPersonaItemSchema>;

/**
 * 페르소나 상세 항목 (bot_personas 전체 컬럼 + rhythm + assignedBoards).
 * nullable 컬럼(userId·hiddenIdentity·ageJob·tone·personaPrompt·intentionalFlaws) 반영.
 */
export const botPersonaDetailSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  nickname: z.string(),
  hiddenIdentity: z.string().nullable(),
  ageJob: z.string().nullable(),
  tone: z.string().nullable(),
  personaPrompt: z.string().nullable(),
  infoRatio: z.number().int(),
  intentionalFlaws: z.string().nullable(),
  isAdminPersona: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** 활동 리듬 (bot_activity_rhythm — 없을 수 있음). */
  rhythm: botActivityRhythmSchema.nullable(),
  /** 담당 게시판 목록 (bot_persona_boards). */
  assignedBoards: z.array(
    z.object({
      board: z.string(),
      weight: z.number().int(),
      curationEnabled: z.boolean().optional(),
      curationWeights: z.object({
        youtube: z.number().optional(),
        meme: z.number().optional(),
        ai: z.number().optional(),
      }).nullable().optional(),
    }),
  ),
});
export type BotPersonaDetail = z.infer<typeof botPersonaDetailSchema>;

// ── Task 3: 목록 응답 스키마 (paginatedResponseSchema 재사용) ─────────────────

/** GET /admin/bots/personas 응답 */
export const paginatedBotPersonasSchema = paginatedResponseSchema(botPersonaItemSchema);
export type PaginatedBotPersonas = z.infer<typeof paginatedBotPersonasSchema>;

/** GET /admin/bots/topics 응답 */
export const paginatedBotTopicsSchema = paginatedResponseSchema(botTopicSchema);
export type PaginatedBotTopics = z.infer<typeof paginatedBotTopicsSchema>;

/** GET /admin/bots/activity-logs 응답 */
export const paginatedBotActivityLogsSchema = paginatedResponseSchema(botActivityLogItemSchema);
export type PaginatedBotActivityLogs = z.infer<typeof paginatedBotActivityLogsSchema>;

/** GET /admin/bots/hold-queue 응답 */
export const paginatedBotHoldQueueSchema = paginatedResponseSchema(botHoldQueueItemSchema);
export type PaginatedBotHoldQueue = z.infer<typeof paginatedBotHoldQueueSchema>;

/** GET /admin/bots/jobs 응답 */
export const paginatedBotGenerationJobsSchema = paginatedResponseSchema(botGenerationJobSchema);
export type PaginatedBotGenerationJobs = z.infer<typeof paginatedBotGenerationJobsSchema>;

// ── Task 4: 관리자 API 쿼리 파라미터 스키마 ──────────────────────────────────

/** GET /admin/bots/personas 쿼리 파라미터 */
export const adminBotPersonasQuerySchema = z.object({
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminBotPersonasQuery = z.infer<typeof adminBotPersonasQuerySchema>;

/** GET /admin/bots/topics 쿼리 파라미터 */
export const adminBotTopicsQuerySchema = z.object({
  personaId: z.string().uuid().optional(),
  status: botTopicStatusSchema.optional(),
  board: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminBotTopicsQuery = z.infer<typeof adminBotTopicsQuerySchema>;

/** GET /admin/bots/activity-logs 쿼리 파라미터 */
export const adminBotActivityLogsQuerySchema = z.object({
  personaId: z.string().uuid().optional(),
  eventType: botActivityEventTypeSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminBotActivityLogsQuery = z.infer<typeof adminBotActivityLogsQuerySchema>;

/** GET /admin/bots/hold-queue 쿼리 파라미터 */
export const adminBotHoldQueueQuerySchema = z.object({
  reason: botHoldReasonSchema.optional(),
  decided: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminBotHoldQueueQuery = z.infer<typeof adminBotHoldQueueQuerySchema>;

/** GET /admin/bots/jobs 쿼리 파라미터 */
export const adminBotJobsQuerySchema = z.object({
  personaId: z.string().uuid().optional(),
  status: botJobStatusSchema.optional(),
  jobKind: botJobKindSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminBotJobsQuery = z.infer<typeof adminBotJobsQuerySchema>;

// ── Task 5: 전역 설정 스키마 ──────────────────────────────────────────────────

/**
 * 봇 전역 설정 GET 응답 스키마 (ARCHITECTURE §2.10 키 전체).
 * key-value JSONB에서 flat 객체로 변환한 형태.
 * 모두 optional — 키 미존재 허용.
 */
export const botSettingsResponseSchema = z.object({
  bot_master_enabled: z.boolean().optional(),
  bot_daily_post_limit: z.number().int().optional(),
  bot_daily_comment_limit: z.number().int().optional(),
  bot_daily_cost_limit_usd: z.number().optional(),
  bot_exclude_from_ranking: z.boolean().optional(),
  bot_auto_refill_topics: z.boolean().optional(),
  bot_observation_mode: z.boolean().optional(),
  bot_push_channel: z.string().optional(),
});
export type BotSettingsResponse = z.infer<typeof botSettingsResponseSchema>;

/**
 * 봇 전역 설정 PATCH 요청 스키마 (변경 키만 전달 — partial PATCH용).
 * 동일 키 구조, 모두 optional이므로 응답 스키마를 그대로 재사용.
 */
export const botSettingsPatchSchema = botSettingsResponseSchema;
export type BotSettingsPatch = z.infer<typeof botSettingsPatchSchema>;

// ── Task 6: CRUD 요청 스키마 ──────────────────────────────────────────────────

/** POST /admin/bots/personas — 페르소나 생성 */
export const botPersonaCreateSchema = z.object({
  nickname: z.string().min(1),
  hiddenIdentity: z.string().optional(),
  ageJob: z.string().optional(),
  tone: z.string().optional(),
  personaPrompt: z.string().optional(),
  infoRatio: z.number().int().min(0).max(100).optional(),
  intentionalFlaws: z.string().optional(),
  isAdminPersona: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type BotPersonaCreate = z.infer<typeof botPersonaCreateSchema>;

/** PATCH /admin/bots/personas/:id — 페르소나 수정 */
export const botPersonaUpdateSchema = botPersonaCreateSchema.partial();
export type BotPersonaUpdate = z.infer<typeof botPersonaUpdateSchema>;

/** POST /admin/bots/topics — 단건 주제 생성 */
export const botTopicCreateSchema = z.object({
  personaId: z.string().uuid(),
  board: z.string().min(1),
  titleSeed: z.string().min(1),
  topicKind: botTopicKindSchema,
  seriesGroup: z.string().optional(),
});
export type BotTopicCreate = z.infer<typeof botTopicCreateSchema>;

/** POST /admin/bots/topics/bulk — 주제 일괄 업서트 */
export const botTopicBulkUpsertSchema = z.object({
  topics: z.array(botTopicCreateSchema),
});
export type BotTopicBulkUpsert = z.infer<typeof botTopicBulkUpsertSchema>;

/** PUT /admin/bots/personas/:id/model-assignments — 모델 할당 업서트 */
export const botModelAssignmentUpsertSchema = z.object({
  personaId: z.string().uuid(),
  provider: botProviderSchema,
  model: z.string().min(1),
  purpose: botPurposeSchema,
  isActive: z.boolean(),
  note: z.string().optional(),
});
export type BotModelAssignmentUpsert = z.infer<typeof botModelAssignmentUpsertSchema>;

/** PATCH /admin/bots/personas/:id/rhythm — 활동 리듬 수정 */
export const botRhythmUpdateSchema = z.object({
  postsPerWeek: z.number().int().min(0),
  commentsPerWeek: z.number().int().min(0),
  activeHours: z.array(botActiveHourSchema),
  activeDays: z.record(z.string(), z.number()),
});
export type BotRhythmUpdate = z.infer<typeof botRhythmUpdateSchema>;

/** POST /admin/bots/hold-queue/:id/decision — 보류 항목 결정 */
export const botHoldQueueDecisionSchema = z.object({
  decision: botHoldDecisionSchema,
});
export type BotHoldQueueDecision = z.infer<typeof botHoldQueueDecisionSchema>;

/** PUT /admin/bots/personas/:id/boards — 담당 게시판 upsert */
export const botPersonaBoardUpsertSchema = z.object({
  boards: z.array(
    z.object({
      board: z.string(),
      weight: z.number().int().min(1).max(10),
      /** 이 게시판에서 퍼오기(큐레이션) 모드를 켤지 여부. 기본 false. */
      curationEnabled: z.boolean().optional().default(false),
      /** 퍼오기 가중치({ youtube?, meme?, ai? }). null이면 기본값 사용. */
      curationWeights: z.object({
        youtube: z.number().optional(),
        meme: z.number().optional(),
        ai: z.number().optional(),
      }).nullable().optional(),
    }),
  ),
});
export type BotPersonaBoardUpsert = z.infer<typeof botPersonaBoardUpsertSchema>;

// ── BullMQ 잡 페이로드 (단일 `bot` 큐 + job.name 디스패처, Story 11.11/11.13) ──

/** `bot.daily-plan` 잡 — cron 트리거. 특정일 계획만 다시 짤 때 personaId 지정 가능. */
export const botDailyPlanJobSchema = z.object({
  /** 미지정 시 전체 활성 페르소나 대상. */
  personaId: z.string().uuid().optional(),
});
export type BotDailyPlanJobPayload = z.infer<typeof botDailyPlanJobSchema>;

/**
 * `bot.write` 잡 — 글/질문/자료 생성 1건.
 * jobId는 포함하지 않는다(프로세서가 bot_generation_jobs INSERT 후 확보).
 */
export const botWriteJobSchema = z.object({
  personaId: z.string().uuid(),
  /** 게시판 슬러그(검열 강도·라우팅 결정용). */
  targetBoard: z.string(),
  /** post|question|resource (댓글은 bot.comment). 미지정 시 post. */
  jobKind: z.enum(["post", "question", "resource"]).optional(),
  /** 특정 주제를 지정할 때(미지정 시 프로세서가 선택). */
  topicId: z.string().uuid().optional(),
});
export type BotWriteJobPayload = z.infer<typeof botWriteJobSchema>;

/**
 * `bot.comment` 잡 — 댓글/대댓글 생성 1건.
 * persona 선택은 프로세서 내부 랜덤. jobId 미포함.
 */
export const botCommentJobSchema = z.object({
  /** 댓글을 달 게시글 ID. */
  targetPostId: z.string().uuid(),
  /** 게시판 슬러그(검열 강도 결정용). */
  targetBoard: z.string(),
  /** 대댓글인 경우 부모 댓글 ID. */
  parentCommentId: z.string().uuid().optional(),
});
export type BotCommentJobPayload = z.infer<typeof botCommentJobSchema>;

// ── Story 11.17: 일일 리포트 스키마 ───────────────────────────────────────────

/**
 * 봇 일일 리포트 응답 스키마 (Story 11.17 AC#1, GET /admin/bots/report).
 *
 * 집계 원천: bot_activity_log + bot_generation_jobs + bot_personas + posts + bot_settings.
 * date 파라미터가 KST 기준 날짜를 지정하며, 집계 범위는 해당 KST 날짜 00:00~23:59:59.
 *
 * status:
 *  - 'ok': 경고 조건(blockedCount>0, highRegenPersonas, dormantPersonas) 없음.
 *  - 'warning': 경고 조건 1개라도 있음.
 */
export const botDailyReportSchema = z.object({
  /** 집계 대상 KST 날짜 (YYYY-MM-DD). */
  date: z.string(),
  /** 게시글(post/question/resource) 집계. */
  posts: z.object({
    published: z.number(),   // post.published 이벤트 수
    blocked: z.number(),     // contentGuard 차단 건수 (post 계열)
    discarded: z.number(),   // 폐기 건수 (post 계열)
    held: z.number(),        // 보류 큐 이동 건수 (post 계열)
  }),
  /** 댓글/대댓글 집계. */
  comments: z.object({
    published: z.number(),   // comment.published 이벤트 수
    blocked: z.number(),     // contentGuard 차단 건수 (comment 계열)
    discarded: z.number(),   // 폐기 건수 (comment 계열)
    held: z.number(),        // 보류 큐 이동 건수 (comment 계열)
  }),
  /** 페르소나별 활동 분포. */
  personaBreakdown: z.array(
    z.object({
      personaId: z.string(),
      nickname: z.string(),
      postsPublished: z.number(),
      commentsPublished: z.number(),
      blocked: z.number(),
      costUsd: z.number(),
    }),
  ),
  /** 게시 성공한 글 목록 (post.published 이벤트 기준). */
  publishedPosts: z.array(
    z.object({
      postId: z.string(),
      title: z.string(),
      slug: z.string(),        // URL: /posts/{slug}
      board: z.string(),
      personaNickname: z.string(),
    }),
  ),
  /** 미결정 보류 항목 수 (bot_hold_queue WHERE decided=false). */
  holdQueuePending: z.number(),
  /** 경고 집계. */
  warnings: z.object({
    blockedCount: z.number(),
    /** 재생성 다발(오늘 regenerated 이벤트 2회 초과) 페르소나. */
    highRegenPersonas: z.array(
      z.object({
        personaId: z.string(),
        nickname: z.string(),
        regenCount: z.number(),
      }),
    ),
    /** 최근 7일 활동 없는 활성 페르소나. */
    dormantPersonas: z.array(
      z.object({
        personaId: z.string(),
        nickname: z.string(),
      }),
    ),
  }),
  /** 어제 총 비용(달러) — cost 이벤트 payload.costUsd 합산. */
  totalCostUsd: z.number(),
  /** bot_settings 현재값 스냅샷. */
  systemStatus: z.object({
    masterEnabled: z.boolean(),        // bot_master_enabled
    observationMode: z.boolean(),      // bot_observation_mode
    dailyPostLimit: z.number(),        // bot_daily_post_limit
    dailyCommentLimit: z.number(),     // bot_daily_comment_limit
    dailyCostLimitUsd: z.number(),     // bot_daily_cost_limit_usd
  }),
  /** 경고 조건 하나라도 있으면 'warning'. */
  status: z.enum(["ok", "warning"]),
});
export type BotDailyReport = z.infer<typeof botDailyReportSchema>;

/**
 * 봇 일일 리포트 요약 (Story 11.18 텔레그램 푸시가 소비하는 최소 타입).
 */
export const botDailyReportSummarySchema = z.object({
  date: z.string(),
  publishedPosts: z.number(),
  publishedComments: z.number(),
  heldCount: z.number(),
  blockedCount: z.number().optional(),
  costUsd: z.number().optional(),
});
export type BotDailyReportSummary = z.infer<typeof botDailyReportSummarySchema>;

// ── Story 11.19: AI 사용량·비용 집계 스키마 ───────────────────────────────────

/**
 * 제공자·모델·용도·기능별 집계 항목 (byProvider[], byModel[], byPurpose[], byFeature[]).
 */
const usageGroupSchema = z.object({
  /** 그룹 키 값 (provider명 / 모델명 / purpose값 / feature값). */
  key: z.string(),
  costUsd: z.number(),
  callCount: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
});
export type UsageGroup = z.infer<typeof usageGroupSchema>;

/**
 * GET /api/v1/admin/ai-usage 응답 스키마 (Story 11.19 AC#3).
 *
 * 범위: today | 7d | 30d | month (KST 기준).
 * totals: 기간 총 집계.
 * byProvider / byModel / byPurpose / byFeature: 그룹별 비용·호출·토큰.
 * daily: 일별 시계열 (차트용, KST 날짜 기준).
 * todayVsLimit: 오늘 누적 vs bot_settings.bot_daily_cost_limit_usd.
 */
export const aiUsageReportSchema = z.object({
  range: z.enum(["today", "7d", "30d", "month"]),
  totals: z.object({
    costUsd: z.number(),
    callCount: z.number(),
    inputTokens: z.number(),
    outputTokens: z.number(),
  }),
  byProvider: z.array(usageGroupSchema),
  byModel: z.array(usageGroupSchema),
  byPurpose: z.array(usageGroupSchema),
  byFeature: z.array(usageGroupSchema),
  daily: z.array(
    z.object({
      /** YYYY-MM-DD (KST). */
      date: z.string(),
      costUsd: z.number(),
      callCount: z.number(),
    }),
  ),
  todayVsLimit: z.object({
    todayCostUsd: z.number(),
    /** bot_settings.bot_daily_cost_limit_usd (0 = 미설정). */
    dailyLimitUsd: z.number(),
  }),
});
export type AiUsageReport = z.infer<typeof aiUsageReportSchema>;
