import { Redis } from "ioredis";

/**
 * BullMQ 용 Redis 연결.
 * BullMQ 는 maxRetriesPerRequest: null 을 요구한다.
 */
export function createConnection(): Redis {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  const connection = new Redis(url, {
    maxRetriesPerRequest: null,
  });
  connection.on("error", (error) => {
    // Redis 가 아직 없으면 ioredis 가 재연결을 시도한다. 운영에서는 Redis 기동을 확인한다.
    console.error("[worker] Redis 연결 오류:", error.message);
  });
  return connection;
}

/** 큐 이름 상수. API 와 워커가 동일한 이름을 사용해야 한다. */
export const QUEUE_NAMES = {
  imageProcessing: "image-processing",
  email: "email",
  stats: "stats-aggregation",
} as const;
