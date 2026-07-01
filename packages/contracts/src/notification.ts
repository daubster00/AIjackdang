/**
 * 알림 Zod 스키마 — Story 7.1
 *
 * notificationType 8종 (inquiry.replied 포함 — 크로스 스토리 최적화).
 */

import { z } from "zod";
import { paginatedResponseSchema } from "./common";

// ── 알림 타입 ─────────────────────────────────────────────────────────────────

/**
 * 알림 타입 enum — 8종.
 *
 * Story 7.1 명세 7종 + `inquiry.replied`(Story 7.5)를 처음부터 포함하여
 * Story 7.5에서 enum 추가용 2차 마이그레이션을 방지한다 (크로스 스토리 최적화).
 */
export const notificationTypeSchema = z.enum([
  "comment.created",
  "answer.created",
  "comment.replied",
  "reaction.received",
  "helpful_answer.marked",
  "message.received",
  "sanction.applied",
  "inquiry.replied",
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

// ── 알림 단건 스키마 ──────────────────────────────────────────────────────────

export const notificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: notificationTypeSchema,
  targetType: z.string().nullable(),
  // targetId: 게시글/댓글은 UUID, 질문은 slug 문자열 → uuid 강제 불가 (0026 마이그레이션 정합화)
  targetId: z.string().nullable(),
  title: z.string(),
  body: z.string(),
  isRead: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
});
export type Notification = z.infer<typeof notificationSchema>;

// ── SSE 이벤트 페이로드 ───────────────────────────────────────────────────────

/**
 * Redis PUBLISH / SSE push 페이로드.
 * publishNotification 이 payload 입력으로 받는 타입.
 */
export const notificationEventPayloadSchema = z.object({
  type: notificationTypeSchema,
  targetType: z.string().optional(),
  // targetId: 게시글/댓글은 UUID, 질문은 slug 문자열 (0026 마이그레이션 정합화)
  targetId: z.string().optional(),
  title: z.string(),
  body: z.string(),
  /** insert 후 채워짐 — PUBLISH 시 포함 */
  id: z.string().uuid().optional(),
  createdAt: z.string().datetime({ offset: true }).optional(),
});
export type NotificationEventPayload = z.infer<typeof notificationEventPayloadSchema>;

// ── createNotification 입력 (publishNotification 내부용) ─────────────────────

export const createNotificationSchema = z.object({
  type: notificationTypeSchema,
  targetType: z.string().optional(),
  // targetId: 게시글/댓글은 UUID, 질문은 slug 문자열 (0026 마이그레이션 정합화)
  targetId: z.string().optional(),
  title: z.string().min(1),
  body: z.string().min(1),
});
export type CreateNotification = z.infer<typeof createNotificationSchema>;

// ── 페이지네이션 래퍼 ─────────────────────────────────────────────────────────

export const paginatedNotificationsSchema = paginatedResponseSchema(notificationSchema);
export type PaginatedNotifications = z.infer<typeof paginatedNotificationsSchema>;

// ── Story 7.2 추가 응답 스키마 ────────────────────────────────────────────────

/** GET /api/v1/notifications/unread-count 응답 */
export const unreadCountResponseSchema = z.object({ count: z.number().int() });
export type UnreadCountResponse = z.infer<typeof unreadCountResponseSchema>;

/** PATCH /api/v1/notifications/read-all 응답 */
export const readAllResponseSchema = z.object({ updatedCount: z.number().int() });
export type ReadAllResponse = z.infer<typeof readAllResponseSchema>;
