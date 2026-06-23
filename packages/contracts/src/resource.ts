/**
 * 실전자료(resource) 도메인 API 계약 — Epic 4 소유
 *
 * Zod 스키마 + 추론 타입 전부 export.
 * comment/reaction/bookmark/report 스키마는 Epic 5 소유 — 여기서 정의 금지.
 * BullMQ resource.scan job 페이로드 타입은 Story 4.5에서 이 파일에 추가 예정.
 */

import { z } from "zod";
import { paginationQuerySchema } from "./common";

// ── 열거형 스키마 ─────────────────────────────────────────────────────────────

/** 실전자료 유형 */
export const resourceTypeSchema = z.enum([
  "prompt",
  "claude-code-skill",
  "mcp",
  "rules-config",
  "template-checklist",
]);
export type ResourceType = z.infer<typeof resourceTypeSchema>;

/** 난이도 */
export const difficultySchema = z.enum(["beginner", "intermediate", "advanced"]);
export type Difficulty = z.infer<typeof difficultySchema>;

/**
 * 파일 바이러스 스캔 상태
 * worker: resource.scan BullMQ job이 처리
 */
export const scanStatusSchema = z.enum(["pending", "clean", "infected", "error"]);
export type ScanStatus = z.infer<typeof scanStatusSchema>;

/**
 * 실전자료 운영 상태 (AR-7 soft-delete)
 * post.ts의 postStatusSchema와 값이 같지만 도메인 독립성을 위해 별도 정의.
 */
export const resourceStatusSchema = z.enum(["draft", "published", "hidden", "deleted"]);
export type ResourceStatus = z.infer<typeof resourceStatusSchema>;

// ── 첨부파일 스키마 ───────────────────────────────────────────────────────────

/** 첨부파일 응답 스키마 */
export const resourceFileSchema = z.object({
  id: z.string().uuid(),
  originalName: z.string(),
  storageKey: z.string(),
  fileSize: z.number().int().nonnegative(),
  mimeType: z.string(),
  allowedExtension: z.enum(["zip", "md", "txt", "json", "pdf", "docx", "xlsx"]),
  isPrimary: z.boolean(),
  scanStatus: scanStatusSchema,
  displayOrder: z.number().int().nonnegative(),
});
export type ResourceFile = z.infer<typeof resourceFileSchema>;

// ── 작성·수정 스키마 ──────────────────────────────────────────────────────────

/**
 * 실전자료 등록 요청 규격.
 * copyrightAgreed: 반드시 true여야 제출 가능 (false 시 validation 실패).
 * descriptionJson / usageJson: Tiptap JSON — HTML 원본 저장 절대 금지 (AR-8).
 * tags: 최대 10개 (tag 도메인 연결은 별도 Story에서 처리).
 */
export const createResourceSchema = z.object({
  title: z.string().trim().min(2).max(150),
  summary: z.string().trim().min(1).max(300),
  resourceType: resourceTypeSchema,
  environment: z.array(z.string()),
  difficulty: difficultySchema,
  /** Tiptap JSON 객체 — HTML 원본 저장 금지 */
  descriptionJson: z.record(z.string(), z.unknown()),
  /** Tiptap JSON 객체 */
  usageJson: z.record(z.string(), z.unknown()),
  cautionJson: z.record(z.string(), z.unknown()).optional(),
  version: z.string().optional(),
  referenceLinks: z.array(z.object({ label: z.string(), url: z.string().url() })).optional(),
  /** 저작권 동의 — 반드시 true여야 함 */
  copyrightAgreed: z.literal(true),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
});
export type CreateResourceInput = z.infer<typeof createResourceSchema>;

/** 실전자료 수정 요청 규격 — 모든 필드 선택적 */
export const updateResourceSchema = createResourceSchema.partial();
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;

// ── 응답 스키마 ───────────────────────────────────────────────────────────────

/**
 * 실전자료 목록 카드 스키마.
 * commentCount: Epic 5(댓글 도메인)가 활성화되기 전까지 항상 0 반환.
 */
