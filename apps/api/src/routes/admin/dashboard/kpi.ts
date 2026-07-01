/**
 * GET /api/v1/admin/dashboard/kpi — 대시보드 핵심 KPI 집계 (Story 9.5 AC#1, AC#6).
 *
 * 응답: { totalUsers, todayNewUsers, totalPosts, todayNewPosts, totalDownloads, pendingReports }
 * - adminGuard(active) 적용(전역 preHandler). requireSuperAdmin 미적용(staff 포함 접근).
 * - 오늘 기준: 서버 로컬 자정(00:00:00).
 * - posts: status != 'deleted' 인 것만 집계.
 * - totalDownloads: resources.download_count SUM.
 * - pendingReports: reports.status = 'pending' 인 것만 집계.
 */

import { getDb, schema } from "@ai-jakdang/database";
import { and, count, eq, gte, inArray, ne, sum } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { getBotExcludeFromRanking } from "../../../services/bot/settings.js";

export async function registerDashboardKpiRoute(app: FastifyInstance): Promise<void> {
  app.get("/admin/dashboard/kpi", {
    schema: {
      description: "대시보드 핵심 KPI 집계. staff 이상 접근 가능.",
      tags: ["admin-dashboard"],
    },
  }, async (_request, reply) => {
    const db = getDb();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 봇 계정 제외 여부 조회 (bot_settings.bot_exclude_from_ranking, 기본 true)
    const excludeBots = await getBotExcludeFromRanking();

    // 전체 사용자 수 (봇 제외 설정 시 is_bot=false 조건 추가)
    const [usersTotal] = await db
      .select({ value: count() })
      .from(schema.users)
      .where(excludeBots ? eq(schema.users.isBot, false) : undefined);

    // 오늘 신규 가입 (봇 제외 설정 시 is_bot=false 조건 추가)
    const [usersTodayNew] = await db
      .select({ value: count() })
      .from(schema.users)
      .where(
        excludeBots
          ? and(gte(schema.users.createdAt, todayStart), eq(schema.users.isBot, false))
          : gte(schema.users.createdAt, todayStart),
      );

    // 전체 게시글 (deleted 제외)
    const [postsTotal] = await db
      .select({ value: count() })
      .from(schema.posts)
      .where(ne(schema.posts.status, "deleted"));

    // 오늘 신규 게시글 (deleted 제외)
    const [postsTodayNew] = await db
      .select({ value: count() })
      .from(schema.posts)
      .where(
        gte(schema.posts.createdAt, todayStart),
      );

    // 전체 다운로드 수 (resources.download_count SUM)
    const [downloadsAgg] = await db
      .select({ value: sum(schema.resources.downloadCount) })
      .from(schema.resources)
      .where(ne(schema.resources.status, "deleted"));

    // 미처리 신고 수 (reports.status IN ['pending', 'reviewing'])
    const [pendingReportsAgg] = await db
      .select({ value: count() })
      .from(schema.reports)
      .where(inArray(schema.reports.status, ["pending", "reviewing"]));

    return reply.code(200).send({
      totalUsers: Number(usersTotal?.value ?? 0),
      todayNewUsers: Number(usersTodayNew?.value ?? 0),
      totalPosts: Number(postsTotal?.value ?? 0),
      todayNewPosts: Number(postsTodayNew?.value ?? 0),
      totalDownloads: Number(downloadsAgg?.value ?? 0),
      pendingReports: Number(pendingReportsAgg?.value ?? 0),
    });
  });
}
