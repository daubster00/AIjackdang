/**
 * GET /api/v1/admin/analytics/visitor-trend — 일자별 방문자·PV 집계.
 *
 * Query: from=YYYY-MM-DD, to=YYYY-MM-DD (기본: 최근 30일)
 * 응답: { items: [{ date, visitors, pageViews }] }
 *   - visitors = 고유 visitor_id 수
 *   - pageViews = 행 수 (PV)
 *   - from~to 전 날짜를 0 포함 연속 배열로 반환
 *
 * adminGuard(active) 적용 — 전역 preHandler.
 */

import { getDb, schema } from "@ai-jakdang/database";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

/** YYYY-MM-DD → Date(UTC 00:00), 실패 시 null */
function parseDate(str: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(`${str}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

/** Date → YYYY-MM-DD (UTC) */
function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** start~end(포함) 날짜 배열 (UTC 00:00 기준) */
function dateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

export async function registerVisitorTrendRoute(app: FastifyInstance): Promise<void> {
  app.get("/admin/analytics/visitor-trend", {
    schema: {
      description: "일자별 방문자(고유 visitor_id)·페이지뷰 집계. adminGuard 적용. ?from=YYYY-MM-DD&to=YYYY-MM-DD",
      tags: ["admin-analytics"],
    },
  }, async (request, reply) => {
    const q = request.query as { from?: string; to?: string };

    // 기본값: 최근 30일
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);
    const defaultTo   = new Date(todayUTC);
    const defaultFrom = new Date(todayUTC);
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);

    const fromDate = (q.from ? parseDate(q.from) : null) ?? defaultFrom;
    const toDate   = (q.to   ? parseDate(q.to)   : null) ?? defaultTo;

    // toDate 다음날 00:00 (exclusive upper bound)
    const toDateEnd = new Date(toDate);
    toDateEnd.setUTCDate(toDateEnd.getUTCDate() + 1);

    const db = getDb();

    // 날짜별 visitor 수 + PV 집계
    const rows = await db
      .select({
        date:      sql<string>`TO_CHAR(${schema.pageViews.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
        visitors:  sql<number>`COUNT(DISTINCT ${schema.pageViews.visitorId})::int`,
        pageViews: sql<number>`COUNT(*)::int`,
      })
      .from(schema.pageViews)
      .where(
        and(
          gte(schema.pageViews.createdAt, fromDate),
          lt(schema.pageViews.createdAt, toDateEnd),
          eq(schema.pageViews.isBot, false), // 봇 트래픽 제외 — 사람 방문만 집계
        ),
      )
      .groupBy(sql`TO_CHAR(${schema.pageViews.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`);

    const rowMap = new Map(rows.map((r) => [r.date, r]));
    const dates  = dateRange(fromDate, toDate);

    const items = dates.map((d) => {
      const key = fmtDate(d);
      const row = rowMap.get(key);
      return {
        date:      key,
        visitors:  row ? Number(row.visitors)  : 0,
        pageViews: row ? Number(row.pageViews) : 0,
      };
    });

    return reply.code(200).send({ items });
  });
}
