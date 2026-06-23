/**
 * 이메일 BullMQ 큐 (Story 1.3).
 *
 * email 큐에 job 을 발행한다. 실제 발송은 apps/worker 에서 처리한다.
 * Redis 없는 환경(개발·테스트)에서는 연결 오류를 로깅하고 무시한다.
 */

import { Queue } from "bullmq";
import type { EmailSendPayload } from "@ai-jakdang/contracts";
import { EMAIL_JOB_NAMES } from "@ai-jakdang/contracts";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

/** 이메일 큐 이름 — worker/src/connection.ts 의 QUEUE_NAMES.email 과 동일해야 한다 */
const EMAIL_QUEUE_NAME = "email";

/** BullMQ 이메일 큐 인스턴스 (lazy singleton) */
let _emailQueue: Queue<EmailSendPayload> | null = null;

function getEmailQueue(): Queue<EmailSendPayload> {
  if (!_emailQueue) {
    _emailQueue = new Queue<EmailSendPayload>(EMAIL_QUEUE_NAME, {
      connection: {
        host: parseRedisHost(REDIS_URL),
        port: parseRedisPort(REDIS_URL),
        lazyConnect: true,
      },
    });
    _emailQueue.on("error", (err) => {
      // Redis 미기동 환경에서 큐가 연결 오류를 내더라도 API 를 중단하지 않는다.
      console.warn("[email-queue] Redis 연결 오류 (이메일 큐 발행 불가):", err.message);
    });
  }
  return _emailQueue;
}

/**
 * 이메일 발송 job 을 큐에 발행한다.
 * Redis 없는 환경에서는 오류를 catch 하고 console 에 폴백 출력한다.
 */
export async function enqueueEmail(payload: EmailSendPayload): Promise<void> {
  try {
    const queue = getEmailQueue();
    await queue.add(EMAIL_JOB_NAMES.send, payload, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 1000,
    });
    console.info("[email-queue] job 발행 완료:", {
      to: payload.to,
      subject: payload.subject,
      templateId: payload.templateId,
    });
  } catch (err) {
    // Redis 없는 개발환경 폴백: 이메일 내용 console 출력
    console.warn("[email-queue] job 발행 실패 (폴백 — console 출력):", err);
    console.info("[email-queue] ── 이메일 폴백 출력 ──────────────────");
    console.info("  TO:", payload.to);
    console.info("  SUBJECT:", payload.subject);
    console.info("  TEMPLATE:", payload.templateId);
    console.info("  VARIABLES:", JSON.stringify(payload.variables, null, 2));
    console.info("[email-queue] ─────────────────────────────────────");
  }
}

// ── Redis URL 파싱 헬퍼 ────────────────────────────────────────────────────────

function parseRedisHost(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname || "localhost";
  } catch {
    return "localhost";
  }
}

function parseRedisPort(url: string): number {
  try {
    const u = new URL(url);
    return u.port ? parseInt(u.port, 10) : 6379;
  } catch {
    return 6379;
  }
}
