/**
 * 알림 설정 Zod 스키마 — Story 7.1
 */

import { z } from "zod";
import { notificationTypeSchema } from "./notification";

// ── 알림 설정 jsonb 스키마 ────────────────────────────────────────────────────

/** 알림 타입별 on/off 설정 맵 */
export const notificationSettingsJsonSchema = z.record(notificationTypeSchema, z.boolean());
export type NotificationSettingsJson = z.infer<typeof notificationSettingsJsonSchema>;

// ── 알림 설정 단건 스키마 ─────────────────────────────────────────────────────

export const notificationSettingsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  settings: notificationSettingsJsonSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

// ── 알림 설정 수정 입력 ───────────────────────────────────────────────────────

/** partial: 일부 타입만 업데이트 가능 — ZodRecord는 .partial() 미지원이므로 object로 정의 */
export const updateNotificationSettingsSchema = z.object({
  "comment.created": z.boolean().optional(),
  "answer.created": z.boolean().optional(),
  "comment.replied": z.boolean().optional(),
  "reaction.received": z.boolean().optional(),
  "helpful_answer.marked": z.boolean().optional(),
  "message.received": z.boolean().optional(),
  "sanction.applied": z.boolean().optional(),
  "inquiry.replied": z.boolean().optional(),
});
export type UpdateNotificationSettings = z.infer<typeof updateNotificationSettingsSchema>;
