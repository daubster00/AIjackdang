/**
 * 봇 설정 DB 헬퍼 — Story 11.12 (server-bot 패키지 내부용)
 *
 * packages/server-bot 경계에서 bot_settings 테이블을 직접 조회한다.
 * Redis 캐시 없음 — server-bot 패키지는 ioredis 의존성이 없기 때문이다.
 * 고빈도 호출 경로(API 라우트)에서는 apps/api/src/lib/botSettings.ts 를 사용할 것.
 *
 * 사용처: packages/server-bot/src/gates.ts
 *
 * [Source: docs/seeding-bot/ARCHITECTURE.md#2.10-bot_settings]
 */

import { eq } from "drizzle-orm";
import { getDb } from "@ai-jakdang/database";
import { botSettings } from "@ai-jakdang/database/schema";

/**
 * bot_settings 테이블에서 단일 키 값을 조회한다.
 *
 * 안전 기본값 (AC: #7):
 * - bot_settings 테이블 미존재(Story 11.1 미완) → null 반환 + warn
 * - 키 미존재 (row = undefined) → null 반환
 * - DB 연결 실패 등 예외 → null 반환 + warn
 *
 * @param key - bot_settings.key 값 (예: 'bot_master_enabled')
 * @returns 파싱된 JSONB 값, 없거나 오류 시 null
 */
export async function getBotSetting<T = unknown>(key: string): Promise<T | null> {
  try {
    const db = getDb();
    const [row] = await db
      .select({ value: botSettings.value })
      .from(botSettings)
      .where(eq(botSettings.key, key))
      .limit(1);

    return (row?.value ?? null) as T | null;
  } catch (err) {
    console.warn("[bot-settings] bot_settings 조회 실패:", (err as Error).message);
    return null;
  }
}
