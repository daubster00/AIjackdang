/**
 * 커리큘럼 Zod 계약 (Story 13.2) — 커리큘럼 도메인 단일 진실원.
 *
 * 사용 범위:
 *  - API:    apps/api/src/routes/admin/bots/curriculum/  (Story 13.5)
 *  - Admin:  apps/admin/app/bots/curriculum/              (Story 13.5)
 *  - Worker: apps/worker/src/processors/bot/              (Story 13.3 · bot.curriculum-draft, Story 13.6 · bot.curriculum-publish)
 *
 * 단일 진실원 원칙:
 *  - 커리큘럼 도메인 타입은 이 파일에서만 정의한다.
 *  - API/Worker/Admin 레이어는 즉석 z.object(...) 정의 없이 여기서 import한다.
 *  - 즉석 타입 정의(`z.object(...)` 직접 선언) 금지 — 반드시 @ai-jakdang/contracts에서 import.
 *
 * enum 정합:
 *  - enum 값은 13.1 `packages/database/src/schema/bot-curriculum.ts` pgEnum과 문자열 1:1 정합.
 *  - contracts 패키지는 database 패키지를 의존하지 않으므로 Drizzle pgEnum 직접 import 금지.
 *    Zod에서 독립 정의하되 값은 설계문서 §4(단일 진실원)를 기준으로 한다.
 */

import { z } from "zod";
import { paginatedResponseSchema } from "./common";

// ── Task 1: Enum 스키마 ───────────────────────────────────────────────────────

/**
 * 챕터 상태 enum — bot_curriculum_chapters.status pgEnum과 1:1 일치.
 * planned(초안 생성 전) → drafted(초안 생성 완료) → ready(이미지 슬롯 전부 채워짐) → published(실제 게시 완료).
 * skipped(건너뜀 — 해당 챕터를 스킵 처리).
 */
export const curriculumChapterStatusSchema = z.enum([
  "planned",
  "drafted",
  "ready",
  "published",
  "skipped",
]);
export type CurriculumChapterStatus = z.infer<typeof curriculumChapterStatusSchema>;

/**
 * 슬롯 출처 종류 enum — bot_curriculum_image_slots.source_kind pgEnum과 1:1 일치.
 * 🟢ai_diagram(Gemini AI 도식 생성) · 🟢web_download(공식문서 curl 다운로드)
 * · 🟡capture(사람 환경 준비 필요 화면 캡처) · 🔵user_upload(사람이 직접 업로드).
 */
export const curriculumSlotSourceKindSchema = z.enum([
  "ai_diagram",
  "web_download",
  "capture",
  "user_upload",
]);
export type CurriculumSlotSourceKind = z.infer<typeof curriculumSlotSourceKindSchema>;

/**
 * 슬롯 상태 enum — bot_curriculum_image_slots.status pgEnum과 1:1 일치.
 * pending(이미지 미준비) · ready(이미지 채워짐, 챕터 준비완료 판정 대상).
 */
export const curriculumSlotStatusSchema = z.enum(["pending", "ready"]);
export type CurriculumSlotStatus = z.infer<typeof curriculumSlotStatusSchema>;

// ── Task 2: 단위 도메인 스키마 ──────────────────────────────────────────────────

/**
 * 이미지 슬롯 (bot_curriculum_image_slots 테이블 전체 컬럼).
 * non-nullable: id · chapterId · assetKey · sourceKind · status.
 * nullable: caption(본문 캡션) · alt(대체텍스트) · guidance(사람용 상세 안내)
 *           · positionHint(위치 힌트) · imageUrl(버킷 업로드 결과)
 *           · diagramPrompt(AI 도식 프롬프트, ai_diagram 슬롯용)
 *           · sourceUrl(원본 URL, web_download·capture 슬롯용).
 */
