/**
 * 봇 보류 큐 서비스 — Story 11.12 (AC: #4)
 *
 * 관찰 모드·애매·인젝션 의심 등으로 자동 게시를 보류할 때
 * bot_generation_jobs.status='held' 업데이트 + bot_hold_queue INSERT + bot_activity_log INSERT.
 *
 * 보류 큐에서 "통과" 액션(수동 게시)은 Story 11.17 범위.
 *
 * ⚠️ worker가 이 함수를 직접 import하는 것은 금지(apps/api 경계 위반).
 *    11.13/11.17 에서 @ai-jakdang/server-bot 경계로 이전 또는 re-export 예정.
 *
 * [Source: docs/seeding-bot/ARCHITECTURE.md#2.7-bot_generation_jobs]
 * [Source: docs/seeding-bot/ARCHITECTURE.md#2.8-bot_hold_queue]
 */

import { eq } from "drizzle-orm";
import { getDb } from "@ai-jakdang/database";
import { botGenerationJobs, botHoldQueue, botActivityLog } from "@ai-jakdang/database/schema";

/**
 * 잡을 보류 큐로 이동한다 (관찰 모드 또는 운영자 검토 필요 시).
 *
 * 수행 작업:
 * 1. bot_generation_jobs.status = 'held' 업데이트
 * 2. bot_hold_queue INSERT (decided=false)
 * 3. bot_activity_log INSERT (event_type='held')
 *
 * @param jobId        - bot_generation_jobs.id
 * @param draftContent - 생성된 초안 콘텐츠 (bot_hold_queue 메타 기록용, 현재 미사용)
 * @param reason       - 보류 사유 ('observation_mode' | 'ambiguous' | 'injection_suspect' | 'copyright_risk')
 * @param personaId    - bot_personas.id (활동 로그 기록용, 없으면 null 전달 시 로그 생략)
 */
export async function holdForObservation(
  jobId: string,
  draftContent: unknown,
  reason: "observation_mode" | "ambiguous" | "injection_suspect" | "copyright_risk",
  personaId?: string,
): Promise<void> {
  const db = getDb();

  // 1. bot_generation_jobs.status = 'held'
  await db
    .update(botGenerationJobs)
    .set({ status: "held", updatedAt: new Date() })
    .where(eq(botGenerationJobs.id, jobId));

  // 2. bot_hold_queue INSERT
  await db.insert(botHoldQueue).values({
    jobId,
    reason,
    decided: false,
  });

  // 3. bot_activity_log INSERT (personaId 있는 경우만)
  if (personaId) {
    await db.insert(botActivityLog).values({
      personaId,
      eventType: "held",
      refId: jobId,
      payload: { reason, draftContent: draftContent !== undefined ? "[있음]" : "[없음]" },
    });
  }
}
