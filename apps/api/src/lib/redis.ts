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
 *
 * [Story 7.1] getRedisPublisher():
 * - notification:{userId} 채널 PUBLISH 전용 인스턴스.
 * - subscriber 인스턴스(redis-pubsub.ts)와 반드시 별개.
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

// ── [Story 7.1] Notification PUBLISH 전용 Redis 인스턴스 ─────────────────────

let _publisher: Redis | null = null;

/**
 * SSE 알림 팬아웃용 Redis PUBLISH 전용 인스턴스를 반환한다 (지연 초기화 싱글톤).
 *
 * subscriber(redis-pubsub.ts)와 반드시 별개 인스턴스여야 한다.
 * ioredis subscriber 모드는 SUBSCRIBE 명령만 허용하며
 * PUBLISH 등 일반 명령을 혼용할 수 없기 때문이다.
 */
export function getRedisPublisher(): Redis {
  if (!_publisher) {
    _publisher = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    _publisher.on("error", (err) => {
      console.warn("[redis-publisher] Redis PUBLISH 오류:", (err as Error).message);
    });
  }
  return _publisher;
}
