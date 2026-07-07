/**
 * GET /api/v1/admin/analytics/referrers — 유입 경로(채널) 분석.
 *
 * Query: from=YYYY-MM-DD, to=YYYY-MM-DD (기본: 최근 30일)
 * 응답: { items: [{ source, count, percent }], total }
 *   - source 분류: 검색엔진 / SNS / 직접 / 기타
 *
 * adminGuard(active) 적용 — 전역 preHandler.
 */

import { getDb, schema } from "@ai-jakdang/database";
import { and, gte, lt, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

function parseDate(str: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(`${str}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 자사 도메인(내부 이동) 판별에 쓰는 호스트 조각.
 * SITE_HOST env 가 있으면 우선 사용하고, 없으면 알려진 도메인/오타 변형·로컬을 기본값으로 둔다.
 * (운영 도메인 aijackdang.com, 과거 오타 도메인 aijakdang, 개발 localhost)
 */
const INTERNAL_HOST_FRAGMENTS = [
  process.env.SITE_HOST?.toLowerCase().replace(/^www\./, ""),
  "aijackdang",
  "aijakdang",
  "localhost",
].filter((v): v is string => Boolean(v));

/** referrer_host를 채널명으로 분류 */
function classifyHost(host: string | null): string {
  if (!host) return "직접";
  const h = host.toLowerCase();
  if (
    h.includes("google") || h.includes("naver") || h.includes("daum") ||
    h.includes("bing")   || h.includes("yahoo") || h.includes("duckduckgo") ||
    h.includes("yandex") || h.includes("zum")   || h.includes("nate") ||
    h.includes("baidu")
  ) return "검색엔진";
  if (
    h.includes("facebook")   || h.includes("instagram") || h.includes("twitter") ||
    h.includes("x.com")      || h.includes("youtube")   || h.includes("threads") ||
    h.includes("tiktok")     || h.includes("linkedin")  || h.includes("reddit")  ||
    h.includes("kakaostory") || h.includes("pinterest")
  ) return "SNS";
  // 자사 도메인에서 온 유입 = 사이트 내부 이동(페이지→페이지). 외부 유입 '기타'와 분리한다.
  if (INTERNAL_HOST_FRAGMENTS.some((frag) => h.includes(frag))) return "내부 이동";
  return "기타";
}

export async function registerReferrersRoute(app: FastifyInstance): Promise<void> {
  app.get("/admin/analytics/referrers", {
    schema: {
      description: "유입 경로(채널) 분석. adminGuard 적용. ?from=YYYY-MM-DD&to=YYYY-MM-DD",
      tags: ["admin-analytics"],
    },
  }, async (request, reply) => {
    const q = request.query as { from?: string; to?: string };

    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);
    const defaultTo   = new Date(todayUTC);
    const defaultFrom = new Date(todayUTC);
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);

    const fromDate  = (q.from ? parseDate(q.from) : null) ?? defaultFrom;
    const toDate    = (q.to   ? parseDate(q.to)   : null) ?? defaultTo;
    const toDateEnd = new Date(toDate);
    toDateEnd.setUTCDate(toDateEnd.getUTCDate() + 1);

    const db = getDb();

    // referrer_host 별 카운트 — null(직접)은 별도 처리
    const rows = await db
      .select({
        host:  schema.pageViews.referrerHost,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(schema.pageViews)
      .where(
        and(
          gte(schema.pageViews.createdAt, fromDate),
          lt(schema.pageViews.createdAt, toDateEnd),
        ),
      )
      .groupBy(schema.pageViews.referrerHost);

    // JS에서 채널별 집계
    const channelMap = new Map<string, number>();
    let total = 0;
    for (const row of rows) {
      const source = classifyHost(row.host);
      channelMap.set(source, (channelMap.get(source) ?? 0) + Number(row.count));
      total += Number(row.count);
    }

    // 정렬 기준 채널 목록(실제 표시는 count 내림차순). 없으면 0으로 잡아 필터에서 제거.
    const ORDER = ["검색엔진", "SNS", "직접", "내부 이동", "기타"];
    const items = ORDER
      .map((source) => {
        const count   = channelMap.get(source) ?? 0;
        const percent = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
        return { source, count, percent };
      })
      .filter((item) => item.count > 0) // 데이터 없는 채널 제거
      .sort((a, b) => b.count - a.count); // 내림차순

    // 데이터가 전혀 없으면 빈 배열 반환
    return reply.code(200).send({ items, total });
  });
}
