/**
 * /api/v1/related 라우트 — Story 5.10
 *
 * GET /api/v1/related?targetType=post&targetId={id}
 *   - relatedPosts: 동일 target_type 중 태그 1개 이상 겹치는 최대 5건 (최신순, 현재 글 제외)
 *   - authorPosts: 동일 작성자 최근 3건 (현재 글 제외)
 *   - targetType: post | question | resource
 *   - 최대 2회 쿼리 (AR-2)
 */

import { getDb, schema } from "@ai-jakdang/database";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq, ne, and, inArray, desc } from "drizzle-orm";

const relatedItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  href: z.string(),
  createdAt: z.string(),
  viewCount: z.number().int(),
});

type RelatedItem = z.infer<typeof relatedItemSchema>;

export async function relatedRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/related",
    {
      schema: {
        description: "관련 글·작성자 다른 글 조회 (SSR용)",
        tags: ["related"],
        querystring: z.object({
          targetType: z.enum(["post", "question", "resource"]),
          targetId: z.string().uuid(),
        }),
        response: {
          200: z.object({
            relatedPosts: z.array(relatedItemSchema),
            authorPosts: z.array(relatedItemSchema),
          }),
        },
      },
    },
    async (request, reply) => {
      const { targetType, targetId } = request.query;
      const db = getDb();

      // 현재 콘텐츠의 태그 ID + 작성자 ID 조회 (1쿼리)
      const tagRows = await db
        .select({ tagId: schema.taggable.tagId })
        .from(schema.taggable)
        .where(
          and(
            eq(schema.taggable.targetType, targetType),
            eq(schema.taggable.targetId, targetId),
          ),
        );
      const tagIds = tagRows.map((r) => r.tagId);

      let authorId: string | null = null;

      if (targetType === "post") {
        const r = await db
          .select({ userId: schema.posts.userId })
          .from(schema.posts)
          .where(eq(schema.posts.id, targetId))
          .limit(1);
        authorId = r[0]?.userId ?? null;
      } else if (targetType === "question") {
        const r = await db
          .select({ userId: schema.questions.userId })
          .from(schema.questions)
          .where(eq(schema.questions.id, targetId))
          .limit(1);
        authorId = r[0]?.userId ?? null;
      } else {
        const r = await db
          .select({ userId: schema.resources.userId })
          .from(schema.resources)
          .where(eq(schema.resources.id, targetId))
          .limit(1);
        authorId = r[0]?.userId ?? null;
      }

      const relatedPosts: RelatedItem[] = [];
      const authorPosts: RelatedItem[] = [];

      // 관련 글: 태그 겹치는 동일 target_type 최대 5건 (쿼리 2)
      if (tagIds.length > 0) {
        if (targetType === "post") {
          const relatedTaggable = await db
            .selectDistinct({ targetId: schema.taggable.targetId })
            .from(schema.taggable)
            .where(
              and(
                eq(schema.taggable.targetType, "post"),
                inArray(schema.taggable.tagId, tagIds),
                ne(schema.taggable.targetId, targetId),
              ),
            )
            .limit(5);
          const relatedIds = relatedTaggable.map((r) => r.targetId);
          if (relatedIds.length > 0) {
            const posts = await db
              .select({
                id: schema.posts.id,
                title: schema.posts.title,
                slug: schema.posts.slug,
                board: schema.posts.board,
                createdAt: schema.posts.createdAt,
                viewCount: schema.posts.viewCount,
              })
              .from(schema.posts)
              .where(inArray(schema.posts.id, relatedIds))
              .orderBy(desc(schema.posts.createdAt));
            relatedPosts.push(
              ...posts.map((p) => ({
                id: p.id,
                title: p.title,
                slug: p.slug,
                href: `/${p.board}/${p.slug}`,
                createdAt: p.createdAt.toISOString(),
                viewCount: p.viewCount,
              })),
            );
          }
        } else if (targetType === "question") {
          const relatedTaggable = await db
            .selectDistinct({ targetId: schema.taggable.targetId })
            .from(schema.taggable)
            .where(
              and(
                eq(schema.taggable.targetType, "question"),
                inArray(schema.taggable.tagId, tagIds),
                ne(schema.taggable.targetId, targetId),
              ),
            )
            .limit(5);
          const relatedIds = relatedTaggable.map((r) => r.targetId);
          if (relatedIds.length > 0) {
            const questions = await db
              .select({
                id: schema.questions.id,
                title: schema.questions.title,
                createdAt: schema.questions.createdAt,
                viewCount: schema.questions.viewCount,
              })
              .from(schema.questions)
              .where(inArray(schema.questions.id, relatedIds))
              .orderBy(desc(schema.questions.createdAt));
            relatedPosts.push(
              ...questions.map((q) => ({
                id: q.id,
                title: q.title,
                slug: q.id,
                href: `/questions/${q.id}`,
                createdAt: q.createdAt.toISOString(),
                viewCount: q.viewCount,
              })),
            );
          }
        } else {
          const relatedTaggable = await db
            .selectDistinct({ targetId: schema.taggable.targetId })
            .from(schema.taggable)
            .where(
              and(
                eq(schema.taggable.targetType, "resource"),
                inArray(schema.taggable.tagId, tagIds),
                ne(schema.taggable.targetId, targetId),
              ),
            )
            .limit(5);
          const relatedIds = relatedTaggable.map((r) => r.targetId);
          if (relatedIds.length > 0) {
            const resources = await db
              .select({
                id: schema.resources.id,
                title: schema.resources.title,
                slug: schema.resources.slug,
                createdAt: schema.resources.createdAt,
                viewCount: schema.resources.downloadCount,
              })
              .from(schema.resources)
              .where(inArray(schema.resources.id, relatedIds))
              .orderBy(desc(schema.resources.createdAt));
            relatedPosts.push(
              ...resources.map((r) => ({
                id: r.id,
                title: r.title,
                slug: r.slug,
                href: `/resources/${r.slug}`,
                createdAt: r.createdAt.toISOString(),
                viewCount: r.viewCount,
              })),
            );
          }
        }
      }

      // 작성자 다른 글: 동일 작성자 최근 3건 (쿼리 3)
      if (authorId) {
        if (targetType === "post") {
          const posts = await db
            .select({
              id: schema.posts.id,
              title: schema.posts.title,
              slug: schema.posts.slug,
              board: schema.posts.board,
              createdAt: schema.posts.createdAt,
              viewCount: schema.posts.viewCount,
            })
            .from(schema.posts)
            .where(and(eq(schema.posts.userId, authorId), ne(schema.posts.id, targetId)))
            .orderBy(desc(schema.posts.createdAt))
            .limit(3);
          authorPosts.push(
            ...posts.map((p) => ({
              id: p.id,
              title: p.title,
              slug: p.slug,
              href: `/${p.board}/${p.slug}`,
              createdAt: p.createdAt.toISOString(),
              viewCount: p.viewCount,
            })),
          );
        } else if (targetType === "question") {
          const questions = await db
            .select({
              id: schema.questions.id,
              title: schema.questions.title,
              createdAt: schema.questions.createdAt,
              viewCount: schema.questions.viewCount,
            })
            .from(schema.questions)
            .where(
              and(eq(schema.questions.userId, authorId), ne(schema.questions.id, targetId)),
            )
            .orderBy(desc(schema.questions.createdAt))
            .limit(3);
          authorPosts.push(
            ...questions.map((q) => ({
              id: q.id,
              title: q.title,
              slug: q.id,
              href: `/questions/${q.id}`,
              createdAt: q.createdAt.toISOString(),
              viewCount: q.viewCount,
            })),
          );
        } else {
          const resources = await db
            .select({
              id: schema.resources.id,
              title: schema.resources.title,
              slug: schema.resources.slug,
              createdAt: schema.resources.createdAt,
              viewCount: schema.resources.downloadCount,
            })
            .from(schema.resources)
            .where(
              and(eq(schema.resources.userId, authorId), ne(schema.resources.id, targetId)),
            )
            .orderBy(desc(schema.resources.createdAt))
            .limit(3);
          authorPosts.push(
            ...resources.map((r) => ({
              id: r.id,
              title: r.title,
              slug: r.slug,
              href: `/resources/${r.slug}`,
              createdAt: r.createdAt.toISOString(),
              viewCount: r.viewCount,
            })),
          );
        }
      }

      return reply.send({ relatedPosts, authorPosts });
    },
  );
}
