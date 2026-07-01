/**
 * 봇 BullMQ 큐 producer (worker 측) — Epic 11.
 *
 * 단일 `bot` 큐 + job.name 디스패처 패턴(11.13). 워커 내부에서 잡을 enqueue할 때
 * (예: 11.11 dailyPlanProcessor가 bot.write/bot.comment를 적재) 이 producer를 쓴다.
 * worker는 apps/api/src/lib/queues.ts(API 측 producer)를 import할 수 없으므로 별도 정의.
 * view-flush.ts 지연 초기화 싱글톤 패턴 재사용.
 */

import { Queue } from "bullmq";
import { Redis } from "ioredis";

export const BOT_QUEUE_NAME = "bot";

let _queue: Queue | null = null;
let _connection: Redis | null = null;

function getConnection(): Redis {
  if (!_connection) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    _connection = new Redis(url, { maxRetriesPerRequest: null });
    _connection.on("error", (err) => {
      console.error("[bot-queue] Redis 연결 오류:", err.message);
    });
  }
  return _connection;
}

export function getBotQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(BOT_QUEUE_NAME, { connection: getConnection() });
    _queue.on("error", (err) => {
      console.error("[bot-queue] 큐 오류:", err.message);
    });
  }
  return _queue;
}
