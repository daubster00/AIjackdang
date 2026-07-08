/**
 * 커리큘럼 예약 게시 스캔 서비스 — Story 13.6
 *
 * apps/worker는 apps/api를 직접 import할 수 없으므로(경계 제약),
 * worker는 /internal/bots/curriculum/publish-scan HTTP 엔드포인트를 POST해
 * 이 함수를 간접 실행한다.
 *
 * 이 함수는 publishChapter(13.3)를 직접 import해 실행 가능하다.
 * 실행 후 bot_activity_log 적재는 personaId NOT NULL 제약으로 불가 →
 * console 로그만 남긴다. (챕터 status 변경이 충분한 감사 추적 역할)
 *
 * [Source: _bmad-output/implementation-artifacts/13-6-schedule-publisher-cron.md#오케스트레이터-확정-설계]
 */

import { and, eq, inArray, lte } from "drizzle-orm";
import { getDb } from "@ai-jakdang/database";
import { botCurriculumChapters } from "@ai-jakdang/database/schema";
import { publishChapter } from "./curriculum-staging.js";

export interface CurriculumPublishScanResult {
  published: number;
  skipped: number;
  overdue: number;
}

/**
 * scheduled_at <= now() AND status='ready' 챕터를 스캔하고 순서대로 발행한다.
 *
 * Step 2: ready 챕터 스캔 (scheduledAt ASC)
 * Step 3: 챕터별 publishChapter 호출 (오류 격리 — throw 금지)
 * Step 4: 미완 챕터(이미지 보류) 감지 + console.warn
 */
export async function runCurriculumPublishScan(): Promise<CurriculumPublishScanResult> {
  const db = getDb();
  const now = new Date();

  let published = 0;
  let skipped = 0;

  // ── Step 2: 게시 대상 스캔 — 초안 완료(drafted)·이미지완료(ready) 챕터 중 예약 시각 도달분 ──
  // 이미지 자리가 비어 있어도(pending 슬롯) 게시 가능 — 빈 자리는 이미지 없이 렌더된다.
  const readyChapters = await db
    .select()
    .from(botCurriculumChapters)
    .where(
      and(
        lte(botCurriculumChapters.scheduledAt, now),
        inArray(botCurriculumChapters.status, ["drafted", "ready"]),
      ),
    )
    .orderBy(botCurriculumChapters.scheduledAt);

  // ── Step 3: 챕터별 게시 실행 ────────────────────────────────────────────────
  // publishChapter(13.3)가 status/publishedPostId/continuitySummary를 이미 갱신하므로
  // 이 함수에서 중복 UPDATE 불필요.
  //
  // bot_activity_log.persona_id NOT NULL 제약 → personaId=null 삽입 불가.
  // 커리큘럼 게시 로그는 console.info만 남긴다. (챕터 status 변경이 감사 추적 역할)
  for (const chapter of readyChapters) {
    try {
      const result = await publishChapter(chapter.id);

      if (result.status === "published") {
        published++;
        console.info(
          `[curriculum-publish-scan] 게시 완료: chapterId=${chapter.id}, postId=${result.postId}, seriesId=${chapter.seriesId}, orderIndex=${chapter.orderIndex}`,
        );
      } else {
        skipped++;
        console.warn(
          `[curriculum-publish-scan] 게시 실패: chapterId=${chapter.id}, status=${result.status}, reason=${result.reason ?? "unknown"}`,
        );
      }
    } catch (err) {
      // 챕터별 오류가 다른 챕터 처리를 막으면 안 됨 (fail-safe)
      skipped++;
      console.error(
        `[curriculum-publish-scan] 챕터 게시 예외 (chapterId=${chapter.id}):`,
        (err as Error).message,
      );
    }
  }

  // ── Step 4: 초안 미생성 챕터 감지 + 경고 로그 ──────────────────────────────
  // scheduled_at <= now AND status='planned' → 초안이 아직 없어 게시 불가한 챕터
  const overdueChapters = await db
    .select()
    .from(botCurriculumChapters)
    .where(
      and(
        lte(botCurriculumChapters.scheduledAt, now),
        eq(botCurriculumChapters.status, "planned"),
      ),
    );

  for (const chapter of overdueChapters) {
    console.warn(
      `[curriculum-publish-scan] 초안 미생성 챕터 보류: chapterId=${chapter.id}, status=${chapter.status}, scheduledAt=${chapter.scheduledAt?.toISOString()}, reason=draft_not_generated`,
    );
  }

  const result: CurriculumPublishScanResult = {
    published,
    skipped,
    overdue: overdueChapters.length,
  };

  console.info(`[curriculum-publish-scan] 스캔 완료:`, result);
  return result;
}
