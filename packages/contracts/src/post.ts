import { z } from "zod";
import { paginatedResponseSchema } from "./common";

// ── 창작 스펙 (Story 2.11) ────────────────────────────────────────────────────

/**
 * AI 툴·모델 항목 1개.
 * name: 필수, model/role: 선택
 */
export const aiToolSchema = z.object({
  name: z.string().min(1).max(100),
  model: z.string().max(100).optional(),
  role: z.string().max(200).optional(),
});
export type AiTool = z.infer<typeof aiToolSchema>;

/**
 * 창작 스펙 Zod 스키마 — 전 필드 optional.
 * DB 컬럼과의 매핑:
 *   mediaType   → media_type (jsonb 배열)
 *   tools       → tools (jsonb 배열)
 *   prompt      → prompt (text) — XSS sanitize 필수
 *   negPrompt   → negative_prompt (text)
 *   params      → params (jsonb)
 *   postProcess → postprocess (jsonb)
 *   costType    → cost_type enum ("free"|"paid")
 *   timeSpent   → time_spent (text)
 *   licenseNote → license_note (text) — license + commercial 병합
 */
export const creativeSpecSchema = z.object({
  mediaType: z.array(z.string()).optional(),
  tools: z.array(aiToolSchema).optional(),
  prompt: z.string().max(10000).optional(),
  negPrompt: z.string().max(5000).optional(),
  params: z.record(z.string(), z.string()).optional(),
  postProcess: z.string().max(2000).optional(),
  costType: z.enum(["free", "paid"]).optional(),
  timeSpent: z.string().max(100).optional(),
  licenseNote: z.string().max(500).optional(),
});
export type CreativeSpec = z.infer<typeof creativeSpecSchema>;

/**
 * createPost 에 창작 스펙을 추가한 확장 스키마.
 * board='ai-creation' 일 때만 creativeSpec 유효, 나머지 board에서는 무시.
 */
export const createPostWithSpecSchema = z.object({
  board: z.string().trim().min(1).max(50),
  category: z.string().trim().max(50).optional(),
  title: z.string().trim().min(2).max(300),
  contentJson: z.record(z.string(), z.unknown()),
  summary: z.string().trim().max(500).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  creativeSpec: creativeSpecSchema.optional(),
});
export type CreatePostWithSpecInput = z.infer<typeof createPostWithSpecSchema>;

// ── 구인·외주 스펙 (Story 2.12) ───────────────────────────────────────────────

/**
 * 연락방법 스키마.
 * types: 선택된 연락 유형 배열 (사이트 쪽지, 이메일, 오픈채팅 링크)
 * external: 외부 연락처 (이메일 또는 오픈채팅 링크 URL)
 */
export const contactMethodSchema = z.object({
  types: z.array(z.string()).min(1),
  external: z.string().optional(),
});
export type ContactMethod = z.infer<typeof contactMethodSchema>;

/**
 * recruitPostSchema — Zod 검증 계약.
 * 필수: postKind, fields, recruitStatus, contactMethod
 * 선택: budget, duration, workMode
 */
export const recruitPostSchema = z.object({
  postKind: z.enum(["request", "offer"]),
  fields: z.array(z.string()).min(1),
  recruitStatus: z.enum(["open", "closed"]).default("open"),
  budget: z.string().optional(),
  duration: z.string().optional(),
  workMode: z.enum(["remote", "onsite", "hybrid"]).optional(),
  contactMethod: contactMethodSchema,
});
export type RecruitPost = z.infer<typeof recruitPostSchema>;

/**
 * createGigPostSchema — createPostSchema + recruitPost 필수.
 * board='gigs' 게시글 작성 시 사용.
 */
export const createGigPostSchema = z.object({
  board: z.string().trim().min(1).max(50),
  category: z.string().trim().max(50).optional(),
  title: z.string().trim().min(2).max(300),
  contentJson: z.record(z.string(), z.unknown()),
  summary: z.string().trim().max(500).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  recruitPost: recruitPostSchema,
});
export type CreateGigPostInput = z.infer<typeof createGigPostSchema>;

/**
 * 목록 카드에서 사용하는 recruit 메타 (요약 정보).
 */
