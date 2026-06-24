/**
 * API Redis 싱글톤 — Story 6.5
 *
 * 랭킹 캐시(ranking:weekly / ranking:monthly) 접근용 ioredis 인스턴스.
 * viewTracker.ts 와 동일한 패턴이나 별도 인스턴스를 유지한다
 * (viewTracker 는 lazyConnect=true 이고 용도가 다름).
 *
 * 용도:
 * - GET /api/v1/gamification/ranking: 캐시 hit/miss 판정
 * - miss 시 DB 즉석 계산 후 ranking:{period} SET EX 3600
 */

import { Redis } from "ioredis";
import { env } from "@ai-jakdang/config";

let _redis: Redis | null = null;

/**
 * API 전용 Redis 인스턴스를 반환한다 (지연 초기화 싱글톤).
 * 연결 오류는 console.warn으로 기록하고 무시한다.
 */
export function getApiRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    _redis.on("error", (err) => {
      console.warn("[api/redis] Redis 오류 (무시):", (err as Error).message);
    });
  }
  return _redis;
}
