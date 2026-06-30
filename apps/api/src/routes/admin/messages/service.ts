/**
 * 쪽지 모더레이션 서비스 레이어 (Story 9.18).
 */

import { getDb } from "@ai-jakdang/database";
import { messages, userSanctions } from "@ai-jakdang/database/schema";
import { eq, inArray, sql } from "drizzle-orm";
import type { AdminMessagesQuery } from "@ai-jakdang/contracts/admin/messages";

// ── 목록 조회 ─────────────────────────────────────────────────────────────────

export async function listMessages(query: AdminMessagesQuery) {
  const db = getDb();
  const { tab, hasReport, from, to, page, pageSize } = query;

  // WHERE 절 동적 구성
  const whereParts: string[] = [];
  if (tab === "reported") {
    whereParts.push(`(SELECT COUNT(*) FROM reports WHERE target_type = 'message' AND target_id = m.id) > 0`);
  } else if (tab === "hidden") {
    whereParts.push(`m.hidden_by_admin = true`);
  }
  if (hasReport === true) {
    whereParts.push(`(SELECT COUNT(*) FROM reports WHERE target_type = 'message' AND target_id = m.id) > 0`);
  }
  if (from) {
    whereParts.push(`m.created_at >= '${from}'`);
  }
  if (to) {
    whereParts.push(`m.created_at <= '${to} 23:59:59'`);
  }

  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
  const offset = (page - 1) * pageSize;

  // 총 개수
  const countResult = await db.execute(
    sql.raw(`SELECT COUNT(*)::int AS cnt FROM messages m ${whereClause}`),
  );
  const totalItems = Number((countResult.rows[0] as Record<string, unknown>).cnt ?? 0);

  // 목록 조회
  const rows = await db.execute(
    sql.raw(`
      SELECT
        m.id,
        m.sender_id AS "senderId",
        s.nickname AS "senderNickname",
        s.avatar_url AS "senderAvatarUrl",
        s.image AS "senderImage",
        s.default_avatar_index AS "senderDefaultAvatarIndex",
        m.receiver_id AS "receiverId",
        r.nickname AS "receiverNickname",
        r.avatar_url AS "receiverAvatarUrl",
        r.image AS "receiverImage",
        r.default_avatar_index AS "receiverDefaultAvatarIndex",
        LEFT(m.body, 100) AS "bodyPreview",
        m.created_at AS "createdAt",
        m.hidden_by_admin AS "hiddenByAdmin",
        m.deleted_at AS "deletedAt",
        (SELECT COUNT(*)::int FROM reports WHERE target_type = 'message' AND target_id = m.id) AS "reportCount"
      FROM messages m
      INNER JOIN users s ON s.id = m.sender_id
      INNER JOIN users r ON r.id = m.receiver_id
      ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `),
  );

  const items = (rows.rows as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    senderId: row.senderId as string,
    senderNickname: row.senderNickname as string,
    senderAvatarUrl: (row.senderAvatarUrl as string | null) ?? null,
    senderImage: (row.senderImage as string | null) ?? null,
    senderDefaultAvatarIndex: row.senderDefaultAvatarIndex != null ? Number(row.senderDefaultAvatarIndex) : 0,
    receiverId: row.receiverId as string,
    receiverNickname: row.receiverNickname as string,
    receiverAvatarUrl: (row.receiverAvatarUrl as string | null) ?? null,
    receiverImage: (row.receiverImage as string | null) ?? null,
    receiverDefaultAvatarIndex: row.receiverDefaultAvatarIndex != null ? Number(row.receiverDefaultAvatarIndex) : 0,
    bodyPreview: row.bodyPreview as string,
    createdAt: new Date(row.createdAt as string).toISOString(),
    hiddenByAdmin: Boolean(row.hiddenByAdmin),
    reportCount: Number(row.reportCount),
    deletedAt: row.deletedAt ? new Date(row.deletedAt as string).toISOString() : null,
  }));

  return {
    items,
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    },
  };
}

// ── 상세 조회 ─────────────────────────────────────────────────────────────────

