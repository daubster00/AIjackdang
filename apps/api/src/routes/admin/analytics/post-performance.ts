/**
 * GET /api/v1/admin/analytics/post-performance — 게시글별 성과 집계.
 *
 * Query: from=YYYY-MM-DD, to=YYYY-MM-DD, limit=20
 * 응답: { items: [{ id, title, board, authorNickname, status, viewCount, commentCount, likeCount, reportCount, createdAt }] }
 * - view_count 내림차순 정렬
 * - 체류시간/검색유입/가입전환처럼 page_views로도 산출 불가한 컬럼은 포함하지 않음
 *
 * adminGuard(active) 적용 — 전역 preHandler.
 */

import { getDb } from "@ai-jakdang/database";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

function parseDate(str: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(`${str}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

function parsePositiveInt(val: string | undefined, fallback: number): number {
  const n = parseInt(val ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function registerPostPerformanceRoute(app: FastifyInstance): Promise<void> {
  app.get("/admin/analytics/post-performance", {
    schema: {
      description: "게시글별 성과(조회·댓글·좋아요·신고). adminGuard 적용. ?from=&to=&limit=",
      tags: ["admin-analytics"],
    },
  }, async (request, reply) => {
    const q = request.query as { from?: string; to?: string; limit?: string };

    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);
    const defaultTo   = new Date(todayUTC);
    const defaultFrom = new Date(todayUTC);
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);

    const fromDate  = (q.from ? parseDate(q.from) : null) ?? defaultFrom;
    const toDate    = (q.to   ? parseDate(q.to)   : null) ?? defaultTo;
    const toDateEnd = new Date(toDate);
    toDateEnd.setUTCDate(toDateEnd.getUTCDate() + 1);

    const limit = parsePositiveInt(q.limit, 20);

    const db = getDb();

    // 복합 JOIN + 집계를 raw SQL로 처리 (drizzle 서브쿼리 중첩보다 가독성 우위)
    type PostRow = {
      id: string;
      title: string;
      board: string;
      author_nickname: string | null;
      status: string;
      view_count: number;
      comment_count: number;
      like_count: number;
      report_count: number;
      created_at: Date | string;
    };

    const result = await db.execute<PostRow>(sql`
      SELECT
        p.id,
        p.title,
        p.board,
        u.nickname AS author_nickname,
        p.status,
        p.view_count,
        COALESCE(c_agg.cnt, 0)::int   AS comment_count,
        COALESCE(r_agg.cnt, 0)::int   AS like_count,
        COALESCE(rp_agg.cnt, 0)::int  AS report_count,
        p.created_at
      FROM posts p
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN (
        SELECT target_id, COUNT(*)::int AS cnt
        FROM comments
        WHERE target_type = 'post' AND status = 'visible'
        GROUP BY target_id
      ) c_agg ON c_agg.target_id = p.id
      LEFT JOIN (
        SELECT target_id, COUNT(*)::int AS cnt
        FROM reactions
        WHERE target_type = 'post' AND reaction_type = 'like'
        GROUP BY target_id
      ) r_agg ON r_agg.target_id = p.id
      LEFT JOIN (
        SELECT target_id, COUNT(*)::int AS cnt
        FROM reports
        WHERE target_type = 'post'
        GROUP BY target_id
      ) rp_agg ON rp_agg.target_id = p.id
      WHERE p.status != 'deleted'
        AND p.created_at >= ${fromDate}
        AND p.created_at < ${toDateEnd}
      ORDER BY p.view_count DESC
      LIMIT ${limit}
    `);

    const items = result.rows.map((r) => ({
      id:              r.id,
      title:           r.title,
      board:           r.board,
      authorNickname:  r.author_nickname ?? null,
      status:          r.status,
      viewCount:       Number(r.view_count),
      commentCount:    Number(r.comment_count),
      likeCount:       Number(r.like_count),
      reportCount:     Number(r.report_count),
      createdAt:       r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
    }));

    return reply.code(200).send({ items });
  });
}
