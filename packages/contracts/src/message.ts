/**
 * 쪽지(1:1 메시지) Zod 스키마 — Story 7.1
 */

import { z } from "zod";
import { paginatedResponseSchema } from "./common";

// ── 쪽지 단건 스키마 ──────────────────────────────────────────────────────────

export const messageSchema = z.object({
  id: z.string().uuid(),
  senderId: z.string().uuid(),
  receiverId: z.string().uuid(),
  body: z.string(),
  isRead: z.boolean(),
  deletedBySender: z.boolean(),
  deletedByReceiver: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
});
export type Message = z.infer<typeof messageSchema>;

// ── 쪽지 작성 입력 ────────────────────────────────────────────────────────────

export const createMessageSchema = z.object({
  receiverId: z.string().uuid(),
  body: z.string().min(1).max(500),
});
export type CreateMessage = z.infer<typeof createMessageSchema>;

// ── 대화 목록 아이템 ──────────────────────────────────────────────────────────

/**
 * 쪽지함 대화 목록 아이템.
 * 대화 상대 정보 + 마지막 메시지 + 안 읽은 메시지 수.
 */
export const conversationSchema = z.object({
  partnerId: z.string().uuid(),
  partnerNickname: z.string(),
  partnerRank: z.string().nullable(),
  partnerAvatarUrl: z.string().nullable(),
  lastMessage: z.object({
    id: z.string().uuid(),
    body: z.string(),
    createdAt: z.string().datetime({ offset: true }),
    isRead: z.boolean(),
  }),
  unreadCount: z.number().int().nonnegative(),
});
export type Conversation = z.infer<typeof conversationSchema>;

// ── 페이지네이션 래퍼 ─────────────────────────────────────────────────────────

export const paginatedMessagesSchema = paginatedResponseSchema(messageSchema);
export type PaginatedMessages = z.infer<typeof paginatedMessagesSchema>;

export const paginatedConversationsSchema = paginatedResponseSchema(conversationSchema);
export type PaginatedConversations = z.infer<typeof paginatedConversationsSchema>;

// ── 쪽지함 개별 메시지 아이템 (메일박스형 UI용) ────────────────────────────────

/**
 * 받은/보낸 쪽지함 목록 아이템.
 * counterpart = 받은 쪽지일 때는 발신자, 보낸 쪽지일 때는 수신자.
 */
export const messageBoxItemSchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  isRead: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
  counterpart: z.object({
    id: z.string().uuid(),
    nickname: z.string(),
    avatarUrl: z.string().nullable(),
  }),
});
export type MessageBoxItem = z.infer<typeof messageBoxItemSchema>;

export const messageBoxResponseSchema = z.object({
  items: z.array(messageBoxItemSchema),
});
export type MessageBoxResponse = z.infer<typeof messageBoxResponseSchema>;

// ── 휴지통 아이템 ─────────────────────────────────────────────────────────────

/**
 * 휴지통(받은·보낸 합산) 목록 아이템.
 * originalBox: 원래 받은 쪽지였는지 보낸 쪽지였는지.
 */
export const trashedMessageItemSchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  isRead: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
  trashedAt: z.string().datetime({ offset: true }).nullable(),
  originalBox: z.enum(["received", "sent"]),
  counterpart: z.object({
    id: z.string().uuid(),
    nickname: z.string(),
    avatarUrl: z.string().nullable(),
  }),
});
export type TrashedMessageItem = z.infer<typeof trashedMessageItemSchema>;

export const trashListResponseSchema = z.object({
  items: z.array(trashedMessageItemSchema),
});
export type TrashListResponse = z.infer<typeof trashListResponseSchema>;

// ── 영구삭제 요청 ─────────────────────────────────────────────────────────────

export const purgeMessagesBodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});
export type PurgeMessagesBody = z.infer<typeof purgeMessagesBodySchema>;
