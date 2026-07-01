/**
 * 봇 BullMQ 잡 디스패처 — Story 11.13
 *
 * 단일 "bot" 큐에서 job.name 기반 분기.
 * 각 processor는 시작 시 bot_master_enabled(킬 스위치) 확인 후 skip 여부 결정 (Story 11.12).
 *
 * 잡 이름 → 처리기 대응:
 *   bot.daily-plan    → dailyPlanProcessor   (Story 11.11)
 *   bot.write         → botWriteProcessor    (Story 11.9, 현재 stub)
 *   bot.comment       → commentProcessor     (Story 11.10, 게이트 배선됨)
 *   bot.daily-report  → botDailyReportProcessor (Story 11.17, 현재 stub)
 *   bot.refill-topics → botRefillTopicsProcessor (Story 11.9 연결 예정, 현재 stub)
 *
 * [Source: Story 11.13 Task 2]
 */

import type { Job } from "bullmq";
import { dailyPlanProcessor } from "./dailyPlan.processor.js"; // Story 11.11 생성
import { botWriteProcessor } from "./write.processor.js"; // Story 11.9 생성 (현재 stub)
import { commentProcessor } from "./comment.processor.js"; // Story 11.10 생성 (게이트 배선됨)
import { botDailyReportProcessor } from "./daily-report.processor.js"; // Story 11.17에서 실구현 예정
import { botRefillTopicsProcessor } from "./refill-topics.processor.js"; // Story 11.9 연결 예정

/**
 * 봇 잡 디스패처.
 *
 * 잘못된 job.name이 수신되면 throw 없이 console.warn만 출력한다.
 * BullMQ Worker는 processor가 throw해야 failed 이벤트를 발행하므로,
 * 알 수 없는 잡 이름은 실패가 아닌 경고로만 처리한다.
 */
export async function botProcessor(job: Job): Promise<void> {
  switch (job.name) {
    case "bot.daily-plan":
      return dailyPlanProcessor(job);
    case "bot.write":
      return botWriteProcessor(job);
    case "bot.comment":
      return commentProcessor(job as Job<import("./types.js").BotCommentJobPayload>);
    case "bot.daily-report":
      return botDailyReportProcessor(job);
    case "bot.refill-topics":
      return botRefillTopicsProcessor(job);
    default:
      // 알 수 없는 잡 이름 — throw 금지(BullMQ failed 큐 오염 방지)
      console.warn(`[bot-worker] 알 수 없는 job.name: ${job.name} (jobId=${job.id})`);
  }
}

// Story 11.10 배럴 호환성 유지 (기존 import 경로 보호)
export { commentProcessor } from "./comment.processor.js";
export { dailyPlanProcessor } from "./dailyPlan.processor.js";
export type { BotCommentJobPayload } from "./types.js";
