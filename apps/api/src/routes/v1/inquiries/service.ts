/**
 * inquiries 서비스 — Story 7.5
 *
 * DB 접근 레이어. 트랜잭션은 이 레이어에서만 처리한다.
 */

import { getDb, schema } from "@ai-jakdang/database";
import { eq, and, desc, count } from "drizzle-orm";
import { notifyNewInquiry } from "../../../services/notify/ops-telegram.js";

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface PaginationOptions {
  page: number;
  pageSize: number;
}

// ── 목록 조회 ─────────────────────────────────────────────────────────────────

/**
 * 로그인한 사용자의 문의 목록을 오프셋 페이지네이션으로 반환한다.
 * 소유자 필터(user_id = userId)가 WHERE에 항상 포함된다.
 */
export async function getInquiries(
  userId: string,
  pagination: PaginationOptions,
) {
  const db = getDb();
  const { page, pageSize } = pagination;
  const offset = (page - 1) * pageSize;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: schema.inquiries.id,
        title: schema.inquiries.title,
        status: schema.inquiries.status,
        createdAt: schema.inquiries.createdAt,
        updatedAt: schema.inquiries.updatedAt,
      })
      .from(schema.inquiries)
      .where(eq(schema.inquiries.userId, userId))
      .orderBy(desc(schema.inquiries.createdAt))
      .limit(pageSize)
      .offset(offset),

    db
      .select({ total: count() })
      .from(schema.inquiries)
      .where(eq(schema.inquiries.userId, userId)),
  ]);

  return {
    items: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    meta: {
      page,
      pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

// ── 문의 생성 ─────────────────────────────────────────────────────────────────

interface CreateInquiryData {
  title: string;
  body: unknown;
}

/**
 * 새 문의를 생성하고 생성된 행을 반환한다.
 * rate limit 적용은 라우트 플러그인 레벨에서 처리한다.
 */
export async function createInquiry(userId: string, data: CreateInquiryData) {
  const db = getDb();

  const [row] = await db
    .insert(schema.inquiries)
    .values({
      userId,
      title: data.title,
      body: data.body as Record<string, unknown>,
      status: "pending",
    })
    .returning({
      id: schema.inquiries.id,
      title: schema.inquiries.title,
      status: schema.inquiries.status,
      createdAt: schema.inquiries.createdAt,
      updatedAt: schema.inquiries.updatedAt,
    });

  // 운영자 텔레그램 알림 (fire-and-forget — 문의 접수 흐름을 막지 않음)
  notifyNewInquiry({ userId, title: data.title });

  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── 문의 스레드 조회 ──────────────────────────────────────────────────────────

/**
 * 문의 단건 + 답변 스레드를 반환한다.
 * 소유권 검증: WHERE id=? AND user_id=? — 없으면 null 반환 → 라우트에서 404.
 */
export async function getInquiryThread(userId: string, inquiryId: string) {
  const db = getDb();

  // 소유권 검증 포함 문의 단건 조회
  const [inquiry] = await db
    .select()
    .from(schema.inquiries)
    .where(
      and(
        eq(schema.inquiries.id, inquiryId),
        eq(schema.inquiries.userId, userId),
      ),
    )
    .limit(1);

  if (!inquiry) {
    return null;
  }

  // 답변 목록 — 시간 오름차순
  const replies = await db
    .select()
    .from(schema.inquiryReplies)
    .where(eq(schema.inquiryReplies.inquiryId, inquiryId))
    .orderBy(schema.inquiryReplies.createdAt);

  return {
    inquiry: {
      id: inquiry.id,
      userId: inquiry.userId,
      title: inquiry.title,
      body: inquiry.body,
      status: inquiry.status,
      createdAt: inquiry.createdAt.toISOString(),
      updatedAt: inquiry.updatedAt.toISOString(),
    },
    replies: replies.map((r) => ({
      id: r.id,
      inquiryId: r.inquiryId,
      authorType: r.authorType,
      authorId: r.authorId,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
