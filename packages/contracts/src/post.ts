import { z } from "zod";

/** 게시판 콘텐츠 유형. 사용자 사이트 메뉴 구조와 연결된다. */
export const postCategorySchema = z.enum([
  "vibe-coding", // 바이브 코딩
  "ai-automation", // AI 자동화
  "ai-monetization", // AI 수익화
  "lounge", // 작당 라운지
]);
export type PostCategory = z.infer<typeof postCategorySchema>;

/** 게시글 작성 요청 규격. 본문은 Tiptap JSON 으로 저장한다. */
export const createPostSchema = z.object({
  category: postCategorySchema,
  title: z.string().trim().min(2).max(150),
  // content_json: Tiptap 원본 JSON (HTML 을 원본으로 저장하지 않는다)
  contentJson: z.record(z.string(), z.unknown()),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
});
export type CreatePostInput = z.infer<typeof createPostSchema>;

/** 게시글 수정 요청 규격. */
export const updatePostSchema = createPostSchema.partial();
export type UpdatePostInput = z.infer<typeof updatePostSchema>;

/** 게시글 운영 상태. */
export const postStatusSchema = z.enum(["draft", "published", "hidden", "deleted"]);
export type PostStatus = z.infer<typeof postStatusSchema>;
