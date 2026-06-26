/**
 * 쪽지(DM) 서비스 레이어 — Story 7.4
 *
 * 비즈니스 로직을 라우트 핸들러와 분리해 단위 테스트 가능하게 한다.
 * 트랜잭션은 이 레이어에서만 처리한다.
 */

import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { Database } from "@ai-jakdang/database";
import { schema } from "@ai-jakdang/database";
import type { NotificationEventPayload } from "@ai-jakdang/contracts";
import { getDefaultAvatarUrl } from "@ai-jakdang/core";

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
      u.image AS partner_image,
      u.default_avatar_index AS partner_default_avatar_index,
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
    partnerAvatarUrl:
      (row.partner_avatar_url as string | null) ||
      (row.partner_image as string | null) ||
      getDefaultAvatarUrl(Number(row.partner_default_avatar_index ?? 0)),
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

// ── 쪽지함 개별 메시지 목록 조회 ─────────────────────────────────────────────

export interface MessageBoxItem {
  id: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  counterpart: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  };
}

/**
 * 받은 쪽지 또는 보낸 쪽지 목록을 최신순으로 반환한다.
 * - box='received': 내가 receiver인 메시지. counterpart = sender.
 * - box='sent':     내가 sender인 메시지.   counterpart = receiver.
 */
export async function getMessages(
  db: Database,
  userId: string,
  box: "received" | "sent",
): Promise<MessageBoxItem[]> {
  let rows: { rows: Record<string, unknown>[] };

  if (box === "received") {
    rows = await db.execute(sql`
      SELECT
        m.id,
        m.body,
        m.is_read,
        m.created_at,
        u.id                   AS counterpart_id,
        u.nickname             AS counterpart_nickname,
        u.avatar_url           AS counterpart_avatar_url,
        u.image                AS counterpart_image,
        u.default_avatar_index AS counterpart_default_avatar_index
      FROM messages m
      INNER JOIN users u ON u.id = m.sender_id
      WHERE
        m.receiver_id             = ${userId}
        AND m.deleted_by_receiver  = false
        AND m.purged_by_receiver   = false
        AND m.hidden_by_admin      = false
        AND m.deleted_at           IS NULL
      ORDER BY m.created_at DESC
    `);
  } else {
    rows = await db.execute(sql`
      SELECT
        m.id,
        m.body,
        m.is_read,
        m.created_at,
        u.id                   AS counterpart_id,
        u.nickname             AS counterpart_nickname,
        u.avatar_url           AS counterpart_avatar_url,
        u.image                AS counterpart_image,
        u.default_avatar_index AS counterpart_default_avatar_index
      FROM messages m
      INNER JOIN users u ON u.id = m.receiver_id
      WHERE
        m.sender_id            = ${userId}
        AND m.deleted_by_sender = false
        AND m.purged_by_sender  = false
        AND m.hidden_by_admin   = false
        AND m.deleted_at        IS NULL
      ORDER BY m.created_at DESC
    `);
  }

  return (rows.rows as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    body: row.body as string,
    isRead: Boolean(row.is_read),
    createdAt: new Date(row.created_at as string).toISOString(),
    counterpart: {
      id: row.counterpart_id as string,
      nickname: row.counterpart_nickname as string,
      avatarUrl:
        (row.counterpart_avatar_url as string | null) ||
        (row.counterpart_image as string | null) ||
        getDefaultAvatarUrl(Number(row.counterpart_default_avatar_index ?? 0)),
    },
  }));
}

// ── 단일 수신 메시지 읽음 처리 ────────────────────────────────────────────────

/**
 * 단일 수신 메시지를 읽음 처리한다.
 * receiverId가 요청자(userId)와 일치해야만 업데이트된다.
 */
export async function markMessageRead(
  db: Database,
  messageId: string,
  userId: string,
): Promise<{ updated: number }> {
  const result = await db
    .update(schema.messages)
    .set({ isRead: true })
    .where(
      and(
        eq(schema.messages.id, messageId),
        eq(schema.messages.receiverId, userId),
        eq(schema.messages.isRead, false),
      ),
    );
  return { updated: result.rowCount ?? 0 };
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

// ── 휴지통 목록 조회 ──────────────────────────────────────────────────────────

export interface TrashedMessageServiceItem {
  id: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  trashedAt: string | null;
  originalBox: "received" | "sent";
  counterpart: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  };
}

/**
 * 휴지통에 있는 쪽지 목록을 반환한다 (받은·보낸 합산, 최신 휴지통 이동 순).
 * 호출 시점에 30일 초과 항목을 lazy purge 처리한다.
 */
