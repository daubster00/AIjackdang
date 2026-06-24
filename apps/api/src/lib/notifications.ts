/**
 * publishNotification 헬퍼 — Story 7.1 (AC #5, #6)
 *
 * 알림 발행 흐름:
 * 1. notifications 테이블에 insert
 * 2. notification_settings 조회 (없으면 기본 all-true로 처리 + upsert 생성)
 * 3. settings[payload.type] === false → Redis PUBLISH 생략 (insert는 이미 완료)
 * 4. settings[payload.type] !== false → Redis PUBLISH → SSE 팬아웃
 *
 * 의존성(DB, Redis)은 파라미터로 주입해 단위 테스트에서 mock할 수 있게 한다.
 */

import { eq } from "drizzle-orm";
import { schema } from "@ai-jakdang/database";
import type { Database } from "@ai-jakdang/database";
import type { NotificationEventPayload } from "@ai-jakdang/contracts";
import type { Redis } from "ioredis";

/** 알림 설정 기본값 — notification_settings 레코드 없을 때 사용 */
const DEFAULT_NOTIFICATION_SETTINGS: Record<string, boolean> = {
  "comment.created": true,
  "answer.created": true,
  "comment.replied": true,
  "reaction.received": true,
  "helpful_answer.marked": true,
  "message.received": true,
  "sanction.applied": true,
};

/**
 * 알림을 발행한다.
 *
 * @param userId 수신자 userId
 * @param payload 알림 페이로드 (type, title, body, 선택: targetType, targetId)
 * @param db Drizzle DB 인스턴스 (테스트에서 mock 주입)
 * @param redisPublisher ioredis PUBLISH 전용 인스턴스 (테스트에서 mock 주입)
 * @returns 삽입된 notifications 행
 */
export async function publishNotification(
  userId: string,
  payload: NotificationEventPayload,
  db: Database,
  redisPublisher: Redis,
) {
  // 1. notifications 테이블에 insert
  const [notif] = await db
    .insert(schema.notifications)
    .values({
      userId,
      type: payload.type,
      targetType: payload.targetType ?? null,
      targetId: payload.targetId ?? null,
      title: payload.title,
      body: payload.body,
    })
    .returning();

  // 2. notification_settings 조회
  const settingsRow = await db.query.notificationSettings.findFirst({
    where: eq(schema.notificationSettings.userId, userId),
  });

  let settings: Record<string, boolean | undefined>;

  if (!settingsRow) {
    // AC #6: 설정 레코드 없으면 기본값 upsert 생성
    await db
      .insert(schema.notificationSettings)
      .values({ userId, settings: DEFAULT_NOTIFICATION_SETTINGS })
      .onConflictDoNothing();
    settings = DEFAULT_NOTIFICATION_SETTINGS as Record<string, boolean | undefined>;
  } else {
    settings = settingsRow.settings as Record<string, boolean | undefined>;
  }

  // 3. type이 false면 SSE PUBLISH 생략 (insert는 완료됨)
  if (settings[payload.type] === false) {
    return notif;
  }

  // 4. Redis PUBLISH → 해당 유저 SSE 커넥션 보유 인스턴스가 수신
  const ssePayload = JSON.stringify({
    ...payload,
    id: notif.id,
    createdAt: notif.createdAt,
  });

  await redisPublisher.publish(`notification:${userId}`, ssePayload);

  return notif;
}
