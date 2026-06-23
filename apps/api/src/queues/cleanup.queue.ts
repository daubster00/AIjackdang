/**
 * 탈퇴 익명화 큐 (Story 1.9).
 *
 * DELETE /users/me 처리 시 콘텐츠 익명화(posts.user_id · comments.user_id = null)를
 * 즉시 처리하지 않고 cleanup 큐에 job 을 발행한다.
 * 실제 처리는 apps/worker 의 cleanup 워커가 담당한다.
 *
 * Redis 미설정 시: Queue 생성은 성공하나 워커가 연결되지 않아 job 이 대기 상태로 남는다.
 * 탈퇴 API 자체의 성공/실패에는 영향 없음 (fire-and-forget).
 */

import { Queue } from "bullmq";
import { Redis } from "ioredis";

const QUEUE_NAME = "cleanup";

let _queue: Queue | null = null;

function getQueue(): Queue {
  if (!_queue) {
    const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
    const connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    connection.on("error", (err: Error) => {
      console.error("[cleanup-queue] Redis 오류:", err.message);
    });
    _queue = new Queue(QUEUE_NAME, { connection });
  }
  return _queue;
}

/** 탈퇴 회원 콘텐츠 익명화 job 발행 */
export async function enqueueAnonymize(userId: string): Promise<void> {
  try {
    const queue = getQueue();
    await queue.add("cleanup.anonymize", { userId }, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });
    console.log(`[cleanup-queue] anonymize job 발행 userId=${userId}`);
  } catch (error) {
    // job 발행 실패는 탈퇴 흐름을 중단하지 않는다 (fire-and-forget)
    console.error("[cleanup-queue] job 발행 실패:", (error as Error).message);
  }
}
