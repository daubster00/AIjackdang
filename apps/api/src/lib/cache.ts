/**
 * Redis 캐시 키 상수 + withCache 래퍼 — AR-17 규약.
 *
 * 형식: `{domain}:{sub}:{qualifier}`
 *
 * TTL 기준:
 *   - popular/ranking : 3600s (1h)
 *   - latest/list     : 60s   (Next.js fetch revalidate 와 동일)
 */

import pino from "pino";
import { getApiRedis } from "./redis.js";

const logger = pino({ name: "cache" });

// ── CACHE_KEYS re-export (packages/utilities 중앙 정의) ──────────────────────
export { CACHE_KEYS } from "@ai-jakdang/utilities";

// ── 태그 캐시 키 (Story 8.4) — 레거시 개별 상수 유지 ────────────────────────

/** 인기 태그 목록 — TTL 3600s (1h) */
export const TAGS_POPULAR = "tags:popular" as const;

/** 인기 태그 캐시 TTL (초) */
export const TAGS_POPULAR_TTL = 3600;

// ── 홈 페이지 섹션 캐시 키 (Story 8.5) — 레거시 개별 상수 유지 ──────────────

/** ②실전 인기글 탭 — 전 카테고리 7일 인기 (category 없음 → all) */
export const MAIN_POPULAR_ALL_7D = "main:popular:all:7d" as const;

/** ②실전 인기글 탭 — vibe-coding 7일 인기 */
export const MAIN_POPULAR_VIBE_7D = "main:popular:vibe-coding:7d" as const;

/** ②실전 인기글 탭 — ai-automation 7일 인기 */
export const MAIN_POPULAR_AUTOMATION_7D = "main:popular:ai-automation:7d" as const;

/** ④AI 수익화 인기글 — 30일 인기 */
export const MAIN_POPULAR_MONETIZATION_30D = "main:popular:ai-monetization:30d" as const;

/** ⑤실전자료 인기 (download_count 기준) */
export const MAIN_RESOURCES_POPULAR = "main:resources:popular" as const;

/** ⑥작당 라운지 최신 5건 */
export const MAIN_LOUNGE_LATEST = "main:lounge:latest" as const;

// ── 캐시 키 빌더 헬퍼 ────────────────────────────────────────────────────────

/**
 * 카테고리 + 기간 조합으로 캐시 키를 동적 생성한다.
 * 예: buildPopularKey('vibe-coding', '7d') → 'main:popular:vibe-coding:7d'
 */
export function buildPopularKey(category: string, period: "7d" | "30d"): string {
  return `main:popular:${category}:${period}`;
}

// ── withCache 래퍼 (AR-17, Story 8.9) ────────────────────────────────────────

/**
 * Redis 캐시 read-through 래퍼.
 *
 * 1. Redis GET 시도 → 히트 시 JSON.parse 반환.
 * 2. 미스(또는 Redis 오류) 시 fallback() 실행 → DB에서 집계.
 * 3. fallback 결과를 Redis SET EX ttlSeconds 로 저장 후 반환.
 * 4. Redis 오류는 pino warn 으로 기록하고 오류를 전파하지 않는다 (서비스 중단 방지).
 *
 * @param key        캐시 키 (CACHE_KEYS 상수 사용 권장)
 * @param ttlSeconds TTL(초): popular=3600, 목록=300
 * @param fallback   캐시 미스 시 실행할 DB 집계 함수
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fallback: () => Promise<T>,
): Promise<T> {
  const redis = getApiRedis();

  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (e) {
    logger.warn({ err: e, key }, "Redis GET 실패 — DB 폴백");
  }

  const data = await fallback();

  try {
    await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
  } catch (e) {
    logger.warn({ err: e, key }, "Redis SET 실패 — 캐시 저장 건너뜀");
  }

  return data;
}
