/**
 * bot.curriculum-publish 잡 처리기 — Story 13.6
 *
 * 경계 제약:
 *  - apps/api/src/* import 절대 금지 (worker 프로세스 경계 외)
 *  - 게이트: @ai-jakdang/server-bot/gates (checkBotGates, logBotSkip)
 *  - 게시 실행: apps/api의 /internal/bots/curriculum/publish-scan HTTP 엔드포인트를
 *    통해 위임 (publishChapter는 apps/api 경계 내에 있어 직접 import 불가)
 *
 * 게이트 체크: curriculum-publish jobKind
 *  - 킬 스위치(bot_master_enabled) + 비용 상한(bot_daily_cost_limit_usd)만 확인
 *  - 글/댓글 수 상한·관찰 모드 미적용 (관리자 예약 콘텐츠)
 *
 * throw 금지 — BullMQ 재시도 큐 오염 방지.
 * API 미도달·게이트 차단 모두 console 로그만 남기고 정상 완료(return).
 *
 * [Source: _bmad-output/implementation-artifacts/13-6-schedule-publisher-cron.md#오케스트레이터-확정-설계]
 */

import type { Job } from "bullmq";
import { checkBotGates, logBotSkip } from "@ai-jakdang/server-bot/gates";

/**
 * bot.curriculum-publish 잡 처리기.
 *
 * 처리 순서:
 * 1. checkBotGates('curriculum-publish') — 킬 스위치 + 비용 상한 확인
 * 2. 차단 시: logBotSkip + return (BullMQ 정상 완료)
 * 3. 통과 시: /internal/bots/curriculum/publish-scan POST 호출
 * 4. API 미도달 시: console.error + return (throw 금지)
 */
export async function curriculumPublishProcessor(job: Job): Promise<void> {
  // ── Step 1: 게이트 체크 ─────────────────────────────────────────────────────
  const gate = await checkBotGates("curriculum-publish");
  if (!gate.allowed) {
    // curriculum-publish는 personaId 없음 → logBotSkip(null, ...) → console.info만 기록
    await logBotSkip(null, gate.reason, "curriculum-publish");
    return; // BullMQ 정상 완료 (throw 금지 — 재시도 큐 오염 방지)
  }

  // ── Step 2: internal API 호출 ────────────────────────────────────────────────
  // API_INTERNAL_URL: docker 내부망에서는 서비스명(예: http://api:4003),
  // 로컬 개발에서는 http://localhost:4003
  const apiBaseUrl = (process.env.API_INTERNAL_URL ?? "http://localhost:4003").replace(/\/$/, "");
  const internalKey = process.env.INTERNAL_API_KEY ?? "";

  try {
    const response = await fetch(
      `${apiBaseUrl}/internal/bots/curriculum/publish-scan`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-key": internalKey,
        },
      },
    );

    if (!response.ok) {
      console.error(
        `[curriculum-publish] API 응답 오류: ${response.status} ${response.statusText} (jobId=${job.id})`,
      );
      return; // throw 금지
    }

    const result = (await response.json()) as {
      published: number;
      skipped: number;
      overdue: number;
    };

    console.info(
      `[curriculum-publish] 스캔 완료 (jobId=${job.id}): published=${result.published}, skipped=${result.skipped}, overdue=${result.overdue}`,
    );
  } catch (err) {
    // 네트워크 오류 — API 서버 미기동 등
    console.error(
      `[curriculum-publish] API 미도달 — 네트워크 오류 (jobId=${job.id}):`,
      (err as Error).message,
    );
    // throw 금지 — 네트워크 오류가 재시도 큐를 오염시키면 안 됨
  }
}
