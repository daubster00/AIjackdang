/**
 * ranking.cron — Story 6.5
 *
 * 매일 UTC 00:00에 ranking.compute 잡을 weekly·monthly 각각 enqueue.
 * 기동 시 Redis에 캐시가 없으면 즉시 1회 seed enqueue.
 *
 * BullMQ repeat 옵션:
 * - pattern: '0 0 * * *' → cron 표현식(매일 00:00 UTC)
 * - jobId: 식별자 고정 → 중복 등록 방지
 */

import { Queue } from "bullmq";
import { Redis } from "ioredis";

// ── [6.5] ranking cron START ──────────────────────────────────────────────────

/** ranking.compute 잡 이름 */
export const RANKING_COMPUTE_JOB_NAME = "ranking.compute" as const;

/**
 * ranking cron 스케줄을 등록하고 필요시 seed 잡을 즉시 발행한다.
 *
 * @param rankingQueue - ranking BullMQ Queue 인스턴스
 */
export async function setupRankingCron(rankingQueue: Queue): Promise<void> {
  // ── 1. 매일 자정(UTC 00:00) 반복 잡 등록 (weekly) ──────────────────────────
  await rankingQueue.add(
    RANKING_COMPUTE_JOB_NAME,
    { period: "weekly" },
    {
      repeat: { pattern: "0 0 * * *" },
      jobId: "ranking-compute-weekly",
    },
  );
  console.log("[worker] ranking.compute 반복 잡 등록 완료: weekly (매일 UTC 00:00)");

  // ── 2. 매일 자정(UTC 00:00) 반복 잡 등록 (monthly) ─────────────────────────
  await rankingQueue.add(
    RANKING_COMPUTE_JOB_NAME,
    { period: "monthly" },
    {
      repeat: { pattern: "0 0 * * *" },
      jobId: "ranking-compute-monthly",
    },
  );
  console.log("[worker] ranking.compute 반복 잡 등록 완료: monthly (매일 UTC 00:00)");

  // ── 3. 기동 시 seed: Redis에 캐시가 없으면 즉시 enqueue ─────────────────────
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });

  try {
    const weeklyCache = await redis.exists("ranking:weekly");
    const monthlyCache = await redis.exists("ranking:monthly");

    if (!weeklyCache) {
      await rankingQueue.add(
        RANKING_COMPUTE_JOB_NAME,
        { period: "weekly" },
        { jobId: `ranking-seed-weekly-${Date.now()}` },
      );
      console.log("[worker] ranking seed 잡 발행: weekly (캐시 없음)");
    } else {
      console.log("[worker] ranking seed skip: weekly 캐시 이미 존재");
    }

    if (!monthlyCache) {
      await rankingQueue.add(
        RANKING_COMPUTE_JOB_NAME,
        { period: "monthly" },
        { jobId: `ranking-seed-monthly-${Date.now()}` },
      );
      console.log("[worker] ranking seed 잡 발행: monthly (캐시 없음)");
    } else {
      console.log("[worker] ranking seed skip: monthly 캐시 이미 존재");
    }
  } catch (err) {
    console.warn("[worker] ranking seed 체크 실패 (무시):", (err as Error).message);
  } finally {
    await redis.quit();
  }
}

// ── [6.5] ranking cron END ────────────────────────────────────────────────────
