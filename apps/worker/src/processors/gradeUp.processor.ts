/**
 * gradeUp.processor — Story 6.3
 *
 * BullMQ ranking 큐의 'gamification.grade-up' 잡 소비.
 *
 * 처리 내용:
 * 1. 페이로드 { userId, prevLevel, newLevel, newGradeName } 수신
 * 2. 멱등 처리: Redis key "grade-up-notified:{userId}:{newLevel}" 존재 시 skip (TTL 24h)
 * 3. notifications 큐에 'grade.level-up' 이벤트 enqueue (best-effort)
 *    Epic 7 미구현 상태 — 소비자 없음은 정상.
 */

import type { Job } from "bullmq";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import type { GradeUpJobPayload } from "@ai-jakdang/contracts";

// ── Redis 연결 (dedup 전용) ──────────────────────────────────────────────────
let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    _redis = new Redis(url, { maxRetriesPerRequest: null });
    _redis.on("error", (err) => {
      console.error("[gradeUp.processor] Redis 오류:", err.message);
    });
  }
  return _redis;
}

// ── notifications 큐 (best-effort) ──────────────────────────────────────────
let _notificationsQueue: Queue | null = null;

function getNotificationsQueue(): Queue {
  if (!_notificationsQueue) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    const connection = new Redis(url, { maxRetriesPerRequest: null });
    _notificationsQueue = new Queue("notifications", {
      connection,
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return _notificationsQueue;
}

// ── DEDUP TTL (24시간) ────────────────────────────────────────────────────────
const DEDUP_TTL_SECONDS = 60 * 60 * 24;

// ── 프로세서 ─────────────────────────────────────────────────────────────────

/**
 * gamification.grade-up 잡 처리기.
 *
 * - 멱등: 동일 userId + newLevel 알림이 24h 내 이미 발행됐으면 skip.
 * - 알림 큐 enqueue: Epic 7 미구현 → 큐에 잡만 추가, 소비자 없음은 정상.
 */
export async function gradeUpProcessor(job: Job<GradeUpJobPayload>): Promise<void> {
  const { userId, prevLevel, newLevel, newGradeName } = job.data;

  console.info(`[gradeUp.processor] 등급 변동 잡 처리 시작:`, {
    jobId: job.id,
    userId,
    prevLevel,
    newLevel,
    newGradeName,
  });

  // ── 멱등 체크 ─────────────────────────────────────────────────────────────
  const dedupKey = `grade-up-notified:${userId}:${newLevel}`;
  const redis = getRedis();
  const already = await redis.get(dedupKey);

  if (already) {
    console.info(
      `[gradeUp.processor] 중복 알림 skip: userId=${userId} newLevel=${newLevel}`,
    );
    return;
  }

  // ── notifications 큐에 grade.level-up 이벤트 enqueue (best-effort) ─────────
  try {
    await getNotificationsQueue().add("grade.level-up", {
      userId,
      level: newLevel,
      gradeName: newGradeName,
      prevLevel,
    });

    console.info(
      `[gradeUp.processor] grade.level-up 이벤트 발행: userId=${userId} ${prevLevel}→${newLevel}(${newGradeName})`,
    );
  } catch (err) {
    // 알림 큐 enqueue 실패는 로그만 남기고 dedup 키 설정은 건너뜀
    // (재시도 시 다시 발행 시도)
    console.error(
      `[gradeUp.processor] notifications 큐 enqueue 실패:`,
      (err as Error).message,
    );
    return;
  }

  // ── dedup 키 설정 (TTL 24h) ──────────────────────────────────────────────
  await redis.set(dedupKey, "1", "EX", DEDUP_TTL_SECONDS);

  console.info(
    `[gradeUp.processor] 처리 완료: userId=${userId} level=${newLevel}`,
  );
}