export const curriculumImageSlotSchema = z.object({
  id: z.string().uuid(),
  chapterId: z.string().uuid(),
  /** 본문 [[IMG:키]] 마커 매칭 키 — 챕터 내 유일. */
  assetKey: z.string(),
  sourceKind: curriculumSlotSourceKindSchema,
  status: curriculumSlotStatusSchema,
  caption: z.string().nullable(),
  alt: z.string().nullable(),
  guidance: z.string().nullable(),
  positionHint: z.string().nullable(),
  imageUrl: z.string().nullable(),
  diagramPrompt: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CurriculumImageSlot = z.infer<typeof curriculumImageSlotSchema>;

/**
 * 챕터 목록 카드 (bot_curriculum_chapters 요약 + API 집계 필드).
 * totalSlots(슬롯 총 수) · readySlots(완료 슬롯 수): Story 13.5 API가 bot_curriculum_image_slots COUNT로 계산.
 * nullable: scheduledAt(챕터별 예약 게시 시각) · publishedPostId(게시 결과 포스트 uuid).
 */
export const curriculumChapterItemSchema = z.object({
  id: z.string().uuid(),
  seriesId: z.string().uuid(),
  orderIndex: z.number().int(),
  title: z.string(),
  goal: z.string(),
  status: curriculumChapterStatusSchema,
  scheduledAt: z.string().nullable(),
  publishedPostId: z.string().uuid().nullable(),
  /** 슬롯 총 수 — API 집계값 (DB 컬럼 아님). */
  totalSlots: z.number().int(),
  /** 완료 슬롯 수 — API 집계값 (DB 컬럼 아님). */
  readySlots: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CurriculumChapterItem = z.infer<typeof curriculumChapterItemSchema>;

/**
 * 챕터 상세 (bot_curriculum_chapters 전체 컬럼 + 집계 필드 + slots).
 * curriculumChapterItemSchema(챕터 목록 카드) 모든 필드 포함 + 추가:
 *  - outline(소주제 배열 jsonb): 구조 고정 불가 → z.unknown()
 *  - draftContent(Tiptap 초안 jsonb): 생성 전 null → z.unknown().nullable()
 *  - draftTextEditable(사람 수정 텍스트): nullable string
 *  - slots: 이미지 슬롯 배열 (curriculumImageSlotSchema)
 */
export const curriculumChapterDetailSchema = curriculumChapterItemSchema.extend({
  /** 소주제 배열 jsonb — 구조 고정 불가. */
  outline: z.unknown(),
  /** Tiptap JSON 초안 jsonb — 생성 전 null. */
  draftContent: z.unknown().nullable(),
  /** 사람이 초안을 수정한 텍스트 — 없으면 null. */
  draftTextEditable: z.string().nullable(),
  slots: z.array(curriculumImageSlotSchema),
});
export type CurriculumChapterDetail = z.infer<typeof curriculumChapterDetailSchema>;

/**
 * 시리즈 목록 카드 (bot_curriculum_series 요약 + API 집계 필드).
 * totalChapters(챕터 총 수) · publishedChapters(게시 완료 챕터 수) · readyChapters(ready 챕터 수):
 * Story 13.5 API가 bot_curriculum_chapters COUNT로 계산.
 * nullable: intro(한 줄 소개).
 */
export const curriculumSeriesItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  board: z.string(),
  tool: z.string(),
  intro: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  /** 챕터 총 수 — API 집계값 (DB 컬럼 아님). */
  totalChapters: z.number().int(),
  /** 게시 완료 챕터 수 — API 집계값. */
  publishedChapters: z.number().int(),
  /** ready 상태 챕터 수 — API 집계값. */
  readyChapters: z.number().int(),
});
export type CurriculumSeriesItem = z.infer<typeof curriculumSeriesItemSchema>;

/**
 * 시리즈 상세 (bot_curriculum_series 전체 컬럼 + chapters).
 * DB 컬럼(id · title · board · tool · intro · isActive · created_at)만 포함.
 * 집계 필드는 포함하지 않음 — chapters 배열에서 직접 파생 가능.
 */
export const curriculumSeriesDetailSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  board: z.string(),
  tool: z.string(),
  intro: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  chapters: z.array(curriculumChapterItemSchema),
});
export type CurriculumSeriesDetail = z.infer<typeof curriculumSeriesDetailSchema>;

// ── Task 3: 목록 응답 + 쿼리 파라미터 스키마 ─────────────────────────────────

/** GET /api/v1/admin/bots/curriculum/series 목록 응답 */
export const paginatedCurriculumSeriesSchema = paginatedResponseSchema(
  curriculumSeriesItemSchema,
);
export type PaginatedCurriculumSeries = z.infer<typeof paginatedCurriculumSeriesSchema>;

/** GET /api/v1/admin/bots/curriculum/chapters 목록 응답 */
export const paginatedCurriculumChaptersSchema = paginatedResponseSchema(
  curriculumChapterItemSchema,
);
export type PaginatedCurriculumChapters = z.infer<typeof paginatedCurriculumChaptersSchema>;

