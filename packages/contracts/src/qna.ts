/**
 * Q&A 도메인 Zod 계약 (contracts).
 *
 * 이 파일의 스키마는 apps/api(Fastify validation), apps/web(클라이언트 fetch body),
 * apps/worker 모두에서 import 가능하다.
 * DB 직접 접근 없음 — 순수 Zod 검증/타입 정의만.
 */

import { z } from "zod";
import { paginationQuerySchema } from "./common";

// ── 요청 스키마 ───────────────────────────────────────────────────────────────

/**
 * 질문 생성 요청.
 * tags 는 taggable 다형 참조 대상(Epic 2 / Epic 5 소유)이며
 * API 서버가 taggable 테이블에 별도 upsert 처리한다.
 */
export const createQuestionSchema = z.object({
  title: z.string().trim().min(2).max(300),
  /** Tiptap JSON 형식 본문. HTML 저장 절대 금지(AR-8). */
  contentJson: z.record(z.string(), z.unknown()),
  /** 태그 슬러그 목록 (taggable 연결용). 빈 배열 = 태그 없음. */
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
});
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

/**
 * 답변 생성 요청.
 */
export const createAnswerSchema = z.object({
  questionId: z.string().uuid(),
  /** Tiptap JSON 형식 본문. HTML 저장 절대 금지(AR-8). */
  contentJson: z.record(z.string(), z.unknown()),
});
export type CreateAnswerInput = z.infer<typeof createAnswerSchema>;

/**
 * 질문 수정 요청 (partial — 보낸 필드만 갱신).
 */
export const updateQuestionSchema = createQuestionSchema.partial();
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;

/**
 * 질문 해결 상태 토글 요청.
 * is_resolved=true 이면 deriveQuestionStatus 에서 'resolved' 로 도출된다.
 */
export const updateQuestionStatusSchema = z.object({
  isResolved: z.boolean(),
});
export type UpdateQuestionStatusInput = z.infer<typeof updateQuestionStatusSchema>;

/**
 * 도움된 답변 지정/해제 요청.
 * answerId=null 이면 helpful_answer_id 를 해제한다.
 * helpful_answer_id 와 is_resolved 는 독립적이므로
 * 도움된 답변 지정이 자동 해결(is_resolved=true)을 의미하지 않는다.
 */
export const setHelpfulAnswerSchema = z.object({
  answerId: z.string().uuid().nullable(),
});
export type SetHelpfulAnswerInput = z.infer<typeof setHelpfulAnswerSchema>;

/**
 * 질문 목록 조회 쿼리.
 * paginationQuerySchema(page, pageSize) 를 확장한다.
 *
 * status 필터:
 *   - 'all'      : 전체 (published 한정, deleted 제외)
 *   - 'waiting'  : 공개 답변 0개 + is_resolved=false
 *   - 'answered' : 공개 답변 1개 이상 + is_resolved=false
 *   - 'resolved' : is_resolved=true
 *   - 'popular'  : view_count 상위 (sort 과 별개)
 *
 * sort 정렬:
 *   - 'latest'  : created_at DESC (기본)
 *   - 'popular' : view_count DESC
 */
export const questionListQuerySchema = paginationQuerySchema.extend({
  status: z
    .enum(["all", "waiting", "answered", "resolved", "popular"])
    .default("all"),
  sort: z.enum(["latest", "popular"]).default("latest"),
});
export type QuestionListQuery = z.infer<typeof questionListQuerySchema>;

// ── 응답 스키마 ───────────────────────────────────────────────────────────────

/**
 * 답변 단건 응답.
 * status 는 DB enum 값(published/hidden/deleted)이 아닌
 * 프론트 표시용 문자열을 필요 시 API 서버에서 변환해 내려준다.
 */
export const answerResponseSchema = z.object({
  id: z.string().uuid(),
  questionId: z.string().uuid(),
  /** 작성자 정보 (탈퇴 시 null) */
  author: z
    .object({
      id: z.string().uuid(),
      nickname: z.string(),
      avatarUrl: z.string().nullable(),
    })
    .nullable(),
  contentJson: z.record(z.string(), z.unknown()),
  status: z.enum(["published", "hidden", "deleted"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AnswerResponse = z.infer<typeof answerResponseSchema>;

/**
 * 질문 상세 응답.
 * derivedStatus('waiting'|'answered'|'resolved') 는
 * 서버가 deriveQuestionStatus() 로 도출한 UI 상태를 내려준다.
 */
export const questionDetailResponseSchema = z.object({
  id: z.string().uuid(),
  /** 작성자 정보 (탈퇴 시 null) */
  author: z
    .object({
      id: z.string().uuid(),
      nickname: z.string(),
      avatarUrl: z.string().nullable(),
    })
    .nullable(),
  title: z.string(),
  /** SEO URL 슬러그 (`/questions/{slug}` 라우팅·canonical). */
  slug: z.string(),
  contentJson: z.record(z.string(), z.unknown()),
  status: z.enum(["draft", "published", "hidden", "deleted"]),
  /** packages/core deriveQuestionStatus() 도출 결과 */
  derivedStatus: z.enum(["waiting", "answered", "resolved"]),
  isResolved: z.boolean(),
  helpfulAnswerId: z.string().uuid().nullable(),
  viewCount: z.number().int(),
  answerCount: z.number().int(),
  /** 태그 슬러그 목록 (taggable 연결, Epic 2/5 구현 후 채워짐) */
  tags: z.array(z.string()),
  answers: z.array(answerResponseSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type QuestionDetailResponse = z.infer<typeof questionDetailResponseSchema>;

/**
 * 질문 목록 아이템 응답 (answers 전체 미포함 — 카운트만 포함).
 */
export const questionListItemResponseSchema = z.object({
  id: z.string().uuid(),
  author: z
    .object({
      id: z.string().uuid(),
      nickname: z.string(),
      avatarUrl: z.string().nullable(),
    })
    .nullable(),
  title: z.string(),
  /** SEO URL 슬러그 (`/questions/{slug}` 라우팅). */
  slug: z.string(),
  status: z.enum(["draft", "published", "hidden", "deleted"]),
  derivedStatus: z.enum(["waiting", "answered", "resolved"]),
  isResolved: z.boolean(),
  viewCount: z.number().int(),
  answerCount: z.number().int(),
  tags: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type QuestionListItemResponse = z.infer<typeof questionListItemResponseSchema>;
