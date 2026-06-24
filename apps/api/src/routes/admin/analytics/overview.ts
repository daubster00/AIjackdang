/**
 * GET /api/v1/admin/analytics/overview — 기간별 접속 통계 개요 (Story 9.5 AC#3, AC#5).
 *
 * Query params: from=YYYY-MM-DD, to=YYYY-MM-DD (기본값: 최근 7일)
 * 응답: { items: Array<{ date, newUsers, newPosts, downloads }> }
 * - date 단위로 집계. from~to 범위의 각 날짜별 데이터.
 * - adminGuard(active) 적용(전역 preHandler). requireSuperAdmin 미적용.
 *
 * 구현 참고:
 * - PostgreSQL generate_series로 날짜 범위 생성 후 LEFT JOIN 집계.
 * - 현재는 Drizzle native 쿼리로 날짜별 그룹핑 집계를 사용한다.
 */

import { getDb, schema } from "@ai-jakdang/database";
import { and, count, gte, lt, ne, sql, sum } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

/** YYYY-MM-DD 문자열을 Date 객체(UTC 00:00)로 변환 */
function parseDate(str: string): Date | null {
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(str);
  if (!match) return null;
  const d = new Date(`${str}T00:00:00.000Z`);
  if (isNaN(d.getTime())) return null;
  return d;
}

/** Date를 YYYY-MM-DD 문자열로 변환 (UTC 기준) */
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** start~end 사이의 날짜 배열(UTC 00:00) 생성 */
function dateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

export async function registerAnalyticsOverviewRoute(app: FastifyInstance): Promise<void> {
  app.get("/admin/analytics/overview", {
    schema: {
      description: "기간별 접속 통계 개요(신규 가입, 신규 게시글, 다운로드). staff 이상 접근 가능.",
      tags: ["admin-analytics"],
      querystring: {
        type: "object",
        properties: {
          from: { type: "string", description: "YYYY-MM-DD" },
          to: { type: "string", description: "YYYY-MM-DD" },
        },
      },
    },
  }, async (request, reply) => {
    const query = request.query as { from?: string; to?: string };

    // 기본값: 최근 7일
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);

    const defaultTo = new Date(todayUTC);
    const defaultFrom = new Date(todayUTC);
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 6);

    const fromDate = (query.from ? parseDate(query.from) : null) ?? defaultFrom;
    const toDate = (query.to ? parseDate(query.to) : null) ?? defaultTo;

    // toDate의 end of day (다음날 00:00 직전까지 포함)
    const toDateEnd = new Date(toDate);
    toDateEnd.setUTCDate(toDateEnd.getUTCDate() + 1);

    const db = getDb();

    // 날짜 범위 배열 생성
    const dates = dateRange(fromDate, toDate);

    // 날짜별 신규 가입자 집계
    const usersRows = await db
      .select({
        date: sql<string>`DATE(${schema.users.createdAt} AT TIME ZONE 'UTC')`,
        count: count(),
      })
      .from(schema.users)
      .where(
        and(
          gte(schema.users.createdAt, fromDate),
          lt(schema.users.createdAt, toDateEnd),
        ),
      )
      .groupBy(sql`DATE(${schema.users.createdAt} AT TIME ZONE 'UTC')`);

    // 날짜별 신규 게시글 집계 (deleted 제외)
    const postsRows = await db
      .select({
        date: sql<string>`DATE(${schema.posts.createdAt} AT TIME ZONE 'UTC')`,
        count: count(),
      })
      .from(schema.posts)
      .where(
        and(
          gte(schema.posts.createdAt, fromDate),
          lt(schema.posts.createdAt, toDateEnd),
          ne(schema.posts.status, "deleted"),
        ),
      )
      .groupBy(sql`DATE(${schema.posts.createdAt} AT TIME ZONE 'UTC')`);

    // 날짜별 다운로드 집계 (resources: 날짜별 개별 다운로드 이벤트 테이블 없으므로
    // resources.created_at 기준 download_count 합산 — 실제 운영에서는 다운로드 이력 테이블 사용 권장)
    const downloadsRows = await db
      .select({
        date: sql<string>`DATE(${schema.resources.createdAt} AT TIME ZONE 'UTC')`,
        count: sum(schema.resources.downloadCount),
      })
      .from(schema.resources)
      .where(
        and(
          gte(schema.resources.createdAt, fromDate),
          lt(schema.resources.createdAt, toDateEnd),
          ne(schema.resources.status, "deleted"),
        ),
      )
      .groupBy(sql`DATE(${schema.resources.createdAt} AT TIME ZONE 'UTC')`);

    // Map으로 빠른 조회
    const usersMap = new Map(usersRows.map((r) => [r.date, Number(r.count)]));
    const postsMap = new Map(postsRows.map((r) => [r.date, Number(r.count)]));
    const downloadsMap = new Map(downloadsRows.map((r) => [r.date, Number(r.count ?? 0)]));

    const items = dates.map((d) => {
      const dateStr = formatDate(d);
      return {
        date: dateStr,
        newUsers: usersMap.get(dateStr) ?? 0,
        newPosts: postsMap.get(dateStr) ?? 0,
        downloads: downloadsMap.get(dateStr) ?? 0,
      };
    });

    return reply.code(200).send({ items });
  });
}
