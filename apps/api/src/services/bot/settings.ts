/**
 * 봇 전역 설정 헬퍼 — Story 11.5 / 11.12 리팩터링
 *
 * bot_settings 테이블에서 설정값을 조회하는 공용 헬퍼 함수.
 * Story 11.12에서 공용 getBotSetting(apps/api/lib/botSettings.ts)을 재사용하도록 리팩터링.
 *
 * [Source: docs/seeding-bot/ARCHITECTURE.md#2.10-bot_settings]
 */

import { getBotSetting } from "../../lib/botSettings.js";

/**
 * bot_settings 테이블에서 'bot_exclude_from_ranking' 값을 조회한다.
 *
 * - 값이 true이면 랭킹·통계 쿼리에서 봇 계정(users.is_bot=true)을 제외.
 * - bot_settings 테이블 미존재(Story 11.1 미완) 또는 키 미존재 시 기본값 true(제외) 반환.
 * - 네트워크·DB 오류 시에도 기본값 true로 안전하게 fallback.
 *
 * @returns true = 봇 제외, false = 봇 포함
 */
export async function getBotExcludeFromRanking(): Promise<boolean> {
  try {
    const val = await getBotSetting<boolean>("bot_exclude_from_ranking");

    // 키가 없거나(null) → 기본값 true(제외)
    if (val === null || val === undefined) return true;

    // JSONB boolean true / 문자열 "true" 모두 처리
    return val === true || (val as unknown) === "true";
  } catch {
    // bot_settings 테이블 미존재, DB 연결 실패 등 모든 예외 → 기본값 true(제외)
    return true;
  }
}
