/**
 * GET /api/v1/admin/dashboard/recent-content — 최근 콘텐츠 통합 목록.
 *
 * Query: limit=10
 * 응답: { items: [{ type, title, board, authorNickname, status, views, createdAt }] }
 *   - posts · resources · questions 를 created_at desc 합산
 *   - 각 테이블에서 최대 limit 건 조회 후 JS 병합·정렬 → 최상위 limit 반환
 *
 * adminGuard(active) 적용 — 전역 preHandler.
 */

import { getDb, schema } from "@ai-jakdang/database";
import { desc, eq, ne } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

function parsePositiveInt(val: string | undefined, fallback: number): number {
  const n = parseInt(val ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

interface ContentRow {
  id: string;
  slug: string;
  type: "post" | "resource" | "question";
  title: string;
  board: string | null;
  authorNickname: string | null;
  authorAvatarUrl: string | null;
  authorImage: string | null;
  authorDefaultAvatarIndex: number;
  status: string;
  views: number;
  createdAt: Date;
}

export async function registerRecentContentRoute(app: FastifyInstance): Promise<void> {
  app.get("/admin/dashboard/recent-content", {
    schema: {
      description: "최근 게시글·실전자료·질문 통합 목록. adminGuard 적용. ?limit=",
      tags: ["admin-dashboard"],
    },
  }, async (request, reply) => {
    const q     = request.query as { limit?: string };
    const limit = parsePositiveInt(q.limit, 10);

    const db = getDb();

    // 3개 테이블 병렬 조회
    const [posts, resources, questions] = await Promise.all([
      db
        .select({
          id:                   schema.posts.id,
          slug:                 schema.posts.slug,
          title:                schema.posts.title,
          board:                schema.posts.board,
          userId:               schema.posts.userId,
          status:               schema.posts.status,
          views:                schema.posts.viewCount,
          createdAt:            schema.posts.createdAt,
          nickname:             schema.users.nickname,
          avatarUrl:            schema.users.avatarUrl,
          image:                schema.users.image,
          defaultAvatarIndex:   schema.users.defaultAvatarIndex,
        })
        .from(schema.posts)
        .leftJoin(schema.users, eq(schema.posts.userId, schema.users.id))
        .where(ne(schema.posts.status, "deleted"))
        .orderBy(desc(schema.posts.createdAt))
        .limit(limit),

      db
        .select({
          id:                   schema.resources.id,
          slug:                 schema.resources.slug,
          title:                schema.resources.title,
          userId:               schema.resources.userId,
          status:               schema.resources.status,
          views:                schema.resources.viewCount,
          createdAt:            schema.resources.createdAt,
          nickname:             schema.users.nickname,
          avatarUrl:            schema.users.avatarUrl,
          image:                schema.users.image,
          defaultAvatarIndex:   schema.users.defaultAvatarIndex,
        })
        .from(schema.resources)
        .leftJoin(schema.users, eq(schema.resources.userId, schema.users.id))
        .where(ne(schema.resources.status, "deleted"))
        .orderBy(desc(schema.resources.createdAt))
        .limit(limit),

      db
        .select({
          id:                   schema.questions.id,
          slug:                 schema.questions.slug,
          title:                schema.questions.title,
          userId:               schema.questions.userId,
          status:               schema.questions.status,
          views:                schema.questions.viewCount,
          createdAt:            schema.questions.createdAt,
          nickname:             schema.users.nickname,
          avatarUrl:            schema.users.avatarUrl,
          image:                schema.users.image,
          defaultAvatarIndex:   schema.users.defaultAvatarIndex,
        })
        .from(schema.questions)
        .leftJoin(schema.users, eq(schema.questions.userId, schema.users.id))
        .where(ne(schema.questions.status, "deleted"))
        .orderBy(desc(schema.questions.createdAt))
        .limit(limit),
    ]);

    // 병합 + 정렬 + 슬라이싱
    const merged: ContentRow[] = [
      ...posts.map((p) => ({
        id: p.id,
        slug: p.slug,
        type: "post" as const,
        title: p.title,
        board: p.board,
        authorNickname: p.nickname ?? null,
        authorAvatarUrl: p.avatarUrl ?? null,
        authorImage: p.image ?? null,
        authorDefaultAvatarIndex: p.defaultAvatarIndex ?? 0,
        status: p.status,
        views: Number(p.views),
        createdAt: p.createdAt,
      })),
      ...resources.map((r) => ({
        id: r.id,
        slug: r.slug,
        type: "resource" as const,
        title: r.title,
        board: null,
        authorNickname: r.nickname ?? null,
        authorAvatarUrl: r.avatarUrl ?? null,
        authorImage: r.image ?? null,
        authorDefaultAvatarIndex: r.defaultAvatarIndex ?? 0,
        status: r.status,
        views: Number(r.views),
        createdAt: r.createdAt,
      })),
      ...questions.map((q) => ({
        id: q.id,
        slug: q.slug,
        type: "question" as const,
        title: q.title,
        board: null,
        authorNickname: q.nickname ?? null,
        authorAvatarUrl: q.avatarUrl ?? null,
        authorImage: q.image ?? null,
        authorDefaultAvatarIndex: q.defaultAvatarIndex ?? 0,
        status: q.status,
        views: Number(q.views),
        createdAt: q.createdAt,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);

    const items = merged.map((c) => ({
      id:                       c.id,
      slug:                     c.slug,
      type:                     c.type,
      title:                    c.title,
      board:                    c.board,
      authorNickname:           c.authorNickname,
      authorAvatarUrl:          c.authorAvatarUrl,
      authorImage:              c.authorImage,
      authorDefaultAvatarIndex: c.authorDefaultAvatarIndex,
      status:                   c.status,
      views:                    c.views,
      createdAt:                c.createdAt.toISOString(),
    }));

    return reply.code(200).send({ items });
  });
}
