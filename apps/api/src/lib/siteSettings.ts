/**
 * 사이트 설정 조회/캐시 유틸 — Story 9.11 / 9.15.
 *
 * site_settings(key TEXT PK, value JSONB) 를 읽어 Redis 60초 캐시로 제공한다.
 * - getSiteSetting(key): 단일 키 값(JSON 파싱된 형태) 반환, 없으면 null.
 * - getAllSiteSettings(): 전체 설정을 flat 객체로 반환.
 * - invalidateSiteSetting(key): 저장(PATCH) 후 캐시 무효화.
 *
 * 금칙어/스팸/자동숨김 임계치 등 운영 정책을 코드 재배포 없이 DB로 제어하기 위한 진입점.
 */

import { getDb } from "@ai-jakdang/database";
import { siteSettings } from "@ai-jakdang/database/schema";
import { eq } from "drizzle-orm";
import { getApiRedis } from "./redis.js";

const CACHE_PREFIX = "site_settings:";
const CACHE_TTL_SECONDS = 60;

/**
 * 단일 설정 키 값을 반환한다. JSONB 값을 그대로(이미 파싱된 JS 값) 반환한다.
 * Redis 캐시 우선, miss 시 DB 조회 후 캐시.
 */
export async function getSiteSetting<T = unknown>(key: string): Promise<T | null> {
  const redis = getApiRedis();
  const cacheKey = `${CACHE_PREFIX}${key}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
  } catch {
    // Redis 장애 시 DB 폴백
  }

  const db = getDb();
  const [row] = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, key))
    .limit(1);

  const value = (row?.value ?? null) as T | null;

  try {
    await redis.set(cacheKey, JSON.stringify(value), "EX", CACHE_TTL_SECONDS);
  } catch {
    // 캐시 실패 무시
  }

  return value;
}

/** 전체 설정을 flat 객체({key: value})로 반환한다. */
export async function getAllSiteSettings(): Promise<Record<string, unknown>> {
  const db = getDb();
  const rows = await db
    .select({ key: siteSettings.key, value: siteSettings.value })
    .from(siteSettings);

  const result: Record<string, unknown> = {};
  for (const r of rows) {
    result[r.key] = r.value;
  }
  return result;
}

/** 설정 저장 후 단일 키 캐시를 무효화한다. */
export async function invalidateSiteSetting(key: string): Promise<void> {
  try {
    await getApiRedis().del(`${CACHE_PREFIX}${key}`);
  } catch {
    // 무시
  }
}
