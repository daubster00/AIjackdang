/**
 * 쪽지(DM) 서비스 레이어 — Story 7.4
 *
 * 비즈니스 로직을 라우트 핸들러와 분리해 단위 테스트 가능하게 한다.
 * 트랜잭션은 이 레이어에서만 처리한다.
 */

import { and, eq, isNull, or, sql } from "drizzle-orm";
import type { Database } from "@ai-jakdang/database";
import { schema } from "@ai-jakdang/database";
import type { NotificationEventPayload } from "@ai-jakdang/contracts";

// ── 에러 코드 상수 ────────────────────────────────────────────────────────────

export const MSG_ERROR = {
  SELF_MESSAGE_NOT_ALLOWED: "SELF_MESSAGE_NOT_ALLOWED",
  BLOCKED_BY_RECEIVER: "BLOCKED_BY_RECEIVER",
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",
  RECEIVER_NOT_FOUND: "RECEIVER_NOT_FOUND",
  NOT_PARTICIPANT: "NOT_PARTICIPANT",
  MESSAGE_SENDING_RESTRICTED: "MESSAGE_SENDING_RESTRICTED",
} as const;

// ── 쪽지 발송 ─────────────────────────────────────────────────────────────────

/**
 * 쪽지를 발송한다.
 *
 * @throws {{ code: string; message: string; httpStatus: number }} 비즈니스 에러
 */
export async function sendMessage(
  db: Database,
  senderId: string,
  receiverId: string,
  body: string,
  publishNotification: (
    userId: string,
    payload: NotificationEventPayload,
    db: Database,
    redisPublisher: import("ioredis").Redis,
  ) => Promise<unknown>,
  redisPublisher: import("ioredis").Redis,
): Promise<{ id: string }> {
  // 1. 자기 자신 전송 금지
  if (senderId === receiverId) {
    throw {
      code: MSG_ERROR.SELF_MESSAGE_NOT_ALLOWED,
      message: "자신에게 쪽지를 보낼 수 없습니다.",
      httpStatus: 400,
    };
  }

  // 2. 발신자 제재 상태 확인 (users.suspendedUntil)
  const sender = await db
    .select({ status: schema.users.status, suspendedUntil: schema.users.suspendedUntil })
    .from(schema.users)
    .where(eq(schema.users.id, senderId))
    .limit(1);

  if (sender[0]) {
    const { status, suspendedUntil } = sender[0];
    const now = new Date();
    if (
      status === "suspended" &&
      suspendedUntil !== null &&
      suspendedUntil > now
    ) {
      const until = suspendedUntil.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      throw {
        code: MSG_ERROR.ACCOUNT_SUSPENDED,
        message: `계정이 제재되어 쪽지를 보낼 수 없습니다. 제재 해제 일시: ${until}`,
        httpStatus: 403,
      };
    }
  }

  // 2-b. 쪽지 발신제한(message_restriction) 확인 [9.18]
  const now9_18 = new Date();
  const activeRestriction = await db
    .select({ id: schema.userSanctions.id })
    .from(schema.userSanctions)
    .where(
      and(
        eq(schema.userSanctions.userId, senderId),
        eq(schema.userSanctions.type, "message_restriction"),
        or(
          sql`${schema.userSanctions.endsAt} IS NULL`,
          sql`${schema.userSanctions.endsAt} > ${now9_18}`,
        ),
      ),
    )
    .limit(1);

  if (activeRestriction.length > 0) {
    throw {
      code: MSG_ERROR.MESSAGE_SENDING_RESTRICTED,
      message: "쪽지 발송이 제한된 계정입니다.",
      httpStatus: 403,
    };
  }

  // 3. 수신자 존재 확인
  const receiver = await db
    .select({ id: schema.users.id, nickname: schema.users.nickname })
    .from(schema.users)
    .where(eq(schema.users.id, receiverId))
    .limit(1);

  if (!receiver[0]) {
    throw {
      code: MSG_ERROR.RECEIVER_NOT_FOUND,
      message: "수신자를 찾을 수 없습니다.",
      httpStatus: 404,
    };
  }

  // 4. 수신자가 발신자를 차단했는지 확인 (blocks 테이블 읽기 참조만)
  const block = await db
    .select({ id: schema.blocks.id })
    .from(schema.blocks)
    .where(
      and(
        eq(schema.blocks.blockerId, receiverId),
        eq(schema.blocks.blockedId, senderId),
      ),
    )
    .limit(1);

  if (block.length > 0) {
    throw {
      code: MSG_ERROR.BLOCKED_BY_RECEIVER,
      message: "보낼 수 없는 상대입니다.",
      httpStatus: 403,
    };
  }

  // 5. messages 테이블에 insert
  const [inserted] = await db
    .insert(schema.messages)
    .values({ senderId, receiverId, body })
    .returning({ id: schema.messages.id });

  // 6. 수신자에게 알림 발행 (message.received)
  try {
    await publishNotification(
      receiverId,
      {
        type: "message.received",
        targetType: "message",
        targetId: inserted.id,
        title: "새 쪽지가 도착했습니다",
        body: body.length > 50 ? body.slice(0, 50) + "…" : body,
      },
      db,
      redisPublisher,
    );
  } catch (err) {
    // 알림 발행 실패는 쪽지 발송 성공에 영향 없음 (비필수)
    console.warn("[messages/service] 알림 발행 실패 (무시):", err);
  }

  return { id: inserted.id };
}

// ── 대화 목록 조회 (N+1 방지 단일 쿼리) ──────────────────────────────────────

export interface ConversationItem {
  partnerId: string;
  partnerNickname: string;
  partnerAvatarUrl: string | null;
  lastMessageId: string;
  lastMessageBody: string;
  lastMessageAt: string;
  lastMessageIsRead: boolean;
  unreadCount: number;
  isSentByMe: boolean;
}

