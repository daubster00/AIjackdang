/**
 * 문의 관리 서비스 레이어 (Story 9.14).
 *
 * listAdminInquiries, getAdminInquiryDetail, updateInquiryStatus, createAdminReply
 * DB 접근 레이어. 트랜잭션은 이 레이어에서만 처리한다.
 */

import { getDb } from "@ai-jakdang/database";
import { schema } from "@ai-jakdang/database";
import { eq, and, count, gte, lte, ilike, or, desc, asc } from "drizzle-orm";

// 로컬 타입 정의 — contracts index.ts export 전 임시
interface AdminInquiriesQuery {
  status?: "pending" | "in_progress" | "resolved";
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  page: number;
  pageSize: number;
}

// ── 목록 조회 ─────────────────────────────────────────────────────────────────

export async function listAdminInquiries(query: AdminInquiriesQuery) {
  const db = getDb();
  const { status, dateFrom, dateTo, q, page, pageSize } = query;

  const conditions = [];

  if (status) {
    conditions.push(eq(schema.inquiries.status, status));
  }
  if (dateFrom) {
    conditions.push(gte(schema.inquiries.createdAt, new Date(dateFrom)));
  }
  if (dateTo) {
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(schema.inquiries.createdAt, toDate));
  }
  if (q) {
    conditions.push(
      or(
        ilike(schema.inquiries.title, `%${q}%`),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // 총 개수
  const [{ value: totalItems }] = await db
    .select({ value: count() })
    .from(schema.inquiries)
    .where(where);

  const offset = (page - 1) * pageSize;

  const rows = await db
    .select({
      id: schema.inquiries.id,
      userId: schema.inquiries.userId,
      userNickname: schema.users.nickname,
      title: schema.inquiries.title,
      status: schema.inquiries.status,
      createdAt: schema.inquiries.createdAt,
      updatedAt: schema.inquiries.updatedAt,
    })
    .from(schema.inquiries)
    .leftJoin(schema.users, eq(schema.inquiries.userId, schema.users.id))
    .where(where)
    .orderBy(desc(schema.inquiries.createdAt))
    .limit(pageSize)
    .offset(offset);

  const items = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userNickname: r.userNickname ?? null,
    title: r.title,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    // resolved 상태인 경우 updatedAt을 처리일로 사용
    resolvedAt: r.status === "resolved" ? r.updatedAt.toISOString() : null,
  }));

  return {
    items,
    meta: {
      page,
      pageSize,
      totalItems: Number(totalItems),
      totalPages: Math.ceil(Number(totalItems) / pageSize),
    },
  };
}

// ── 상세 + 답변 스레드 조회 ───────────────────────────────────────────────────

export async function getAdminInquiryDetail(inquiryId: string) {
  const db = getDb();

  const [row] = await db
    .select({
      id: schema.inquiries.id,
      userId: schema.inquiries.userId,
      userNickname: schema.users.nickname,
      title: schema.inquiries.title,
      body: schema.inquiries.body,
      status: schema.inquiries.status,
      createdAt: schema.inquiries.createdAt,
      updatedAt: schema.inquiries.updatedAt,
    })
    .from(schema.inquiries)
    .leftJoin(schema.users, eq(schema.inquiries.userId, schema.users.id))
    .where(eq(schema.inquiries.id, inquiryId))
    .limit(1);

  if (!row) {
    return null;
  }

  // 답변 목록 — 시간 오름차순
  const replies = await db
    .select()
    .from(schema.inquiryReplies)
    .where(eq(schema.inquiryReplies.inquiryId, inquiryId))
    .orderBy(asc(schema.inquiryReplies.createdAt));

  return {
    inquiry: {
      id: row.id,
      userId: row.userId,
      userNickname: row.userNickname ?? null,
      title: row.title,
      body: row.body,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      resolvedAt: row.status === "resolved" ? row.updatedAt.toISOString() : null,
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

// ── 상태 변경 ─────────────────────────────────────────────────────────────────

export async function updateInquiryStatus(
  inquiryId: string,
  newStatus: "in_progress" | "resolved",
) {
  const db = getDb();

  const [target] = await db
    .select({ id: schema.inquiries.id })
    .from(schema.inquiries)
    .where(eq(schema.inquiries.id, inquiryId))
    .limit(1);

  if (!target) {
    throw Object.assign(new Error("문의를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const [updated] = await db
    .update(schema.inquiries)
    .set({ status: newStatus, updatedAt: now })
    .where(eq(schema.inquiries.id, inquiryId))
    .returning({
      id: schema.inquiries.id,
      status: schema.inquiries.status,
      updatedAt: schema.inquiries.updatedAt,
    });

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── 관리자 답변 작성 ──────────────────────────────────────────────────────────

interface CreateAdminReplyInput {
  inquiryId: string;
  adminUserId: string;
  body: unknown;
}

/**
 * 관리자 답변을 저장하고 inquiry 상태를 'resolved'로 전환한다.
 * 트랜잭션으로 묶어 원자성을 보장한다.
 */
export async function createAdminReply(input: CreateAdminReplyInput) {
  const db = getDb();

  const { inquiryId, adminUserId, body } = input;

  // 문의 존재 확인
  const [inquiry] = await db
    .select({ id: schema.inquiries.id, userId: schema.inquiries.userId, status: schema.inquiries.status })
    .from(schema.inquiries)
    .where(eq(schema.inquiries.id, inquiryId))
    .limit(1);

  if (!inquiry) {
    throw Object.assign(new Error("문의를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();

  // 트랜잭션: 답변 insert + 문의 상태 resolved 전환
  const [reply] = await db.transaction(async (tx) => {
    // 1. 답변 insert
    const [newReply] = await tx
      .insert(schema.inquiryReplies)
      .values({
        inquiryId,
        authorType: "admin",
        authorId: adminUserId,
        body: body as Record<string, unknown>,
        createdAt: now,
      })
      .returning();

    // 2. 문의 상태 resolved 전환
    await tx
      .update(schema.inquiries)
      .set({ status: "resolved", updatedAt: now })
      .where(eq(schema.inquiries.id, inquiryId));

    return [newReply];
  });

  return {
    reply: {
      id: reply.id,
      inquiryId: reply.inquiryId,
      authorType: reply.authorType,
      authorId: reply.authorId,
      body: reply.body,
      createdAt: reply.createdAt.toISOString(),
    },
    inquiry: {
      id: inquiry.id,
      userId: inquiry.userId,
      status: "resolved" as const,
      updatedAt: now.toISOString(),
    },
  };
}
