/**
 * bot.refill-topics 잡 처리기 stub — Story 11.13
 * bot_topics(주제 풀) 소진 감지 → 자동 보충은 Story 11.9 완료 후 연결.
 *
 * [Source: Story 11.13 Task 4]
 */

import type { Job } from "bullmq";

/** TODO: Story 11.9 연결 예정 */
export async function botRefillTopicsProcessor(job: Job): Promise<void> {
  console.info(`[bot-refill-topics] 잡 수신: jobId=${job.id} — Story 11.9 연결 예정`);

  // TODO: 파이프라인을 server-bot 경계로 이전 후 연결(apps/api 직접 import 불가)
  //   import { refillTopics } from '@ai-jakdang/server-bot/pipeline';
}