/**
 * 대화 목록을 가져온다.
 * 발/수신 양방향에서 상대별 최신 메시지 + 미읽음 수를 단일 쿼리로 집계한다.
 * deleted_by_sender / deleted_by_receiver 필터 포함.
 */
export async function getConversations(
  db: Database,
  userId: string,
): Promise<ConversationItem[]> {
  // Raw SQL로 단일 쿼리 구성
  // CTE: 내가 관여한 메시지에서 상대방 id를 파악하고 최신 created_at 기준 집계
  const rows = await db.execute(sql`
    WITH relevant AS (
      SELECT
        CASE WHEN sender_id = ${userId} THEN receiver_id ELSE sender_id END AS partner_id,
        id,
        body,
        is_read,
        created_at,
        sender_id
      FROM messages
      WHERE
        hidden_by_admin = false
        AND deleted_at IS NULL
        AND (
          (sender_id = ${userId} AND deleted_by_sender = false)
          OR (receiver_id = ${userId} AND deleted_by_receiver = false)
        )
    ),
    latest AS (
      SELECT
        partner_id,
        MAX(created_at) AS last_message_at
      FROM relevant
      GROUP BY partner_id
    ),
    latest_msg AS (
      SELECT DISTINCT ON (r.partner_id)
        r.partner_id,
        r.id AS last_message_id,
        r.body AS last_message_body,
        r.is_read AS last_message_is_read,
        r.created_at AS last_message_at,
        r.sender_id AS last_sender_id
      FROM relevant r
      INNER JOIN latest l ON r.partner_id = l.partner_id AND r.created_at = l.last_message_at
      ORDER BY r.partner_id, r.created_at DESC
    ),
    unread AS (
      SELECT
        CASE WHEN sender_id = ${userId} THEN receiver_id ELSE sender_id END AS partner_id,
        COUNT(*) AS unread_count
      FROM messages
      WHERE receiver_id = ${userId}
        AND is_read = false
        AND deleted_by_receiver = false
        AND hidden_by_admin = false
        AND deleted_at IS NULL
      GROUP BY partner_id
    )
    SELECT
      lm.partner_id,
      u.nickname AS partner_nickname,
      u.avatar_url AS partner_avatar_url,
      lm.last_message_id,
      lm.last_message_body,
      lm.last_message_at,
      lm.last_message_is_read,
      lm.last_sender_id = ${userId} AS is_sent_by_me,
      COALESCE(un.unread_count, 0)::int AS unread_count
    FROM latest_msg lm
    INNER JOIN users u ON u.id = lm.partner_id
    LEFT JOIN unread un ON un.partner_id = lm.partner_id
    ORDER BY lm.last_message_at DESC
  `);

  return (rows.rows as Record<string, unknown>[]).map((row) => ({
    partnerId: row.partner_id as string,
    partnerNickname: row.partner_nickname as string,
    partnerAvatarUrl: (row.partner_avatar_url as string | null) ?? null,
    lastMessageId: row.last_message_id as string,
    lastMessageBody: row.last_message_body as string,
    lastMessageAt: new Date(row.last_message_at as string).toISOString(),
    lastMessageIsRead: Boolean(row.last_message_is_read),
    isSentByMe: Boolean(row.is_sent_by_me),
    unreadCount: Number(row.unread_count),
  }));
}

// ── 특정 상대와의 대화 스레드 조회 ───────────────────────────────────────────

export interface MessageItem {
  id: string;
  senderId: string;
  receiverId: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  isMine: boolean;
}

/**
 * 특정 상대와의 대화 스레드를 시간 오름차순으로 가져온다.
 * 참여자(발신자 또는 수신자)만 접근 가능 여부는 라우트 핸들러에서 검증한다.
 */
export async function getConversationThread(
  db: Database,
  userId: string,
  otherUserId: string,
): Promise<MessageItem[]> {
  const rows = await db
    .select({
      id: schema.messages.id,
      senderId: schema.messages.senderId,
      receiverId: schema.messages.receiverId,
      body: schema.messages.body,
      isRead: schema.messages.isRead,
      createdAt: schema.messages.createdAt,
    })
    .from(schema.messages)
    .where(
      and(
        // [9.18] 관리자 숨김·삭제 메시지 제외
        eq(schema.messages.hiddenByAdmin, false),
        isNull(schema.messages.deletedAt),
        or(
          and(
            eq(schema.messages.senderId, userId),
            eq(schema.messages.receiverId, otherUserId),
            eq(schema.messages.deletedBySender, false),
          ),
          and(
            eq(schema.messages.senderId, otherUserId),
            eq(schema.messages.receiverId, userId),
            eq(schema.messages.deletedByReceiver, false),
          ),
        ),
      ),
    )
    .orderBy(schema.messages.createdAt);

  return rows.map((r) => ({
    id: r.id,
    senderId: r.senderId,
    receiverId: r.receiverId,
    body: r.body,
    isRead: r.isRead,
    createdAt: r.createdAt.toISOString(),
    isMine: r.senderId === userId,
  }));
}

// ── 스레드 일괄 읽음 처리 ─────────────────────────────────────────────────────

/**
 * 특정 상대로부터 받은 모든 미읽음 메시지를 읽음 처리한다.
 */
export async function markThreadRead(
  db: Database,
  userId: string,
  otherUserId: string,
): Promise<{ updated: number }> {
  const result = await db
    .update(schema.messages)
    .set({ isRead: true })
    .where(
      and(
        eq(schema.messages.receiverId, userId),
        eq(schema.messages.senderId, otherUserId),
        eq(schema.messages.isRead, false),
      ),
    );

  return { updated: result.rowCount ?? 0 };
}
