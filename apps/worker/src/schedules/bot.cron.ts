/**
 * 봇 cron 스케줄 등록 — Story 11.13
 *
 * ranking.cron.ts 패턴 재사용:
 * - BullMQ repeat + 고정 jobId = 멱등 (재실행 시 중복 등록 없음)
 * - 각 cron의 실 처리기는 해당 Story에서 구현 (daily-plan: 11.11, report: 11.17)
 *
 * 크론 시간 (UTC 기준):
 *   bot.daily-plan    UTC 17:00 = KST 02:00 (새벽, 다음 날 계획 수립)
 *   bot.daily-report  UTC 22:00 = KST 07:00 (아침 출근 전 전날 리포트)
 *   bot.refill-topics UTC 18:00 = KST 03:00 (daily-plan보다 1시간 앞서 주제 풀 보충)
 *
 * [Source: Story 11.13 Task 5]
 */

import { Queue } from "bullmq";

// ── [11.13] 봇 cron START ──────────────────────────────────────────────────────

/**
 * 봇 cron 스케줄을 등록한다.
 *
 * @param botQueue - bot BullMQ Queue 인스턴스
 */
export async function setupBotCrons(botQueue: Queue): Promise<void> {
  // ── 1. bot.daily-plan: 매일 UTC 17:00 (KST 02:00) ──────────────────────────
  await botQueue.add(
    "bot.daily-plan",
    { triggeredAt: new Date().toISOString() },
    { repeat: { pattern: "0 17 * * *" }, jobId: "bot-daily-plan-cron" },
  );
  console.log("[worker] bot.daily-plan 크론 등록 완료 (UTC 17:00 = KST 02:00)");

  // ── 2. bot.daily-report: 매일 UTC 22:00 (KST 07:00) ────────────────────────
  await botQueue.add(
    "bot.daily-report",
    { triggeredAt: new Date().toISOString() },
    { repeat: { pattern: "0 22 * * *" }, jobId: "bot-daily-report-cron" },
  );
  console.log("[worker] bot.daily-report 크론 등록 완료 (UTC 22:00 = KST 07:00)");

  // ── 3. bot.refill-topics: 매일 UTC 18:00 (KST 03:00) ───────────────────────
  await botQueue.add(
    "bot.refill-topics",
    { triggeredAt: new Date().toISOString() },
    { repeat: { pattern: "0 18 * * *" }, jobId: "bot-refill-topics-cron" },
  );
  console.log("[worker] bot.refill-topics 크론 등록 완료 (UTC 18:00 = KST 03:00)");
}

// ── [11.13] 봇 cron END ───────────────────────────────────────────────────────
