/**
 * 커리큘럼 예약시각 자동 배정 유틸 — Story 13.6
 *
 * 시리즈 챕터에 하루 간격 scheduled_at을 자동 배정한다.
 * 관리자 API(13.5)가 "자동 하루 간격 배정" 액션에서 이 헬퍼를 호출한다.
 *
 * 공개 임포트 경로: @ai-jakdang/server-bot/curriculum-schedule
 *
 * [Source: _bmad-output/implementation-artifacts/13-6-schedule-publisher-cron.md#Task-1]
 */

import { asc, eq } from "drizzle-orm";
import { getDb } from "@ai-jakdang/database";
import { botCurriculumChapters } from "@ai-jakdang/database/schema";

/**
 * 시리즈의 챕터에 하루 간격 예약 시각을 자동 배정한다.
 *
 * - orderIndex = 1 → startAt
 * - orderIndex = 2 → startAt + 1일
 * - orderIndex = N → startAt + (N-1)일
 *
 * @param seriesId  - 시리즈 ID
 * @param startAt   - 1편 예약 시각(1편의 scheduledAt)
 * @param skipIfSet - true(기본값)이면 scheduledAt이 이미 설정된 챕터는 덮어쓰지 않는다.
 *
 * 사용 예시 (13.6 완료 후 관리자 API 자동 배정 액션에서 호출):
 * ```typescript
 * import { assignDefaultScheduledTimes } from '@ai-jakdang/server-bot/curriculum-schedule';
 * await assignDefaultScheduledTimes(seriesId, new Date(), true);
 * ```
 */
export async function assignDefaultScheduledTimes(
  seriesId: string,
  startAt: Date,
  skipIfSet = true,
): Promise<void> {
  const db = getDb();

  const chapters = await db
    .select()
    .from(botCurriculumChapters)
    .where(eq(botCurriculumChapters.seriesId, seriesId))
    .orderBy(asc(botCurriculumChapters.orderIndex));

  if (chapters.length === 0) {
    console.info(
      `[curriculum-schedule] 시리즈(${seriesId}) 챕터 없음 — 배정 건너뜀`,
    );
    return;
  }

  let updatedCount = 0;

  for (const chapter of chapters) {
    // skipIfSet=true이고 이미 scheduledAt이 설정된 챕터는 건너뜀
    if (skipIfSet && chapter.scheduledAt !== null) {
      continue;
    }

    const targetTime = new Date(
      startAt.getTime() + (chapter.orderIndex - 1) * 24 * 60 * 60 * 1000,
    );

    await db
      .update(botCurriculumChapters)
      .set({ scheduledAt: targetTime, updatedAt: new Date() })
      .where(eq(botCurriculumChapters.id, chapter.id));

    updatedCount++;
  }

  console.info(
    `[curriculum-schedule] 예약시각 배정 완료: seriesId=${seriesId}, 업데이트=${updatedCount}/${chapters.length}`,
  );
}
