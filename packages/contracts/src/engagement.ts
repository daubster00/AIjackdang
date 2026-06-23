import { z } from "zod";

// ── Shared enums ──────────────────────────────────────────────────────────────

export const commentTargetTypeSchema = z.enum([
  "post",
  "question",
  "answer",
  "resource",
  "comment",
]);
export type CommentTargetType = z.infer<typeof commentTargetTypeSchema>;

export const reactionTargetTypeSchema = z.enum([
  "post",
  "question",
  "answer",
  "resource",
  "comment",
]);
export type ReactionTargetType = z.infer<typeof reactionTargetTypeSchema>;

export const bookmarkTargetTypeSchema = z.enum(["post", "question", "resource"]);
export type BookmarkTargetType = z.infer<typeof bookmarkTargetTypeSchema>;

export const reportTargetTypeSchema = z.enum([
  "post",
  "question",
  "answer",
  "resource",
  "comment",
]);
export type ReportTargetType = z.infer<typeof reportTargetTypeSchema>;

// ── comment ───────────────────────────────────────────────────────────────────

export const commentSchema = z.object({
  id: z.string().uuid(),
  authorId: z.string().uuid(),
  targetType: commentTargetTypeSchema,
  targetId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  content: z.string(),
  status: z.enum(["visible", "deleted"]),
  deletedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Comment = z.infer<typeof commentSchema>;

export const createCommentInputSchema = z.object({
  targetType: commentTargetTypeSchema,
  targetId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  content: z.string().min(1).max(5000),
});
export type CreateCommentInput = z.infer<typeof createCommentInputSchema>;

// ── reaction ──────────────────────────────────────────────────────────────────

export const reactionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  targetType: reactionTargetTypeSchema,
  targetId: z.string().uuid(),
  reactionType: z.enum(["like", "dislike"]),
  createdAt: z.string().datetime(),
});
export type Reaction = z.infer<typeof reactionSchema>;

export const createReactionInputSchema = z.object({
  targetType: reactionTargetTypeSchema,
  targetId: z.string().uuid(),
  reactionType: z.enum(["like", "dislike"]).default("like"),
});
export type CreateReactionInput = z.infer<typeof createReactionInputSchema>;

// ── bookmark ──────────────────────────────────────────────────────────────────

export const bookmarkSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  targetType: bookmarkTargetTypeSchema,
  targetId: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type Bookmark = z.infer<typeof bookmarkSchema>;

export const createBookmarkInputSchema = z.object({
  targetType: bookmarkTargetTypeSchema,
  targetId: z.string().uuid(),
});
export type CreateBookmarkInput = z.infer<typeof createBookmarkInputSchema>;

// ── report ────────────────────────────────────────────────────────────────────

export const reportSchema = z.object({
  id: z.string().uuid(),
  reporterId: z.string().uuid(),
  targetType: reportTargetTypeSchema,
  targetId: z.string().uuid(),
  reasonCode: z.string(),
  detail: z.string().nullable(),
  status: z.enum(["pending", "reviewing", "resolved", "dismissed"]),
  createdAt: z.string().datetime(),
});
export type Report = z.infer<typeof reportSchema>;

export const createReportInputSchema = z.object({
  targetType: reportTargetTypeSchema,
  targetId: z.string().uuid(),
  reasonCode: z.string().min(1),
  detail: z.string().max(1000).optional(),
});
export type CreateReportInput = z.infer<typeof createReportInputSchema>;

// ── block ─────────────────────────────────────────────────────────────────────

export const blockSchema = z.object({
  id: z.string().uuid(),
  blockerId: z.string().uuid(),
  blockedId: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type Block = z.infer<typeof blockSchema>;

export const createBlockInputSchema = z.object({
  blockedId: z.string().uuid(),
});
export type CreateBlockInput = z.infer<typeof createBlockInputSchema>;

// ── follow ────────────────────────────────────────────────────────────────────

export const followSchema = z.object({
  followerId: z.string().uuid(),
  followingId: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type Follow = z.infer<typeof followSchema>;

export const createFollowInputSchema = z.object({
  followingId: z.string().uuid(),
});
export type CreateFollowInput = z.infer<typeof createFollowInputSchema>;
