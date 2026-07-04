/**
 * bot.write 잡 처리기 — 자동 운영 배선.
 *
 * daily-plan(11.11)이 계획한 `bot.write` 잡을 실행한다.
 * 게이트(킬 스위치·글 수 상한·비용 상한·관찰 모드)를 확인한 뒤, apps/api의
 * /internal/bots/write 엔드포인트로 글 생성 파이프라인(runPostPipeline)을 위임한다.
 *
 * 경계 제약:
 *  - apps/api/src/* import 절대 금지 (worker 프로세스 경계 외).
 *  - 게이트: @ai-jakdang/server-bot/gates
 *  - 게시 실행: HTTP 브리지(postInternalBotApi) — 커리큘럼 예약 게시와 동일 패턴.
 *
 * throw 금지 — 게이트 차단·API 미도달 모두 로그만 남기고 정상 완료(return).
 */

import type { Job } from "bullmq";
import { checkBotGates, logBotSkip } from "@ai-jakdang/server-bot/gates";
import { postInternalBotApi } from "./internal-api.js";

type BotWriteData = { personaId?: string; targetBoard?: string };

export async function botWriteProcessor(job: Job): Promise<void> {
  const data = (job.data ?? {}) as BotWriteData;
  const personaId = data.personaId ?? null;
  const board = data.targetBoard ?? null;

  // ── 게이트 체크 (킬 스위치·글 수 상한·비용 상한·관찰 모드) ───────────────────
  const gate = await checkBotGates("write");
  if (!gate.allowed) {
    await logBotSkip(personaId, gate.reason, "write");
    return; // BullMQ 정상 완료 (throw 금지)
  }

  // ── 관찰 모드: 자동 게시 보류 ────────────────────────────────────────────────
  if (gate.observationMode) {
    console.info(`[bot-write] 관찰 모드 ON — 자동 게시 보류 (personaId=${personaId}, jobId=${job.id})`);
    return;
  }

  if (!personaId || !board) {
    console.warn(`[bot-write] personaId/targetBoard 누락 — skip (jobId=${job.id})`);
    return;
  }

  // ── 내부 API로 글 생성 파이프라인 위임 ────────────────────────────────────────
  const result = await postInternalBotApi<{ status: string; postId?: string; reason?: string }>(
    "/internal/bots/write",
    { personaId, board },
    job.id,
  );

  if (result) {
    console.info(
      `[bot-write] 완료 (jobId=${job.id}): status=${result.status}` +
        (result.postId ? ` postId=${result.postId}` : "") +
        (result.reason ? ` reason=${result.reason}` : ""),
    );
  }
}
