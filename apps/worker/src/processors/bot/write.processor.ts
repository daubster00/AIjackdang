/**
 * bot.write 잡 처리기 stub — Story 11.13
 *
 * Story 11.9에서 실 구현 예정.
 *
 * 경계 제약:
 *  - apps/api/src/* import 절대 금지 (worker 프로세스 경계 외).
 *  - 실제 파이프라인 연결은 Story 11.9 완료 + server-bot 경계 이전 후 수행.
 *
 * [Source: Story 11.13 핵심 경계 제약 §stub 규칙]
 */

import type { Job } from "bullmq";

/** TODO: Story 11.9에서 실 구현 */
export async function botWriteProcessor(_job: Job): Promise<void> {
  console.info(`[bot-write] 잡 수신: jobId=${_job.id} — stub, Story 11.9 구현 예정`);

  // TODO: 파이프라인을 server-bot 경계로 이전 후 연결(apps/api 직접 import 불가)
  //   import { runPostPipeline } from '@ai-jakdang/server-bot/pipeline';
  //   const result = await runPostPipeline({ ... });
}
