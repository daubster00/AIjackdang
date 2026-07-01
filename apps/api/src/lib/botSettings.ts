/**
 * 봇 설정 API 헬퍼 — Story 11.12 / 11.16 공유
 *
 * bot_settings 테이블에서 설정값을 조회/저장하는 API 프로세스 전용 헬퍼.
 * apps/api/src/lib/siteSettings.ts 와 동일 패턴(Redis 캐시 60초)이나
 * bot_settings 테이블을 대상으로 한다.
 *
 * 캐시 키 prefix: `bot_settings:` (siteSettings의 `site_settings:`와 구분)
 *
 * worker 프로세스(패키지 경계 외)에서는 Redis 없이 DB 직접 조회하는
 * `packages/server-bot/src/botSettings.ts` 를 사용할 것.
 *
 * [Source: docs/seeding-bot/ARCHITECTURE.md#2.10-bot_settings]
 * [Source: apps/api/src/lib/siteSettings.ts — 재사용 패턴]
 */

import { getDb } from "@ai-jakdang/database";
import { botSettings } from "@ai-jakdang/database/schema";
import { eq } from "drizzle-orm";
import { getApiRedis } from "./redis.js";

const CACHE_PREFIX = "bot_settings:";
const CACHE_TTL_SECONDS = 60;

// ── 단건 조회 ─────────────────────────────────────────────────────────────────

/**
 * 단일 설정 키 값을 반환한다. JSONB 값을 파싱된 JS 값으로 반환.
 * Redis 캐시 우선, miss 시 DB 조회 후 캐싱.
 *
 * 안전 기본값:
 * - Redis·DB 모두 실패 → null 반환 + warn
 * - 키 미존재 → null 반환
 */
export async function getBotSetting<T = unknown>(key: string): Promise<T | null> {
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

  try {
    const db = getDb();
    const [row] = await db
      .select({ value: botSettings.value })
      .from(botSettings)
      .where(eq(botSettings.key, key))
      .limit(1);

    const value = (row?.value ?? null) as T | null;

    try {
      await redis.set(cacheKey, JSON.stringify(value), "EX", CACHE_TTL_SECONDS);
    } catch {
      // 캐시 실패 무시
    }

    return value;
  } catch (err) {
    console.warn("[bot-settings] bot_settings 조회 실패:", (err as Error).message);
    return null;
  }
}

// ── 단건 저장 ─────────────────────────────────────────────────────────────────

/**
 * 단일 설정 키를 upsert하고 캐시를 무효화한다.
 * (Story 11.16 관리자 설정 API에서 사용)
 */
export async function setBotSetting<T = unknown>(key: string, value: T): Promise<void> {
  const db = getDb();
  await db
    .insert(botSettings)
    .values({ key, value: value as unknown as Record<string, unknown>, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: botSettings.key,
      set: { value: value as unknown as Record<string, unknown>, updatedAt: new Date() },
    });

  await invalidateBotSetting(key);
}

// ── 전체 조회 ─────────────────────────────────────────────────────────────────

/**
 * 전체 봇 설정을 flat 객체({key: value})로 반환한다.
 * (Story 11.16 관리자 설정 API에서 사용)
 */
export async function getAllBotSettings(): Promise<Record<string, unknown>> {
  const db = getDb();
  const rows = await db
    .select({ key: botSettings.key, value: botSettings.value })
    .from(botSettings);

  const result: Record<string, unknown> = {};
  for (const r of rows) {
    result[r.key] = r.value;
  }
  return result;
}

// ── 캐시 무효화 ─────────────────────────────────────────────────────────────────

/** 단일 키 캐시를 무효화한다. setBotSetting 저장 후 호출. */
export async function invalidateBotSetting(key: string): Promise<void> {
  try {
    await getApiRedis().del(`${CACHE_PREFIX}${key}`);
  } catch {
    // 무시
  }
}
