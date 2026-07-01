/**
 * bot.daily-report 잡 처리기 — Story 11.17 (stub 본문 채움)
 *
 * Story 11.13 cron 등록(bot 큐, UTC 22:00 = KST 07:00)이 트리거하면
 * 어제 KST 기준 bot_activity_log + bot_personas + posts + bot_settings를 집계하여
 * 일일 리포트를 콘솔에 출력한다.
 *
 * Story 11.18에서 텔레그램 푸시로 교체될 진입점:
 *   console.info('[bot-daily-report]', JSON.stringify(report))
 *   → sendTelegramReport(report)  ← 11.18에서 교체
 *
 * 경계 제약 (ARCHITECTURE §0):
 *  - apps/api/* import 절대 금지 (worker 프로세스 경계 외).
 *  - buildDailyReport 로직은 @ai-jakdang/database 직접 사용으로 구현.
 *  - bot_master_enabled 확인은 @ai-jakdang/server-bot/gates의 getBotSetting 재사용.
 *
 * 오류 발생 시 throw — BullMQ 재시도 트리거(story 11.17 AC#1 Task 6.1).
 *
 * [Source: _bmad-output/implementation-artifacts/11-17-daily-report-api-hold-queue-actions.md#Task6]
 * [Source: docs/seeding-bot/ARCHITECTURE.md#9-워커·큐·크론]
 */

