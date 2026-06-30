/**
 * GET /api/v1/admin/analytics/page-dwell-time — 페이지별 평균 체류시간.
 *
 * 응답: { items: [{ path, views, avgDwellMs }] }
 * - dwell_ms IS NOT NULL 행만 집계 (체류시간 기록된 행 기준).
 * - views DESC 정렬, 상위 15개.
 *
 * adminGuard(active) 적용 — 전역 preHandler.
 */

import { getDb } from "@ai-jakdang/database";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

export async function registerPageDwellTimeRoute(app: FastifyInstance): Promise<void> {
  app.get("/admin/analytics/page-dwell-time", {
    schema: {
      description: "페이지별 평균 체류시간(dwell_ms IS NOT NULL 행 집계). adminGuard 적용.",
      tags: ["admin-analytics"],
    },
  }, async (_request, reply) => {
    const db = getDb();

    type DwellRow = {
      path: string;
      views: string | number;
      avg_dwell_ms: string | number | null;
    };

    const result = await db.execute<DwellRow>(sql`
      SELECT
        path,
        COUNT(*)::bigint           AS views,
        AVG(dwell_ms)::float8      AS avg_dwell_ms
      FROM page_views
      WHERE dwell_ms IS NOT NULL
      GROUP BY path
      ORDER BY views DESC
      LIMIT 15
    `);

    const items = result.rows.map((r) => ({
      path:        r.path,
      views:       Number(r.views),
      avgDwellMs:  r.avg_dwell_ms != null ? Math.round(Number(r.avg_dwell_ms)) : 0,
    }));

    return reply.code(200).send({ items });
  });
}
