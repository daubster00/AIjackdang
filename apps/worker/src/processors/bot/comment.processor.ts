/**
 * comment.processor — Story 11.10 / 11.12(게이트 배선)
 *
 * BullMQ `bot.comment` 잡 처리기.
 *
 * 경계 결정:
 *  - 핵심 파이프라인 오케스트레이션은 `apps/api/src/services/bot/comment-pipeline.ts`에 구현.
 *  - 이 파일은 얇은 처리기: 게이트 체크 + no-op 처리.
 *  - 실제 파이프라인 배선은 Story 11.13이 담당 (BullMQ 큐 생성·cron 등록).
 *
 * 게이트 체크 (Story 11.12, AC: #1~#4):
 *  - checkBotGates('comment') 호출 — 함수 본문 첫 번째 줄 (어떤 DB 쓰기·AI 호출보다 앞).
 *  - allowed: false → logBotSkip + return (BullMQ 정상 완료, 실패 아님).
 *  - allowed: true, observationMode: true → holdForObservation으로 분기 (11.17 구현 예정).
 *
 * ⚠️ apps/api/src/* import 절대 금지 (worker 프로세스 경계 외).
 *    순수 함수는 @ai-jakdang/bot-core, AI는 @ai-jakdang/server-bot/ai,
 *    게이트는 @ai-jakdang/server-bot/gates 에서만 import.
 *
 * [Source: docs/seeding-bot/EPICS-AND-STORIES.md Story 11.10]
 * [Source: docs/seeding-bot/EPICS-AND-STORIES.md Story 11.12]
 * [Source: Story 11.13 — BullMQ 큐·cron 정식 등록 담당]
 */

import type { Job } from "bullmq";
import { checkBotGates, logBotSkip } from "@ai-jakdang/server-bot/gates";
import type { BotCommentJobPayload } from "./types.js";

/**
 * `bot.comment` 잡 처리기.
 *
 * 처리 순서:
 * 1. checkBotGates('comment') — 킬 스위치·속도 상한·비용 상한·관찰 모드 확인
 * 2. 차단 시: logBotSkip + return (정상 완료)
 * 3. 관찰 모드 시: TODO(11.17) holdForObservation + return
 * 4. 통과 시: TODO(11.13) 실제 comment-pipeline 배선
 *
 * ⚠️ BullMQ 재시도 주의:
 *   게이트 차단 시 throw가 아닌 return 으로 정상 완료 처리.
 *   throw하면 BullMQ가 실패로 기록하고 재시도를 시도한다.
 */
export async function commentProcessor(job: Job<BotCommentJobPayload>): Promise<void> {
  // ── 게이트 체크 (11.12) ─────────────────────────────────────────────────────
  // 어떤 상태 변경·DB 쓰기·AI 호출도 게이트 통과 전에 실행하면 안 된다.
  const gate = await checkBotGates("comment");
  if (!gate.allowed) {
    // BullMQ 실패 아님 — return으로 정상 완료 처리 (throw하면 재시도 큐 오염)
    // personaId: 현재 stub 페이로드에 없음 → null 전달 (콘솔 로그만 기록)
    // TODO(11.13): BotCommentJobPayload에 personaId 추가 후 job.data.personaId ?? null 로 교체
    await logBotSkip(null, gate.reason, "comment");
    return;
  }

  const { targetPostId, targetBoard, parentCommentId } = job.data;

  console.info("[comment.processor] bot.comment 잡 게이트 통과:", {
    jobId: job.id,
    targetPostId,
    targetBoard,
    parentCommentId,
    observationMode: gate.observationMode,
  });

  // ── 관찰 모드 분기 (11.12 AC: #4) ────────────────────────────────────────
  if (gate.observationMode) {
    // TODO(11.17): holdForObservation(generationJobId, draftContent, 'observation_mode', personaId)
    // 현재는 관찰 모드 활성 시 로그만 남기고 no-op. 11.17이 보류 큐 처리 구현 후 교체.
    console.info(
      `[comment.processor] 관찰 모드 ON — 보류 큐 예정 (11.17 구현 후 활성화, targetPostId=${targetPostId})`,
    );
    return;
  }

  // ── 실제 파이프라인 (11.13 배선 예정) ─────────────────────────────────────
  // TODO(11.13): apps/api의 runCommentPipeline을 server-bot 경계로 이전 후 연결.
  //   import { runCommentPipeline } from '@ai-jakdang/server-bot/pipeline';
  //   const result = await runCommentPipeline({ targetPostId, targetBoard, parentCommentId });
  //   console.info(`[comment.processor] 파이프라인 완료: ${result.outcome}`, { jobId: job.id });

  console.info(
    `[comment.processor] stub — 11.13 배선 전까지 no-op (targetPostId=${targetPostId})`,
  );
}
