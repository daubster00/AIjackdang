import { z } from "zod";

/**
 * 이메일 발송 BullMQ job payload 스키마 (Story 1.3).
 *
 * email 큐에 `email.send` job 이름으로 발행된다.
 * apps/worker 에서 이 스키마로 파싱 후 실제 이메일 발송을 처리한다.
 */
export const emailSendPayloadSchema = z.object({
  /** 수신자 이메일 주소 */
  to: z.string().email(),
  /** 이메일 제목 */
  subject: z.string().min(1),
  /** 이메일 템플릿 ID (향후 템플릿 시스템 연동) */
  templateId: z.string().min(1),
  /** 템플릿 변수 (키-값 맵) */
  variables: z.record(z.string(), z.string()).default({}),
});

export type EmailSendPayload = z.infer<typeof emailSendPayloadSchema>;

/** email 큐 job 이름 상수 */
export const EMAIL_JOB_NAMES = {
  send: "email.send",
} as const;
