/**
 * 조회수 Redis 버퍼링 유틸리티 — Story 5.3
 *
 * post 조회수(Story 2.4)와 동일한 패턴을 question·resource로 확장한다.
 *
 * 키 구조:
 *   incr key  : view:{targetType}:{id}              — worker가 주기적으로 flush
 *   dedup key : view:dedup:{targetType}:{id}:{fp}   — 24시간 TTL, 중복 INCR 스킵
 *
 * AR-16·AR-17: DB 직접 UPDATE 절대 금지 — worker(view-flush)만 flush한다.
 */

import { Redis } from "ioredis";
import { env } from "@ai-jakdang/config";

export type ViewTargetType = "post" | "question" | "resource";

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(env.REDIS_URL, { lazyConnect: true });
    _redis.on("error", (err) =>
      console.warn("[viewTracker] Redis 오류 (무시):", (err as Error).message),
    );
  }
  return _redis;
}

export interface TrackViewOptions {
  targetType: ViewTargetType;
  targetId: string;
  /** 중복 제거용 핑거프린트 (IP + sessionId 조합 권장) */
  fingerprint: string;
}

/** 중복 제거 창(초). 동일 fingerprint 재방문을 이 시간 동안 1회로 집계. */
const DEDUP_TTL_SECONDS = 24 * 60 * 60; // 24시간

/**
 * 상세 페이지 진입 시 조회수를 Redis에 버퍼링한다.
 *
 * - 24시간 이내 동일 fingerprint 재방문은 스킵(dedup).
 * - Redis 오류는 무시(fire-and-forget) — 응답을 블록하지 않는다.
 */
export async function trackView({
  targetType,
  targetId,
  fingerprint,
}: TrackViewOptions): Promise<void> {
  try {
    const redis = getRedis();
    const dedupKey = `view:dedup:${targetType}:${targetId}:${fingerprint}`;
    const incrKey = `view:${targetType}:${targetId}`;
    const result = await redis.set(dedupKey, "1", "EX", DEDUP_TTL_SECONDS, "NX");
    if (result === "OK") {
      await redis.incr(incrKey);
    }
  } catch (err) {
    console.warn("[viewTracker] INCR 실패 (무시):", (err as Error).message);
  }
}