export const recruitMetaSchema = z.object({
  postKind: z.enum(["request", "offer"]),
  fields: z.array(z.string()),
  recruitStatus: z.enum(["open", "closed"]),
  budget: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
  workMode: z.enum(["remote", "onsite", "hybrid"]).nullable().optional(),
  contactMethod: contactMethodSchema,
});
export type RecruitMeta = z.infer<typeof recruitMetaSchema>;

// ── 게시글 운영 상태 ──────────────────────────────────────────────────────────
// AR-7 soft-delete: status + deleted_at 패턴

/** 게시글 운영 상태 enum. */
export const postStatusSchema = z.enum(["draft", "published", "hidden", "deleted"]);
export type PostStatus = z.infer<typeof postStatusSchema>;

// ── 목록 카드 ─────────────────────────────────────────────────────────────────

/**
 * 게시글 목록 카드 스키마.
 * 목록 API 응답에 사용되는 요약 정보 — 본문(contentJson/contentHtml) 제외.
 * isPinned: 공지 게시판에서 상단 고정 여부 (Story 2.9).
 */
export const postCardSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  board: z.string(),
  authorNickname: z.string().nullable(), // 탈퇴 회원은 null
  authorGrade: z.string().optional(),
  createdAt: z.string(), // ISO 8601 UTC
  viewCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  likeCount: z.number().int().nonnegative(),
  hasAttachment: z.boolean(),
  isPinned: z.boolean(),
  tags: z.array(z.string()),
  recruitMeta: recruitMetaSchema.nullable().optional(),
});
export type PostCard = z.infer<typeof postCardSchema>;

// ── 상세 ──────────────────────────────────────────────────────────────────────

/**
 * 게시글 상세 스키마.
 * postCard를 확장하여 본문·소유권·고정·SEO 정보를 추가.
 * contentHtml: 서버에서 contentJson → sanitize-html 변환 결과 (코드블록 보존, script 차단).
 * contentJson: 에디터 재편집용 원본 Tiptap JSON.
 */
export const postDetailSchema = postCardSchema.extend({
  contentHtml: z.string(),
  contentJson: z.record(z.string(), z.unknown()),
  authorId: z.string().uuid().nullable(),
  isOwner: z.boolean(),
  isPinned: z.boolean(),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  status: postStatusSchema,
  updatedAt: z.string(), // ISO 8601 UTC
  /** Story 2.11: AI 창작마당 창작 스펙. board='ai-creation'이고 스펙이 있을 때만 존재. */
  creativeSpec: creativeSpecSchema.nullable().optional(),
  /** Story 2.12: 작당 의뢰소 모집 스펙. board='gigs'이고 스펙이 있을 때만 존재. */
  recruitPost: recruitPostSchema.nullable().optional(),
});
export type PostDetail = z.infer<typeof postDetailSchema>;

// ── 작성 / 수정 ───────────────────────────────────────────────────────────────

/**
 * 게시글 작성 요청 규격.
 * board: BOARDS 상수의 슬러그 (max 50).
 * contentJson: Tiptap 원본 JSON — HTML 원본 저장 절대 금지.
 * tags: 최대 10개, 각 태그 최대 30자.
 */
export const createPostSchema = z.object({
  board: z.string().trim().min(1).max(50),
  category: z.string().trim().max(50).optional(),
  title: z.string().trim().min(2).max(300),
  contentJson: z.record(z.string(), z.unknown()),
  summary: z.string().trim().max(500).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
});
export type CreatePostInput = z.infer<typeof createPostSchema>;

/** 게시글 수정 요청 규격 — 모든 필드 선택적. */
export const updatePostSchema = createPostSchema.partial();
export type UpdatePostInput = z.infer<typeof updatePostSchema>;

// ── 목록 응답 ─────────────────────────────────────────────────────────────────

/**
 * 페이지네이션된 게시글 목록 응답.
 * 형식: { items: PostCard[], meta: { page, pageSize, totalItems, totalPages } }
 */
export const paginatedPostsSchema = paginatedResponseSchema(postCardSchema);
export type PaginatedPosts = z.infer<typeof paginatedPostsSchema>;
