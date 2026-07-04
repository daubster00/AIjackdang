/**
 * comment.processor — 자동 운영 배선 (Story 11.10 / 11.12 게이트 + HTTP 브리지).
 *
 * daily-plan(11.11)이 계획한 `bot.comment` 잡을 실행한다.
 * 게이트(킬 스위치·댓글 수 상한·비용 상한·관찰 모드)를 확인한 뒤, apps/api의
 * /internal/bots/comment 엔드포인트로 댓글 파이프라인(runCommentPipeline)을 위임한다.
 * (대상 게시글 선택은 apps/api 라우트가 실행 시점에 수행한다.)
 *
 * 경계 제약:
 *  - apps/api/src/* import 절대 금지 (worker 프로세스 경계 외).
 *  - 게이트: @ai-jakdang/server-bot/gates
 *  - 실행: HTTP 브리지(postInternalBotApi) — 커리큘럼 예약 게시와 동일 패턴.
 *
 * throw 금지 — 게이트 차단·API 미도달 모두 로그만 남기고 정상 완료(return).
 */

import type { Job } from "bullmq";
import { checkBotGates, logBotSkip } from "@ai-jakdang/server-bot/gates";
import { postInternalBotApi } from "./internal-api.js";
import type { BotCommentJobPayload } from "./types.js";

// daily-plan이 넣는 계획 페이로드: { personaId, triggeredDate, targetBoard }
type PlannerCommentData = BotCommentJobPayload & {
  personaId?: string;
  triggeredDate?: string;
};

export async function commentProcessor(job: Job<BotCommentJobPayload>): Promise<void> {
  const data = (job.data ?? {}) as PlannerCommentData;
  const personaId = data.personaId ?? null;
  const targetBoard = data.targetBoard ?? null;

  // ── 게이트 체크 (킬 스위치·댓글 수 상한·비용 상한·관찰 모드) ──────────────────
  const gate = await checkBotGates("comment");
  if (!gate.allowed) {
    await logBotSkip(personaId, gate.reason, "comment");
    return; // BullMQ 정상 완료 (throw 금지)
  }

  // ── 관찰 모드: 자동 게시 보류 ────────────────────────────────────────────────
  if (gate.observationMode) {
    console.info(`[comment.processor] 관찰 모드 ON — 자동 게시 보류 (personaId=${personaId}, jobId=${job.id})`);
    return;
  }

  if (!personaId || !targetBoard) {
    console.warn(`[comment.processor] personaId/targetBoard 누락 — skip (jobId=${job.id})`);
    return;
  }

  // ── 내부 API로 댓글 파이프라인 위임 (대상 게시글은 API가 선택) ─────────────────
  const result = await postInternalBotApi<{ outcome: string; commentId?: string }>(
    "/internal/bots/comment",
    { personaId, targetBoard },
    job.id,
  );

  if (result) {
    console.info(
      `[comment.processor] 완료 (jobId=${job.id}): outcome=${result.outcome}` +
        (result.commentId ? ` commentId=${result.commentId}` : ""),
    );
  }
}