export const resourceCardSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  resourceType: resourceTypeSchema,
  environment: z.array(z.string()),
  difficulty: difficultySchema,
  authorId: z.string().uuid().nullable(),
  authorNickname: z.string().nullable(),
  authorAvatarIndex: z.number().int().nonnegative(),
  avgRating: z.number(),
  ratingCount: z.number().int().nonnegative(),
  downloadCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(), // TODO: Epic 5 활성화 전 항상 0 반환
  tagNames: z.array(z.string()),
  updatedAt: z.string(), // ISO 8601 UTC
  status: resourceStatusSchema,
});
export type ResourceCard = z.infer<typeof resourceCardSchema>;

/**
 * 실전자료 상세 스키마.
 * resourceCardSchema를 확장하여 본문·파일 목록·생성일 추가.
 */
export const resourceDetailSchema = resourceCardSchema.extend({
  descriptionJson: z.record(z.string(), z.unknown()),
  usageJson: z.record(z.string(), z.unknown()),
  cautionJson: z.record(z.string(), z.unknown()).nullable(),
  version: z.string().nullable(),
  referenceLinks: z.array(z.object({ label: z.string(), url: z.string() })).nullable(),
  files: z.array(resourceFileSchema),
  createdAt: z.string(), // ISO 8601 UTC
});
export type ResourceDetail = z.infer<typeof resourceDetailSchema>;

// ── 목록 쿼리 스키마 ──────────────────────────────────────────────────────────

/**
 * 실전자료 목록 쿼리 파라미터.
 * paginationQuerySchema(page, pageSize)를 확장.
 * 쿼리 파라미터는 문자열로 전달되므로 coerce 적용(paginationQuerySchema 포함).
 */
export const listResourcesQuerySchema = paginationQuerySchema.extend({
  type: resourceTypeSchema.optional(),
  // 콤마 구분 다중 유형(우선 적용). 예) "claude-code-skill,mcp" — mcp-skills 페이지가 2종을 함께 노출
  types: z.string().optional(),
  environment: z.string().optional(),
  difficulty: difficultySchema.optional(),
  sort: z.enum(["latest", "popular", "rating", "downloads", "reviews"]).default("latest"),
  q: z.string().optional(),
});
export type ListResourcesQuery = z.infer<typeof listResourcesQuerySchema>;

// ── BullMQ Job 페이로드 ───────────────────────────────────────────────────────

/**
 * `file-scan` 큐의 `resource.scan` job 페이로드 타입 — Story 4.5
 *
 * BullMQ Queue 발행(API) / Worker 소비 양쪽에서 이 타입으로 검증한다.
 * AR-16: 큐명 `'file-scan'`, job명 `'resource.scan'`
 */
export const resourceScanJobPayloadSchema = z.object({
  /** 스캔 대상 resource_files.id 목록 */
  resourceFileIds: z.array(z.string().uuid()),
  /** 소속 자료 ID */
  resourceId: z.string().uuid(),
});
export type ResourceScanJobPayload = z.infer<typeof resourceScanJobPayloadSchema>;

// ── 다운로드 응답 스키마 ─────────────────────────────────────────────────────

/**
 * 다운로드 presigned URL 응답 스키마 — Story 4.6
 *
 * url: S3 presigned URL (60초 만료)
 * expiresAt: 만료 시각 (ISO 8601 UTC)
 * fileName: 다운로드 시 사용할 파일명
 */
export const downloadResponseSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string(), // ISO 8601 UTC
  fileName: z.string(),
});
export type DownloadResponse = z.infer<typeof downloadResponseSchema>;

// ── 평점 스키마 ───────────────────────────────────────────────────────────────

/** 평점 등록/수정 요청 규격. score: 1~5 정수 */
export const ratingSchema = z.object({
  score: z.number().int().min(1).max(5),
});
export type RatingInput = z.infer<typeof ratingSchema>;

/** 평점 응답 스키마 */
export const ratingResponseSchema = z.object({
  id: z.string().uuid(),
  resourceId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  score: z.number().int().min(1).max(5),
  createdAt: z.string(), // ISO 8601 UTC
  updatedAt: z.string(), // ISO 8601 UTC
});
export type RatingResponse = z.infer<typeof ratingResponseSchema>;
