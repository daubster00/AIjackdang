/**
 * GET /api/v1/admin/analytics/keywords — 검색 키워드 유입 분석.
 *
 * Query: from=YYYY-MM-DD, to=YYYY-MM-DD, page=1, pageSize=10
 * 응답: { items: [{ keyword, count }], total }
 *   - search_keyword NOT NULL 인 행만 집계
 *   - count DESC 정렬 후 페이지네이션
 *
 * adminGuard(active) 적용 — 전역 preHandler.
 */

import { getDb, schema } from "@ai-jakdang/database";
import { and, desc, gte, isNotNull, lt, sql } from "drizzle-orm";
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

export async function registerKeywordsRoute(app: FastifyInstance): Promise<void> {
  app.get("/admin/analytics/keywords", {
    schema: {
      description: "검색 키워드별 유입 수. adminGuard 적용. ?from=&to=&page=&pageSize=",
      tags: ["admin-analytics"],
    },
  }, async (request, reply) => {
    const q = request.query as {
      from?: string; to?: string; page?: string; pageSize?: string;
    };

    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);
    const defaultTo   = new Date(todayUTC);
    const defaultFrom = new Date(todayUTC);
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);

    const fromDate  = (q.from ? parseDate(q.from) : null) ?? defaultFrom;
    const toDate    = (q.to   ? parseDate(q.to)   : null) ?? defaultTo;
    const toDateEnd = new Date(toDate);
    toDateEnd.setUTCDate(toDateEnd.getUTCDate() + 1);

    const page     = parsePositiveInt(q.page,     1);
    const pageSize = parsePositiveInt(q.pageSize, 10);
    const offset   = (page - 1) * pageSize;

    const db = getDb();

    const dateCondition = and(
      gte(schema.pageViews.createdAt, fromDate),
      lt(schema.pageViews.createdAt, toDateEnd),
      isNotNull(schema.pageViews.searchKeyword),
    );

    // 전체 키워드 수
    const [totalRow] = await db
      .select({ value: sql<number>`COUNT(DISTINCT ${schema.pageViews.searchKeyword})::int` })
      .from(schema.pageViews)
      .where(dateCondition);

    const total = Number(totalRow?.value ?? 0);

    if (total === 0) {
      return reply.code(200).send({ items: [], total: 0 });
    }

    // 키워드별 카운트 (페이지네이션)
    const rows = await db
      .select({
        keyword: schema.pageViews.searchKeyword,
        count:   sql<number>`COUNT(*)::int`,
      })
      .from(schema.pageViews)
      .where(dateCondition)
      .groupBy(schema.pageViews.searchKeyword)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(pageSize)
      .offset(offset);

    const items = rows.map((r) => ({
      keyword: r.keyword ?? "",
      count:   Number(r.count),
    }));

    return reply.code(200).send({ items, total });
  });
}
