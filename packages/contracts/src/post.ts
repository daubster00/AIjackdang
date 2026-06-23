import { z } from "zod";
import { paginatedResponseSchema } from "./common";

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
