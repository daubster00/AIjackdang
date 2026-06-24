/**
 * GET /api/v1/admin/dashboard/alerts — 운영 알림 집계 (Story 9.5 AC#1).
 *
 * 응답: { reports, pendingQna }
 * - reports: reports.status IN ('pending', 'reviewing') — 미처리·검토중 신고 수
 * - pendingQna: questions.status = 'published' AND is_resolved = false AND 24시간 이상 답변 없는 것
 *   (간소화: questions.status = 'published' AND is_resolved = false 집계)
 * - adminGuard(active) 적용(전역 preHandler). requireSuperAdmin 미적용.
 */

import { getDb, schema } from "@ai-jakdang/database";
import { and, count, eq, gte, inArray, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

export async function registerDashboardAlertsRoute(app: FastifyInstance): Promise<void> {
  app.get("/admin/dashboard/alerts", {
    schema: {
      description: "운영 알림 집계(미처리 신고, 미답변 Q&A). staff 이상 접근 가능.",
      tags: ["admin-dashboard"],
    },
  }, async (_request, reply) => {
    const db = getDb();

    // 미처리·검토중 신고 수
    const [reportsAgg] = await db
      .select({ value: count() })
      .from(schema.reports)
      .where(
        or(
          eq(schema.reports.status, "pending"),
          eq(schema.reports.status, "reviewing"),
        ),
      );

    // 미해결 Q&A (published + 미해결)
    const [qnaAgg] = await db
      .select({ value: count() })
      .from(schema.questions)
      .where(
        and(
          eq(schema.questions.status, "published"),
          eq(schema.questions.isResolved, false),
        ),
      );

    // 오늘 신규 등록 자료 (published, 오늘 00:00 이후 created_at)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [newResourcesAgg] = await db
      .select({ value: count() })
      .from(schema.resources)
      .where(
        and(
          inArray(schema.resources.status, ["published", "draft"]),
          gte(schema.resources.createdAt, todayStart),
        ),
      );

    return reply.code(200).send({
      reports: Number(reportsAgg?.value ?? 0),
      pendingQna: Number(qnaAgg?.value ?? 0),
      newResources: Number(newResourcesAgg?.value ?? 0),
    });
  });
}