export async function getTrashedMessages(
  db: Database,
  userId: string,
): Promise<TrashedMessageServiceItem[]> {
  // Lazy purge: 만료된 휴지통 항목 먼저 처리
  await purgeExpiredTrash(db).catch((err: unknown) => {
    console.warn("[messages/service] lazy purge 실패 (무시):", err);
  });

  const rows = await db.execute(sql`
    SELECT
      m.id,
      m.body,
      m.is_read,
      m.created_at,
      CASE
        WHEN m.sender_id   = ${userId} THEN m.trashed_by_sender_at
        ELSE m.trashed_by_receiver_at
      END AS trashed_at,
      CASE
        WHEN m.sender_id = ${userId} THEN 'sent'
        ELSE 'received'
      END AS original_box,
      u.id                   AS counterpart_id,
      u.nickname             AS counterpart_nickname,
      u.avatar_url           AS counterpart_avatar_url,
      u.image                AS counterpart_image,
      u.default_avatar_index AS counterpart_default_avatar_index
    FROM messages m
    INNER JOIN users u ON u.id = CASE
      WHEN m.sender_id = ${userId} THEN m.receiver_id
      ELSE m.sender_id
    END
    WHERE
      m.hidden_by_admin = false
      AND m.deleted_at  IS NULL
      AND (
        (m.receiver_id = ${userId} AND m.deleted_by_receiver = true AND m.purged_by_receiver = false)
        OR
        (m.sender_id   = ${userId} AND m.deleted_by_sender   = true AND m.purged_by_sender   = false)
      )
    ORDER BY COALESCE(
      CASE
        WHEN m.sender_id = ${userId} THEN m.trashed_by_sender_at
        ELSE m.trashed_by_receiver_at
      END,
      m.created_at
    ) DESC
  `);

  return (rows.rows as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    body: row.body as string,
    isRead: Boolean(row.is_read),
    createdAt: new Date(row.created_at as string).toISOString(),
    trashedAt: row.trashed_at
      ? new Date(row.trashed_at as string).toISOString()
      : null,
    originalBox: row.original_box as "received" | "sent",
    counterpart: {
      id: row.counterpart_id as string,
      nickname: row.counterpart_nickname as string,
      avatarUrl:
        (row.counterpart_avatar_url as string | null) ||
        (row.counterpart_image as string | null) ||
        getDefaultAvatarUrl(Number(row.counterpart_default_avatar_index ?? 0)),
    },
  }));
}

// ── 쪽지 휴지통으로 이동 ──────────────────────────────────────────────────────

/**
 * 단일 쪽지를 휴지통으로 이동한다.
 * 요청자가 수신자면 deleted_by_receiver=true + trashed_by_receiver_at=now(),
 * 발신자면 deleted_by_sender=true + trashed_by_sender_at=now().
 * 참여자가 아니거나 이미 휴지통이면 updated=0 을 반환한다.
 */
export async function trashMessage(
  db: Database,
  messageId: string,
  userId: string,
): Promise<{ updated: number }> {
  const now = new Date();

  // 수신자로서 처리
  const asReceiver = await db
    .update(schema.messages)
    .set({ deletedByReceiver: true, trashedByReceiverAt: now })
    .where(
      and(
        eq(schema.messages.id, messageId),
        eq(schema.messages.receiverId, userId),
        eq(schema.messages.deletedByReceiver, false),
        eq(schema.messages.purgedByReceiver, false),
        eq(schema.messages.hiddenByAdmin, false),
        isNull(schema.messages.deletedAt),
      ),
    );

  if ((asReceiver.rowCount ?? 0) > 0) {
    return { updated: 1 };
  }

  // 발신자로서 처리
  const asSender = await db
    .update(schema.messages)
    .set({ deletedBySender: true, trashedBySenderAt: now })
    .where(
      and(
        eq(schema.messages.id, messageId),
        eq(schema.messages.senderId, userId),
        eq(schema.messages.deletedBySender, false),
        eq(schema.messages.purgedBySender, false),
        eq(schema.messages.hiddenByAdmin, false),
        isNull(schema.messages.deletedAt),
      ),
    );

  return { updated: asSender.rowCount ?? 0 };
}

// ── 쪽지 영구삭제 ─────────────────────────────────────────────────────────────

/**
 * 지정한 쪽지들을 영구삭제(purge)한다.
 * 요청자가 수신자면 purged_by_receiver=true, 발신자면 purged_by_sender=true.
 * 반드시 본인 참여 + 이미 휴지통(deleted=true)인 항목만 처리한다.
 */
export async function purgeMessages(
  db: Database,
  ids: string[],
  userId: string,
): Promise<{ purged: number }> {
  if (ids.length === 0) return { purged: 0 };

  const [receiverResult, senderResult] = await Promise.all([
    db
      .update(schema.messages)
      .set({ purgedByReceiver: true })
      .where(
        and(
          inArray(schema.messages.id, ids),
          eq(schema.messages.receiverId, userId),
          eq(schema.messages.deletedByReceiver, true),
          eq(schema.messages.purgedByReceiver, false),
        ),
      ),
    db
      .update(schema.messages)
      .set({ purgedBySender: true })
      .where(
        and(
          inArray(schema.messages.id, ids),
          eq(schema.messages.senderId, userId),
          eq(schema.messages.deletedBySender, true),
          eq(schema.messages.purgedBySender, false),
        ),
      ),
  ]);

  return {
    purged: (receiverResult.rowCount ?? 0) + (senderResult.rowCount ?? 0),
  };
}

// ── 만료된 휴지통 자동 영구삭제 (30일) ───────────────────────────────────────

/**
 * 휴지통 이동 후 30일이 경과한 쪽지를 자동 영구삭제한다.
 * getTrashedMessages 호출 시 lazy purge 방식으로 실행된다.
 */
export async function purgeExpiredTrash(db: Database): Promise<{ purged: number }> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [receiverResult, senderResult] = await Promise.all([
    db
      .update(schema.messages)
      .set({ purgedByReceiver: true })
      .where(
        and(
          eq(schema.messages.deletedByReceiver, true),
          eq(schema.messages.purgedByReceiver, false),
          lt(schema.messages.trashedByReceiverAt, thirtyDaysAgo),
        ),
      ),
    db
      .update(schema.messages)
      .set({ purgedBySender: true })
      .where(
        and(
          eq(schema.messages.deletedBySender, true),
          eq(schema.messages.purgedBySender, false),
          lt(schema.messages.trashedBySenderAt, thirtyDaysAgo),
        ),
      ),
  ]);

  const purged = (receiverResult.rowCount ?? 0) + (senderResult.rowCount ?? 0);
  if (purged > 0) {
    console.log(`[messages/service] 만료된 휴지통 항목 ${purged}건 자동 영구삭제`);
  }
  return { purged };
}
