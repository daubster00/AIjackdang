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
  "message",
  "user",
]);
export type ReportTargetType = z.infer<typeof reportTargetTypeSchema>;

/** 콘텐츠 신고 사유(post/question/answer/resource/comment/message 공용) — 기존 암묵 5종 명시화 */
export const contentReportReasonCodeSchema = z.enum([
  "spam",
  "abuse",
  "privacy",
  "misinformation",
  "other",
]);
export type ContentReportReasonCode = z.infer<typeof contentReportReasonCodeSchema>;

/** 회원(user) 전용 신고 사유 — 콘텐츠 사유와 혼용 금지(Epic 12 절대 규칙) */
export const userReportReasonCodeSchema = z.enum([
  "profile",
  "impersonation",
  "spam",
  "abuse",
  "other",
]);
export type UserReportReasonCode = z.infer<typeof userReportReasonCodeSchema>;

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

/**
 * 신고 제출 입력 — targetType 에 따라 사유 세트가 분리된다(혼용 금지).
 *   user                                          → userReportReasonCodeSchema
 *   post/question/answer/resource/comment/message → contentReportReasonCodeSchema
 * reasonCode='other' 이면 detail 필수.
 *
 * z.discriminatedUnion 멤버는 ZodObject 여야 하므로(.refine 불가),
 * 'other → detail 필수' 검증은 union 위에 superRefine 으로 적용한다.
 * (멤버는 .map() 대신 명시 — discriminant 리터럴을 TS 가 정적 판별)
 */
const contentReportBase = {
  targetId: z.string().uuid(),
  reasonCode: contentReportReasonCodeSchema,
  detail: z.string().max(1000).optional(),
};

export const createReportInputSchema = z
  .discriminatedUnion("targetType", [
    z.object({
      targetType: z.literal("user"),
      targetId: z.string().uuid(),
      reasonCode: userReportReasonCodeSchema,
      detail: z.string().max(1000).optional(),
    }),
    z.object({ targetType: z.literal("post"), ...contentReportBase }),
    z.object({ targetType: z.literal("question"), ...contentReportBase }),
    z.object({ targetType: z.literal("answer"), ...contentReportBase }),
    z.object({ targetType: z.literal("resource"), ...contentReportBase }),
    z.object({ targetType: z.literal("comment"), ...contentReportBase }),
    z.object({ targetType: z.literal("message"), ...contentReportBase }),
  ])
  .superRefine((d, ctx) => {
    if (d.reasonCode === "other" && !(d.detail && d.detail.trim().length > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "기타 사유 선택 시 상세 내용을 입력해주세요.",
        path: ["detail"],
      });
    }
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
