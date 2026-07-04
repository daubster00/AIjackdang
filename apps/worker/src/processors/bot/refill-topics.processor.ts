/**
 * bot.refill-topics 잡 처리기 — 자동 운영 배선.
 *
 * daily-plan보다 1시간 앞선 cron(11.13)이 트리거한다.
 * 게이트(킬 스위치·비용 상한)를 확인한 뒤, apps/api의 /internal/bots/refill-topics
 * 엔드포인트로 주제 풀 자동 보충(refillTopicsIfNeeded)을 위임한다.
 * (auto-refill 설정·부족 임계치 확인은 apps/api 서비스 내부에서 수행한다.)
 *
 * 경계 제약:
 *  - apps/api/src/* import 절대 금지 (worker 프로세스 경계 외).
 *  - 게이트: @ai-jakdang/server-bot/gates
 *  - 실행: HTTP 브리지(postInternalBotApi).
 *
 * throw 금지 — 게이트 차단·API 미도달 모두 로그만 남기고 정상 완료(return).
 */

import type { Job } from "bullmq";
import { checkBotGates, logBotSkip } from "@ai-jakdang/server-bot/gates";
import { postInternalBotApi } from "./internal-api.js";

export async function botRefillTopicsProcessor(job: Job): Promise<void> {
  // ── 게이트 체크 (킬 스위치 + 비용 상한) ──────────────────────────────────────
  // refill은 AI 생성 비용이 발생하므로 비용 상한 적용. 관찰 모드는 무시(게시 아님).
  const gate = await checkBotGates("refill-topics");
  if (!gate.allowed) {
    await logBotSkip(null, gate.reason, "refill-topics");
    return; // BullMQ 정상 완료 (throw 금지)
  }

  const result = await postInternalBotApi<{ personas: number; refilled: number }>(
    "/internal/bots/refill-topics",
    undefined,
    job.id,
  );

  if (result) {
    console.info(
      `[bot-refill-topics] 완료 (jobId=${job.id}): personas=${result.personas}, refilled=${result.refilled}`,
    );
  }
}
