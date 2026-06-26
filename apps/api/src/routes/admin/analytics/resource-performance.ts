/**
 * GET /api/v1/admin/analytics/resource-performance — 실전자료별 성과 집계.
 *
 * Query: from=YYYY-MM-DD, to=YYYY-MM-DD, limit=20
 * 응답: { items: [{ id, title, resourceType, viewCount, downloadCount,
 *                   conversionRate, avgRating, ratingCount, reportCount, createdAt }] }
 * - download_count 내림차순 정렬
 * - conversionRate = downloadCount / viewCount * 100 (0나눗셈 가드)
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

export async function registerResourcePerformanceRoute(app: FastifyInstance): Promise<void> {
  app.get("/admin/analytics/resource-performance", {
    schema: {
      description: "실전자료별 성과(조회·다운로드·전환율·평점·후기·신고). adminGuard 적용. ?from=&to=&limit=",
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

    type ResourceRow = {
      id: string;
      title: string;
      resource_type: string;
      view_count: number;
      download_count: number;
      avg_rating: string;
      rating_count: number;
      report_count: number;
      created_at: Date | string;
    };

    const result = await db.execute<ResourceRow>(sql`
      SELECT
        r.id,
        r.title,
        r.resource_type,
        r.view_count,
        r.download_count,
        r.avg_rating,
        r.rating_count,
        COALESCE(rp_agg.cnt, 0)::int AS report_count,
        r.created_at
      FROM resources r
      LEFT JOIN (
        SELECT target_id, COUNT(*)::int AS cnt
        FROM reports
        WHERE target_type = 'resource'
        GROUP BY target_id
      ) rp_agg ON rp_agg.target_id = r.id
      WHERE r.status != 'deleted'
        AND r.created_at >= ${fromDate}
        AND r.created_at < ${toDateEnd}
      ORDER BY r.download_count DESC
      LIMIT ${limit}
    `);

    const items = result.rows.map((r) => {
      const views     = Number(r.view_count);
      const downloads = Number(r.download_count);
      const convRate  = views > 0 ? Math.round((downloads / views) * 1000) / 10 : 0;
      return {
        id:             r.id,
        title:          r.title,
        resourceType:   r.resource_type,
        viewCount:      views,
        downloadCount:  downloads,
        conversionRate: convRate,
        avgRating:      parseFloat(r.avg_rating ?? "0"),
        ratingCount:    Number(r.rating_count),
        reportCount:    Number(r.report_count),
        createdAt:      r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at),
      };
    });

    return reply.code(200).send({ items });
  });
}
