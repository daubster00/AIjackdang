/**
 * 봇 일일 리포트 API — Story 11.17 Task 2
 *
 * GET /api/v1/admin/bots/report?date=YYYY-MM-DD
 *  - date 생략 시 어제 KST 날짜 자동 계산
 *  - bot_activity_log + bot_generation_jobs + bot_personas + posts + bot_settings 집계
 *  - requireSuperAdmin 전용
 *
 * 텔레그램 푸시(Story 11.18)는 daily-report.processor.ts 진입점에서 처리.
 * 이 파일은 on-demand 조회 엔드포인트만 담당.
 *
 * [Source: _bmad-output/implementation-artifacts/11-17-daily-report-api-hold-queue-actions.md]
 * [Source: docs/seeding-bot/ARCHITECTURE.md#9]
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, count, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb, schema } from "@ai-jakdang/database";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
import type { BotDailyReport } from "@ai-jakdang/contracts";

// ── KST 날짜 유틸 ─────────────────────────────────────────────────────────────

/**
 * KST 날짜 문자열 → UTC 시작/종료 경계 반환.
 *
 * "2026-06-28" KST:
 *   start = UTC 2026-06-27 15:00:00 (KST 2026-06-28 00:00:00)
 *   end   = UTC 2026-06-28 14:59:59.999 (KST 2026-06-28 23:59:59.999)
 */
export function getKstDayBounds(dateStr: string): { start: Date; end: Date } {
  const [year, month, day] = dateStr.split("-").map(Number);
  const start = new Date(Date.UTC(year!, month! - 1, day!, -9, 0, 0, 0));
  const end = new Date(Date.UTC(year!, month! - 1, day!, 14, 59, 59, 999));
  return { start, end };
}

/**
 * 현재 KST 기준 어제 날짜를 YYYY-MM-DD로 반환.
 * (date 쿼리 파라미터 생략 시 기본값)
 */
export function yesterdayKst(): string {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kstNow.setDate(kstNow.getDate() - 1);
  return kstNow.toISOString().slice(0, 10);
}

// ── 일일 리포트 집계 함수 ─────────────────────────────────────────────────────

/**
 * dateStr (YYYY-MM-DD, KST) 에 해당하는 봇 활동 일일 리포트를 집계한다.
 *
 * 집계 항목:
 *  - 게시글/댓글 발행·차단·폐기·보류 건수
 *  - 페르소나별 활동 분포 + 비용
 *  - 게시 성공 글 목록
 *  - 보류 미결정 건수
 *  - 경고(차단 건수·재생성 다발·잠수 계정)
 *  - 총 비용(cost 이벤트 payload.costUsd 합산)
 *  - 시스템 설정 현재값
 *
 * [Source: _bmad-output/implementation-artifacts/11-17-daily-report-api-hold-queue-actions.md#집계-쿼리-상세]
 */