export async function getMessageDetail(id: string) {
  const db = getDb();

  const rows = await db.execute(
    sql.raw(`
      SELECT
        m.id,
        m.sender_id AS "senderId",
        s.nickname AS "senderNickname",
        m.receiver_id AS "receiverId",
        r.nickname AS "receiverNickname",
        m.body,
        m.created_at AS "createdAt",
        m.hidden_by_admin AS "hiddenByAdmin",
        m.deleted_at AS "deletedAt",
        (SELECT COUNT(*)::int FROM reports WHERE target_type = 'message' AND target_id = m.id) AS "reportCount"
      FROM messages m
      INNER JOIN users s ON s.id = m.sender_id
      INNER JOIN users r ON r.id = m.receiver_id
      WHERE m.id = '${id}'
      LIMIT 1
    `),
  );

  if (!rows.rows[0]) {
    throw Object.assign(new Error("쪽지를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const row = rows.rows[0] as Record<string, unknown>;

  // 연결 신고 목록
  const reportRows = await db.execute(
    sql.raw(`
      SELECT
        rp.id,
        u.nickname AS "reporterNickname",
        rp.reason_code AS "reasonCode",
        rp.created_at AS "createdAt",
        rp.status
      FROM reports rp
      INNER JOIN users u ON u.id = rp.reporter_id
      WHERE rp.target_type = 'message' AND rp.target_id = '${id}'
      ORDER BY rp.created_at DESC
    `),
  );

  const reportList = (reportRows.rows as Record<string, unknown>[]).map((rp) => ({
    id: rp.id as string,
    reporterNickname: rp.reporterNickname as string,
    reasonCode: rp.reasonCode as string,
    createdAt: new Date(rp.createdAt as string).toISOString(),
    status: rp.status as string,
  }));

  return {
    id: row.id as string,
    senderId: row.senderId as string,
    senderNickname: row.senderNickname as string,
    receiverId: row.receiverId as string,
    receiverNickname: row.receiverNickname as string,
    body: row.body as string,
    createdAt: new Date(row.createdAt as string).toISOString(),
    hiddenByAdmin: Boolean(row.hiddenByAdmin),
    deletedAt: row.deletedAt ? new Date(row.deletedAt as string).toISOString() : null,
    reportCount: Number(row.reportCount),
    reports: reportList,
  };
}

// ── 숨김 ──────────────────────────────────────────────────────────────────────

export async function hideMessage(id: string) {
  const db = getDb();

  const [target] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.id, id))
    .limit(1);
  if (!target) {
    throw Object.assign(new Error("쪽지를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  await db.update(messages).set({ hiddenByAdmin: true }).where(eq(messages.id, id));
  return { id, hiddenByAdmin: true };
}

// ── 숨김 복구 ─────────────────────────────────────────────────────────────────

export async function unhideMessage(id: string) {
  const db = getDb();

  const [target] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.id, id))
    .limit(1);
  if (!target) {
    throw Object.assign(new Error("쪽지를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  await db.update(messages).set({ hiddenByAdmin: false }).where(eq(messages.id, id));
  return { id, hiddenByAdmin: false };
}

// ── 삭제 (soft-delete, super_admin 전용) ──────────────────────────────────────

export async function deleteMessage(id: string) {
  const db = getDb();

  const [target] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.id, id))
    .limit(1);
  if (!target) {
    throw Object.assign(new Error("쪽지를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  await db.update(messages).set({ deletedAt: now }).where(eq(messages.id, id));
  return { id, deletedAt: now.toISOString() };
}

// ── 발신제한 생성 ─────────────────────────────────────────────────────────────

export async function restrictSender(
  messageId: string,
  days: number,
  reason: string,
  issuedBy: string | null,
) {
  const db = getDb();

  // 메시지 조회 → 발신자 확인
  const [msg] = await db
    .select({ senderId: messages.senderId })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!msg) {
    throw Object.assign(new Error("쪽지를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const endsAt = days > 0 ? new Date(now.getTime() + days * 24 * 60 * 60 * 1000) : null;

  const [sanction] = await db
    .insert(userSanctions)
    .values({
      userId: msg.senderId,
      type: "message_restriction",
      reason,
      issuedBy,
      startsAt: now,
      endsAt,
    })
    .returning({ id: userSanctions.id });

  return {
    sanctionId: sanction.id,
    userId: msg.senderId,
    type: "message_restriction",
    endsAt: endsAt ? endsAt.toISOString() : null,
  };
}

// ── 벌크 숨김 ─────────────────────────────────────────────────────────────────

export async function bulkHideMessages(ids: string[]) {
  const db = getDb();
  await db.update(messages).set({ hiddenByAdmin: true }).where(inArray(messages.id, ids));
  return { affected: ids.length, action: "hide" as const };
}

// ── 벌크 삭제 ─────────────────────────────────────────────────────────────────

export async function bulkDeleteMessages(ids: string[]) {
  const db = getDb();
  const now = new Date();
  await db.update(messages).set({ deletedAt: now }).where(inArray(messages.id, ids));
  return { affected: ids.length, action: "delete" as const };
}