/** GET /api/v1/admin/bots/curriculum/series 쿼리 파라미터 */
export const adminCurriculumSeriesQuerySchema = z.object({
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminCurriculumSeriesQuery = z.infer<typeof adminCurriculumSeriesQuerySchema>;

/** GET /api/v1/admin/bots/curriculum/chapters 쿼리 파라미터 */
export const adminCurriculumChaptersQuerySchema = z.object({
  seriesId: z.string().uuid().optional(),
  status: curriculumChapterStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminCurriculumChaptersQuery = z.infer<typeof adminCurriculumChaptersQuerySchema>;

// ── Task 4: CRUD 요청 스키마 ────────────────────────────────────────────────────

/** POST /api/v1/admin/bots/curriculum/series — 시리즈 생성 */
export const curriculumSeriesCreateSchema = z.object({
  title: z.string().min(1),
  board: z.string().min(1),
  tool: z.string().min(1),
  intro: z.string().optional(),
  isActive: z.boolean().optional(),
});
export type CurriculumSeriesCreate = z.infer<typeof curriculumSeriesCreateSchema>;

/** PATCH /api/v1/admin/bots/curriculum/series/:id — 시리즈 수정 (변경 키만 전달) */
export const curriculumSeriesUpdateSchema = curriculumSeriesCreateSchema.partial();
export type CurriculumSeriesUpdate = z.infer<typeof curriculumSeriesUpdateSchema>;

/**
 * PATCH /api/v1/admin/bots/curriculum/chapters/:id/draft — 챕터 초안 본문 수정.
 * draftContent: Tiptap JSON 전체 교체.
 * draftTextEditable: 사람이 직접 고친 텍스트 (선택).
 */
export const curriculumChapterDraftUpdateSchema = z.object({
  draftContent: z.unknown(),
  draftTextEditable: z.string().optional(),
});
export type CurriculumChapterDraftUpdate = z.infer<typeof curriculumChapterDraftUpdateSchema>;

/**
 * PATCH /api/v1/admin/bots/curriculum/chapters/:id/schedule — 챕터 예약시각 지정.
 * scheduledAt: ISO 8601 timestamptz 문자열 또는 null(예약 취소).
 */
export const curriculumChapterScheduleSchema = z.object({
  scheduledAt: z.string().nullable(),
});
export type CurriculumChapterSchedule = z.infer<typeof curriculumChapterScheduleSchema>;

/**
 * PATCH /api/v1/admin/bots/curriculum/slots/:id/fill — 슬롯 완료 처리.
 * imageUrl: 버킷에 업로드된 URL — 이 값으로 슬롯 status=ready 전환.
 * sourceUrl: 원본 URL (선택 — web_download 슬롯 출처 표기용).
 */
export const curriculumSlotFillSchema = z.object({
  imageUrl: z.string().url(),
  sourceUrl: z.string().optional(),
});
export type CurriculumSlotFill = z.infer<typeof curriculumSlotFillSchema>;

/**
 * POST /api/v1/admin/bots/curriculum/slots/:id/generate — 🟢 자동 이미지 생성 요청.
 * force: true이면 이미 ready인 슬롯도 재생성.
 * imageModel: 생성 모델 지정 (미지정 시 시스템 기본값 사용).
 * diagramPrompt: ai_diagram 슬롯의 일회성 프롬프트 override (미지정 시 슬롯 diagramPrompt 사용).
 */
export const curriculumSlotGenerateSchema = z.object({
  force: z.boolean().optional(),
  imageModel: z
    .object({
      provider: z.string().min(1),
      model: z.string().min(1),
    })
    .optional(),
  diagramPrompt: z.string().optional(),
});
export type CurriculumSlotGenerate = z.infer<typeof curriculumSlotGenerateSchema>;

// ── Task 5: BullMQ 잡 페이로드 ────────────────────────────────────────────────

/**
 * `bot.curriculum-draft`(커리큘럼 초안 생성 잡) 페이로드.
 * Story 13.3 워커가 소비.
 * chapterId + seriesId 조합으로 앞편 연속성 컨텍스트를 로드한다.
 */
export const botCurriculumDraftJobSchema = z.object({
  chapterId: z.string().uuid(),
  seriesId: z.string().uuid(),
});
export type BotCurriculumDraftJobPayload = z.infer<typeof botCurriculumDraftJobSchema>;

/**
 * `bot.curriculum-publish`(예약 게시 스캔 잡) 페이로드.
 * Story 13.6 워커가 소비. 기존 단일 `bot` 큐 디스패처에 이 job.name을 추가(Story 13.6).
 * chapterId 미지정 시 전체 ready 챕터를 스캔해 scheduled_at <= now인 것만 게시.
 */
export const botCurriculumPublishJobSchema = z.object({
  chapterId: z.string().uuid().optional(),
});
export type BotCurriculumPublishJobPayload = z.infer<typeof botCurriculumPublishJobSchema>;