import type { Job } from "bullmq";
import { and, count, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "@ai-jakdang/database";
import {
  botActivityLog,
  botHoldQueue,
  botPersonas,
  botSettings,
} from "@ai-jakdang/database/schema";
import { getBotSetting } from "@ai-jakdang/server-bot/botSettings";

// ── KST 날짜 유틸 (apps/api/routes/admin/bots/report.ts 와 동일 로직) ─────────

function getKstDayBounds(dateStr: string): { start: Date; end: Date } {
  const [year, month, day] = dateStr.split("-").map(Number);
  const start = new Date(Date.UTC(year!, month! - 1, day!, -9, 0, 0, 0));
  const end = new Date(Date.UTC(year!, month! - 1, day!, 14, 59, 59, 999));
  return { start, end };
}

function yesterdayKst(): string {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kstNow.setDate(kstNow.getDate() - 1);
  return kstNow.toISOString().slice(0, 10);
}

// ── 일일 리포트 처리기 ────────────────────────────────────────────────────────

/**
 * bot.daily-report 잡 처리기.
 *
 * 수행 순서:
 * 1. SEEDING_BOT_ENABLED env 확인 → false면 skip
 * 2. bot_master_enabled(킬 스위치) 확인 → false/null이면 skip
 * 3. 어제 KST 날짜 활동 집계 (bot_activity_log 기반)
 * 4. 결과 console.info 출력 (Story 11.18 텔레그램 전송으로 교체 예정)
 * 5. 오류 시 throw → BullMQ 재시도
 */
export async function botDailyReportProcessor(job: Job): Promise<void> {
  // ── 1. SEEDING_BOT_ENABLED 환경변수 확인 ────────────────────────────────────
  if (process.env.SEEDING_BOT_ENABLED !== "true") {
    console.info(
      `[bot-daily-report] SEEDING_BOT_ENABLED≠'true' → skip (jobId=${job.id})`,
    );
    return;
  }

  // ── 2. bot_master_enabled(킬 스위치) 확인 ────────────────────────────────────
  const masterEnabled = await getBotSetting<boolean>("bot_master_enabled");
  if (!masterEnabled) {
    console.info(
      `[bot-daily-report] bot_master_enabled=false/null → skip (jobId=${job.id})`,
    );
    return;
  }

  // ── 3. 집계 시작 ──────────────────────────────────────────────────────────────
  const dateStr = yesterdayKst();
  console.info(`[bot-daily-report] 집계 시작: date=${dateStr}, jobId=${job.id}`);

  const db = getDb();
  const { start, end } = getKstDayBounds(dateStr);

  // 해당 날짜 활동 로그 전체 조회
  const logs = await db
    .select()
    .from(botActivityLog)
    .where(
      and(
        gte(botActivityLog.createdAt, start),
        lte(botActivityLog.createdAt, end),
      ),
    );

  // 이벤트 유형별 카운트
  const postPublishedCount = logs.filter((l) => l.eventType === "post.published").length;
  const commentPublishedCount = logs.filter((l) => l.eventType === "comment.published").length;
  const heldCount = logs.filter((l) => l.eventType === "held").length;
  const blockedCount = logs.filter((l) => l.eventType === "blocked").length;
  const regeneratedLogs = logs.filter((l) => l.eventType === "regenerated");
  const costLogs = logs.filter((l) => l.eventType === "cost");

  // 총 비용 (cost 이벤트 payload.costUsd 합산)
  const totalCostUsd = costLogs.reduce((sum, l) => {
    const payload = l.payload as Record<string, unknown> | null;
    const costUsd = payload?.costUsd;
    return sum + (typeof costUsd === "number" ? costUsd : 0);
  }, 0);

  // 보류 미결정 건수
  const [holdResult] = await db
    .select({ total: count() })
    .from(botHoldQueue)
    .where(eq(botHoldQueue.decided, false));
  const holdQueuePending = Number(holdResult?.total ?? 0);

  // 재생성 다발 페르소나 (오늘 regenerated 이벤트 2회 초과)
  const regenCountByPersona = new Map<string, number>();
  for (const log of regeneratedLogs) {
    regenCountByPersona.set(
      log.personaId,
      (regenCountByPersona.get(log.personaId) ?? 0) + 1,
    );
  }
  const highRegenPersonaIds = Array.from(regenCountByPersona.entries())
    .filter(([, c]) => c > 2)
    .map(([pid]) => pid);

  // 잠수 계정: is_active=true이면서 최근 7일 활동 없는 페르소나
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentlyActiveRows = await db
    .select({ personaId: botActivityLog.personaId })
    .from(botActivityLog)
    .where(gte(botActivityLog.createdAt, sevenDaysAgo))
    .groupBy(botActivityLog.personaId);
  const recentlyActiveSet = new Set(recentlyActiveRows.map((r) => r.personaId));

  const activePersonas = await db
    .select({ id: botPersonas.id, nickname: botPersonas.nickname })
    .from(botPersonas)
    .where(eq(botPersonas.isActive, true));

  const dormantCount = activePersonas.filter(
    (p) => !recentlyActiveSet.has(p.id),
  ).length;

  // 시스템 설정 현재값 (킬 스위치 / 관찰 모드)
  const settingKeys = ["bot_master_enabled", "bot_observation_mode"];
  const settingRows = await db
    .select({ key: botSettings.key, value: botSettings.value })
    .from(botSettings)
    .where(inArray(botSettings.key, settingKeys));
  const settings = Object.fromEntries(settingRows.map((r) => [r.key, r.value]));

  const hasWarning =
    blockedCount > 0 || highRegenPersonaIds.length > 0 || dormantCount > 0;

  // ── 4. 결과 출력 (Story 11.18에서 텔레그램 전송으로 교체될 진입점) ────────────
  const report = {
    date: dateStr,
    postPublishedCount,
    commentPublishedCount,
    heldCount,
    blockedCount,
    totalCostUsd,
    holdQueuePending,
    highRegenPersonaCount: highRegenPersonaIds.length,
    dormantPersonaCount: dormantCount,
    systemStatus: {
      masterEnabled: settings["bot_master_enabled"] === true,
      observationMode: settings["bot_observation_mode"] === true,
    },
    status: hasWarning ? "warning" : "ok",
  };

  console.info("[bot-daily-report] 집계 완료:", JSON.stringify(report, null, 2));

  // Story 11.18에서 아래 stub을 실제 텔레그램 전송으로 교체:
  // await sendTelegramReport(report);
}
