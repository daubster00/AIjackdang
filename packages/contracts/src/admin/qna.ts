/**
 * Q&A 관리 계약 (Story 9.7).
 *
 * 도메인 어휘:
 *   - Q&A 상태 (UI): 답변대기 / 답변있음 / 해결됨
 *   - DB 표현: questions.isResolved(boolean) + answers count 로 도출
 *     isResolved=false + answerCount=0  → 'pending'  (답변대기)
 *     isResolved=false + answerCount>0  → 'answered' (답변있음)
 *     isResolved=true                   → 'resolved' (해결됨)
 *   - PATCH /status 는 isResolved 플래그를 강제 변경한다.
 *
 * 콘텐츠 상태:
 *   - questions.status: 'draft' | 'published' | 'hidden' | 'deleted'
 *   - answers.status:   'published' | 'hidden' | 'deleted'
 */

import { z } from "zod";

// ── Q&A 파생 상태 ─────────────────────────────────────────────────────────────

/** Q&A 진행 상태 (UI 어휘 ↔ API 전달 값) */
export const qnaStatusEnum = z.enum(["pending", "answered", "resolved"]);
export type QnaStatus = z.infer<typeof qnaStatusEnum>;

/** 질문 콘텐츠 상태 */
export const questionContentStatusEnum = z.enum(["draft", "published", "hidden", "deleted"]);
export type QuestionContentStatus = z.infer<typeof questionContentStatusEnum>;

/** 답변 콘텐츠 상태 */
export const answerContentStatusEnum = z.enum(["published", "hidden", "deleted"]);
export type AnswerContentStatus = z.infer<typeof answerContentStatusEnum>;

// ── 질문 목록 쿼리 ─────────────────────────────────────────────────────────────

/** GET /api/v1/admin/qna/questions 쿼리 파라미터 */
export const adminQnaQuestionsQuerySchema = z.object({
  /** Q&A 상태 필터 (파생 상태 기준) */
  qnaStatus: qnaStatusEnum.optional(),
  /** 콘텐츠 상태 필터 */
  contentStatus: questionContentStatusEnum.optional(),
  /** 신고 있는 항목만 */
  hasReports: z.coerce.boolean().optional(),
  /** 기간 시작 (ISO 날짜 문자열) */
  dateFrom: z.string().optional(),
  /** 기간 종료 (ISO 날짜 문자열) */
  dateTo: z.string().optional(),
  /** 제목/본문 검색어 */
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminQnaQuestionsQuery = z.infer<typeof adminQnaQuestionsQuerySchema>;

// ── 답변 목록 쿼리 ─────────────────────────────────────────────────────────────

/** GET /api/v1/admin/qna/answers 쿼리 파라미터 */
export const adminQnaAnswersQuerySchema = z.object({
  /** 특정 질문의 답변만 조회 */
  questionId: z.string().uuid().optional(),
  /** 콘텐츠 상태 필터 */
  contentStatus: answerContentStatusEnum.optional(),
  /** 신고 있는 항목만 */
  hasReports: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminQnaAnswersQuery = z.infer<typeof adminQnaAnswersQuerySchema>;

// ── 개별 응답 아이템 ──────────────────────────────────────────────────────────

/** 질문 목록 아이템 */
export const adminQnaQuestionItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  /** 콘텐츠 운영 상태 */
  status: questionContentStatusEnum,
  /** 파생된 Q&A 상태 */
  qnaStatus: qnaStatusEnum,
  userId: z.string().nullable(),
  authorNickname: z.string().nullable(),
  /** G5: 작성자 직접 업로드 프로필 사진 URL */
  authorAvatarUrl: z.string().nullable().optional(),
  /** G5: 작성자 소셜 provider 프로필 사진 URL */
  authorImage: z.string().nullable().optional(),
  /** G5: 작성자 기본 아바타 인덱스 */
  authorDefaultAvatarIndex: z.number().nullable().optional(),
  /** 질문 본문 (Tiptap JSON 또는 LightEditor 래퍼) */
  contentJson: z.unknown().nullable().optional(),
  answerCount: z.number(),
  viewCount: z.number(),
  reportCount: z.number(),
  isResolved: z.boolean(),
  helpfulAnswerId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});
export type AdminQnaQuestionItem = z.infer<typeof adminQnaQuestionItemSchema>;

/** 답변 목록 아이템 */
export const adminQnaAnswerItemSchema = z.object({
  id: z.string(),
  questionId: z.string(),
  /** 질문 제목(JOIN) */
  questionTitle: z.string().nullable(),
  status: answerContentStatusEnum,
  userId: z.string().nullable(),
  authorNickname: z.string().nullable(),
  /** G5: 작성자 직접 업로드 프로필 사진 URL */
  authorAvatarUrl: z.string().nullable().optional(),
  /** G5: 작성자 소셜 provider 프로필 사진 URL */
  authorImage: z.string().nullable().optional(),
  /** G5: 작성자 기본 아바타 인덱스 */
  authorDefaultAvatarIndex: z.number().nullable().optional(),
  /** 답변 본문 (Tiptap JSON 또는 LightEditor 래퍼) */
  contentJson: z.unknown().nullable().optional(),
  reportCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});
export type AdminQnaAnswerItem = z.infer<typeof adminQnaAnswerItemSchema>;

// ── 목록 응답 ─────────────────────────────────────────────────────────────────

const pageMeta = z.object({
  page: z.number(),
  pageSize: z.number(),
  totalItems: z.number(),
  totalPages: z.number(),
});

export const adminQnaQuestionsListResponseSchema = z.object({
  items: z.array(adminQnaQuestionItemSchema),
  meta: pageMeta,
});
export type AdminQnaQuestionsListResponse = z.infer<typeof adminQnaQuestionsListResponseSchema>;

export const adminQnaAnswersListResponseSchema = z.object({
  items: z.array(adminQnaAnswerItemSchema),
  meta: pageMeta,
});
export type AdminQnaAnswersListResponse = z.infer<typeof adminQnaAnswersListResponseSchema>;

// ── 액션 요청 스키마 ──────────────────────────────────────────────────────────

/**
 * PATCH /api/v1/admin/qna/questions/:id/status
 * Q&A 상태 강제 변경. 'pending'/'answered'/'resolved' 중 하나를 선택하면
 * 서버에서 isResolved 플래그를 갱신한다.
 */
export const adminQnaStatusSchema = z.object({
  qnaStatus: qnaStatusEnum,
});
export type AdminQnaStatusInput = z.infer<typeof adminQnaStatusSchema>;

// ── 공통 응답 ─────────────────────────────────────────────────────────────────

/** 질문 단순 성공 응답 */
export const adminQnaQuestionActionResponseSchema = z.object({
  id: z.string(),
  status: questionContentStatusEnum,
  updatedAt: z.string(),
});
export type AdminQnaQuestionActionResponse = z.infer<typeof adminQnaQuestionActionResponseSchema>;

/** 답변 단순 성공 응답 */
export const adminQnaAnswerActionResponseSchema = z.object({
  id: z.string(),
  status: answerContentStatusEnum,
  updatedAt: z.string(),
});
export type AdminQnaAnswerActionResponse = z.infer<typeof adminQnaAnswerActionResponseSchema>;
