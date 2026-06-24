/**
 * 알림 서비스 레이어 — Story 7.2 + Story 7.3
 *
 * DB 쿼리 로직만 담당한다. 라우트 핸들러는 이 서비스를 호출한다.
 */

import { getDb, schema } from "@ai-jakdang/database";
import { eq, and, desc, count } from "drizzle-orm";
import type { UpdateNotificationSettings } from "@ai-jakdang/contracts";

/** 알림 설정 기본값 — notification_settings 레코드 없을 때 사용 (7종 all true) */
const DEFAULT_NOTIFICATION_SETTINGS: Record<string, boolean> = {
  "comment.created": true,
  "answer.created": true,
  "comment.replied": true,
  "reaction.received": true,
  "helpful_answer.marked": true,
  "message.received": true,
  "sanction.applied": true,
};

export const notificationService = {
  /**
   * 미읽음 알림 개수 조회.
   */
  async getUnreadCount(userId: string): Promise<number> {
    const db = getDb();
    const [row] = await db
      .select({ count: count() })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.isRead, false),
        ),
      );
    return row?.count ?? 0;
  },

  /**
   * 알림 목록 오프셋 페이지네이션 조회.
   */
  async list(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{
    items: (typeof schema.notifications.$inferSelect)[];
    totalItems: number;
  }> {
    const db = getDb();

    const [{ totalItems }] = await db
      .select({ totalItems: count() })
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId));

    const items = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { items, totalItems: totalItems ?? 0 };
  },

  /**
   * 단건 알림 조회 (소유권 확인용).
   */
  async findById(id: string) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.id, id))
      .limit(1);
    return row ?? null;
  },

  /**
   * 단건 읽음 처리.
   */
  async markRead(id: string): Promise<void> {
    const db = getDb();
    await db
      .update(schema.notifications)
      .set({ isRead: true })
      .where(eq(schema.notifications.id, id));
  },

  /**
   * 전체 읽음 처리.
   * @returns 업데이트된 행 수
   */
  async markAllRead(userId: string): Promise<number> {
    const db = getDb();
    const result = await db
      .update(schema.notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.isRead, false),
        ),
      );
    // drizzle rowCount
    return result.rowCount ?? 0;
  },

  // ── Story 7.3: 알림 설정 ────────────────────────────────────────────────────

  /**
   * 알림 설정 조회.
   * 레코드가 없으면 기본값(7종 all true)을 반환한다 (DB insert 없이).
   */
  async getSettings(userId: string): Promise<Record<string, boolean>> {
    const db = getDb();
    const row = await db.query.notificationSettings.findFirst({
      where: eq(schema.notificationSettings.userId, userId),
    });
    if (!row) {
      return { ...DEFAULT_NOTIFICATION_SETTINGS };
    }
    // jsonb에서 읽어온 settings을 기본값과 병합해 빠진 key를 채운다
    const merged = { ...DEFAULT_NOTIFICATION_SETTINGS, ...(row.settings as Record<string, boolean>) };
    return merged;
  },

  /**
   * 알림 설정 저장 (upsert).
   * sanction.applied는 항상 true로 강제 덮어씀.
   */
  async updateSettings(
    userId: string,
    patch: UpdateNotificationSettings,
  ): Promise<Record<string, boolean>> {
    const db = getDb();

    // 먼저 기존 설정 조회
    const existing = await this.getSettings(userId);

    // patch 적용 + sanction.applied 강제 true
    const updated: Record<string, boolean> = {
      ...existing,
      ...patch,
      "sanction.applied": true,
    };

    // upsert: 있으면 update, 없으면 insert
    await db
      .insert(schema.notificationSettings)
      .values({ userId, settings: updated })
      .onConflictDoUpdate({
        target: schema.notificationSettings.userId,
        set: {
          settings: updated,
          updatedAt: new Date(),
        },
      });

    return updated;
  },
};