export async function buildDailyReport(dateStr: string): Promise<BotDailyReport> {
  const db = getDb();
  const { start, end } = getKstDayBounds(dateStr);

  // ── 1. 해당 날짜 활동 로그 전체 조회 ─────────────────────────────────────────
  const logs = await db
    .select()
    .from(schema.botActivityLog)
    .where(
      and(
        gte(schema.botActivityLog.createdAt, start),
        lte(schema.botActivityLog.createdAt, end),
      ),
    );

  // ── 2. 이벤트 유형별 분류 ────────────────────────────────────────────────────
  const postPublishedLogs = logs.filter((l) => l.eventType === "post.published");
  const commentPublishedLogs = logs.filter((l) => l.eventType === "comment.published");
  const heldLogs = logs.filter((l) => l.eventType === "held");
  const blockedLogs = logs.filter((l) => l.eventType === "blocked");
  const discardedLogs = logs.filter((l) => l.eventType === "discarded");
  const regeneratedLogs = logs.filter((l) => l.eventType === "regenerated");

  // ── 3. 게시글 목록 — post.published 로그의 refId → posts 테이블 조인 ─────────
  const publishedPostIds = postPublishedLogs
    .map((l) => l.refId)
    .filter(Boolean) as string[];

  const postRows =
    publishedPostIds.length > 0
      ? await db
          .select({
            id: schema.posts.id,
            title: schema.posts.title,
            slug: schema.posts.slug,
            board: schema.posts.board,
          })
          .from(schema.posts)
          .where(inArray(schema.posts.id, publishedPostIds))
      : [];

  const postMap = new Map(postRows.map((p) => [p.id, p]));

  // ── 4. 전체 페르소나 조회 (닉네임·isActive) ──────────────────────────────────
  const allPersonas = await db
    .select({
      id: schema.botPersonas.id,
      nickname: schema.botPersonas.nickname,
      isActive: schema.botPersonas.isActive,
    })
    .from(schema.botPersonas);

  const personaMap = new Map(allPersonas.map((p) => [p.id, p]));

  // ── 5. 페르소나별 활동 분포 집계 (in-memory) ─────────────────────────────────
  type PersonaStats = {
    personaId: string;
    nickname: string;
    postsPublished: number;
    commentsPublished: number;
    blocked: number;
    costUsd: number;
  };

  const personaStatsMap = new Map<string, PersonaStats>();

  const allPersonaIdsInLogs = new Set(logs.map((l) => l.personaId));
  for (const pid of allPersonaIdsInLogs) {
    const persona = personaMap.get(pid);
    if (!persona) continue;
    personaStatsMap.set(pid, {
      personaId: pid,
      nickname: persona.nickname,
      postsPublished: 0,
      commentsPublished: 0,
      blocked: 0,
      costUsd: 0,
    });
  }

  for (const log of logs) {
    const stats = personaStatsMap.get(log.personaId);
    if (!stats) continue;

    switch (log.eventType) {
      case "post.published":
        stats.postsPublished++;
        break;
      case "comment.published":
        stats.commentsPublished++;
        break;
      case "blocked":
        stats.blocked++;
        break;
      case "cost": {
        const payload = log.payload as Record<string, unknown> | null;
        const costUsd = payload?.costUsd;
        if (typeof costUsd === "number") stats.costUsd += costUsd;
        break;
      }
      default:
        break;
    }
  }

  // ── 6. 게시글 blocked·held·discarded 를 post/comment 계열로 분리 ─────────────
  //   refId = jobId (blocked/held/discarded 이벤트) → bot_generation_jobs.job_kind 조인
  const actionLogs = [...heldLogs, ...blockedLogs, ...discardedLogs];
  const actionJobIds = actionLogs
    .map((l) => l.refId)
    .filter(Boolean) as string[];

  const jobKindMap = new Map<string, string>(); // jobId → job_kind
  if (actionJobIds.length > 0) {
    const jobRows = await db
      .select({ id: schema.botGenerationJobs.id, jobKind: schema.botGenerationJobs.jobKind })
      .from(schema.botGenerationJobs)
      .where(inArray(schema.botGenerationJobs.id, actionJobIds));
    for (const j of jobRows) {
      jobKindMap.set(j.id, j.jobKind);
    }
  }

  const isCommentKind = (refId: string | null): boolean => {
    if (!refId) return false;
    const kind = jobKindMap.get(refId);
    return kind === "comment" || kind === "reply";
  };

  const postsBlocked = blockedLogs.filter((l) => !isCommentKind(l.refId)).length;
  const commentsBlocked = blockedLogs.filter((l) => isCommentKind(l.refId)).length;
  const postsHeld = heldLogs.filter((l) => !isCommentKind(l.refId)).length;
  const commentsHeld = heldLogs.filter((l) => isCommentKind(l.refId)).length;
  const postsDiscarded = discardedLogs.filter((l) => !isCommentKind(l.refId)).length;
  const commentsDiscarded = discardedLogs.filter((l) => isCommentKind(l.refId)).length;

  // ── 7. 게시 성공 글 목록 ─────────────────────────────────────────────────────
  const publishedPostsList = postPublishedLogs
    .filter((l) => l.refId && postMap.has(l.refId))
    .map((log) => {
      const post = postMap.get(log.refId!)!;
      const persona = personaMap.get(log.personaId);
      return {
        postId: log.refId!,
        title: post.title,
        slug: post.slug,
        board: post.board,
        personaNickname: persona?.nickname ?? "(알 수 없음)",
      };
    });

  // ── 8. 보류 미결정 건수 ───────────────────────────────────────────────────────
  const [holdResult] = await db
    .select({ total: count() })
    .from(schema.botHoldQueue)
    .where(eq(schema.botHoldQueue.decided, false));
  const holdQueuePending = Number(holdResult?.total ?? 0);

  // ── 9. 경고 집계 ─────────────────────────────────────────────────────────────

  // 9-A. blockedCount
  const blockedCount = blockedLogs.length;

  // 9-B. 재생성 다발 페르소나: 오늘 regenerated 이벤트 2회 초과
  const regenCountByPersona = new Map<string, number>();
  for (const log of regeneratedLogs) {
    regenCountByPersona.set(
      log.personaId,
      (regenCountByPersona.get(log.personaId) ?? 0) + 1,
    );
  }
  const highRegenPersonas = Array.from(regenCountByPersona.entries())
    .filter(([, c]) => c > 2)
    .map(([pid, regenCount]) => ({
      personaId: pid,
      nickname: personaMap.get(pid)?.nickname ?? "(알 수 없음)",
      regenCount,
    }));

  // 9-C. 잠수 계정: is_active=true이면서 최근 7일 활동 없는 페르소나
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentlyActiveRows = await db
    .select({ personaId: schema.botActivityLog.personaId })
    .from(schema.botActivityLog)
    .where(gte(schema.botActivityLog.createdAt, sevenDaysAgo))
    .groupBy(schema.botActivityLog.personaId);

  const recentlyActiveSet = new Set(recentlyActiveRows.map((r) => r.personaId));

  const dormantPersonas = allPersonas
    .filter((p) => p.isActive && !recentlyActiveSet.has(p.id))
    .map((p) => ({ personaId: p.id, nickname: p.nickname }));

  // ── 10. 총 비용 — 페르소나 분포 합산 ──────────────────────────────────────────
  const totalCostUsd = Array.from(personaStatsMap.values()).reduce(
    (sum, s) => sum + s.costUsd,
    0,
  );

  // ── 11. bot_settings 현재값 ───────────────────────────────────────────────────
  const settingKeys = [
    "bot_master_enabled",
    "bot_observation_mode",
    "bot_daily_post_limit",
    "bot_daily_comment_limit",
    "bot_daily_cost_limit_usd",
  ];
  const settingRows = await db
    .select({ key: schema.botSettings.key, value: schema.botSettings.value })
    .from(schema.botSettings)
    .where(inArray(schema.botSettings.key, settingKeys));
  const settings = Object.fromEntries(settingRows.map((r) => [r.key, r.value]));

  const toBool = (v: unknown): boolean =>
    v === true || (v as unknown) === "true";
  const toNum = (v: unknown): number =>
    typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) || 0 : 0;

  // ── 12. status 판정 ───────────────────────────────────────────────────────────
  const hasWarning =
    blockedCount > 0 || highRegenPersonas.length > 0 || dormantPersonas.length > 0;

  return {
    date: dateStr,
    posts: {
      published: postPublishedLogs.length,
      blocked: postsBlocked,
      discarded: postsDiscarded,
      held: postsHeld,
    },
    comments: {
      published: commentPublishedLogs.length,
      blocked: commentsBlocked,
      discarded: commentsDiscarded,
      held: commentsHeld,
    },
    personaBreakdown: Array.from(personaStatsMap.values()),
    publishedPosts: publishedPostsList,
    holdQueuePending,
    warnings: {
      blockedCount,
      highRegenPersonas,
      dormantPersonas,
    },
    totalCostUsd,
    systemStatus: {
      masterEnabled: toBool(settings["bot_master_enabled"]),
      observationMode: toBool(settings["bot_observation_mode"]),
      dailyPostLimit: toNum(settings["bot_daily_post_limit"]),
      dailyCommentLimit: toNum(settings["bot_daily_comment_limit"]),
      dailyCostLimitUsd: toNum(settings["bot_daily_cost_limit_usd"]),
    },
    status: hasWarning ? "warning" : "ok",
  };
}

// ── GET /admin/bots/report 라우트 등록 ────────────────────────────────────────

const reportQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date는 YYYY-MM-DD 형식이어야 합니다.")
    .optional(),
});

export async function registerAdminBotReportRoute(
  app: FastifyInstance,
): Promise<void> {
  /**
   * GET /api/v1/admin/bots/report
   *
   * 쿼리 파라미터:
   *   date (YYYY-MM-DD, optional) — 생략 시 어제 KST 날짜 자동 사용
   *
   * 응답: BotDailyReport JSON
   * 오류: 400 VALIDATION_ERROR | 500 INTERNAL_ERROR
   */
  app.get(
    "/admin/bots/report",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const parsed = reportQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "잘못된 쿼리 파라미터입니다.",
            details: parsed.error.flatten(),
          },
        });
      }

      const dateStr = parsed.data.date ?? yesterdayKst();

      try {
        const report = await buildDailyReport(dateStr);
        return reply.send(report);
      } catch (err) {
        request.log.error(err, "[bot-report] 일일 리포트 집계 실패");
        return reply.status(500).send({
          error: { code: "INTERNAL_ERROR", message: "리포트 집계 중 오류가 발생했습니다." },
        });
      }
    },
  );
}
