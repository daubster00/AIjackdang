/**
 * view-flush BullMQ 큐 — Story 2.4
 *
 * Redis 버퍼(view:post:{id})의 조회수 증분을 주기적으로 DB에 flush한다.
 * 큐명: "view-flush", job명: "view.flush", 주기: 1분(60000ms)
 */

import { Queue } from "bullmq";
import { Redis } from "ioredis";

const QUEUE_NAME = "view-flush";

let _queue: Queue | null = null;
let _connection: Redis | null = null;

function getConnection(): Redis {
  if (!_connection) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6380";
    _connection = new Redis(url, { maxRetriesPerRequest: null });
    _connection.on("error", (err) => {
      console.error("[view-flush-queue] Redis 연결 오류:", err.message);
    });
  }
  return _connection;
}

export function getViewFlushQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(QUEUE_NAME, { connection: getConnection() });
    _queue.on("error", (err) => {
      console.error("[view-flush-queue] 큐 오류:", err.message);
    });
  }
  return _queue;
}

export { QUEUE_NAME as VIEW_FLUSH_QUEUE_NAME };
