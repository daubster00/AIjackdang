/**
 * 1:1 문의 Zod 스키마 — Story 7.1
 */

import { z } from "zod";
import { paginatedResponseSchema } from "./common";

// ── 문의 상태 ─────────────────────────────────────────────────────────────────

export const inquiryStatusSchema = z.enum(["pending", "in_progress", "resolved"]);
export type InquiryStatus = z.infer<typeof inquiryStatusSchema>;

// ── 문의 단건 스키마 ──────────────────────────────────────────────────────────

export const inquirySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string(),
  /** Tiptap JSON 본문 */
  body: z.unknown(),
  status: inquiryStatusSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type Inquiry = z.infer<typeof inquirySchema>;

// ── 문의 작성 입력 ────────────────────────────────────────────────────────────

export const createInquirySchema = z.object({
  title: z.string().min(1).max(100),
  /** Tiptap JSON 본문 */
  body: z.unknown(),
});
export type CreateInquiry = z.infer<typeof createInquirySchema>;

// ── 문의 답변 단건 스키마 ─────────────────────────────────────────────────────

export const inquiryReplySchema = z.object({
  id: z.string().uuid(),
  inquiryId: z.string().uuid(),
  authorType: z.enum(["user", "admin"]),
  authorId: z.string().uuid(),
  /** Tiptap JSON 본문 */
  body: z.unknown(),
  createdAt: z.string().datetime({ offset: true }),
});
export type InquiryReply = z.infer<typeof inquiryReplySchema>;

// ── 문의 답변 작성 입력 ───────────────────────────────────────────────────────

export const createInquiryReplySchema = z.object({
  body: z.unknown(),
});
export type CreateInquiryReply = z.infer<typeof createInquiryReplySchema>;

// ── 목록용 경량 스키마 ────────────────────────────────────────────────────────

/** 문의 목록 아이템 (상세 body 제외 경량 버전) */
export const inquiryListItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: inquiryStatusSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type InquiryListItem = z.infer<typeof inquiryListItemSchema>;

// ── 스레드 응답 스키마 ────────────────────────────────────────────────────────

/** 문의 상세 + 답변 스레드 */
export const inquiryThreadSchema = z.object({
  inquiry: inquirySchema,
  replies: z.array(inquiryReplySchema),
});
export type InquiryThread = z.infer<typeof inquiryThreadSchema>;

// ── 페이지네이션 래퍼 ─────────────────────────────────────────────────────────

export const paginatedInquiriesSchema = paginatedResponseSchema(inquirySchema);
export type PaginatedInquiries = z.infer<typeof paginatedInquiriesSchema>;

/** 목록 아이템용 페이지네이션 래퍼 */
export const paginatedInquiryListSchema = paginatedResponseSchema(inquiryListItemSchema);
export type PaginatedInquiryList = z.infer<typeof paginatedInquiryListSchema>;

export const paginatedInquiryRepliesSchema = paginatedResponseSchema(inquiryReplySchema);
export type PaginatedInquiryReplies = z.infer<typeof paginatedInquiryRepliesSchema>;
