/**
 * publishNotification 단위 테스트 — Story 7.1
 *
 * 핵심 케이스:
 * ① settings off → PUBLISH 미호출 (insert는 수행)
 * ② settings on  → PUBLISH 호출
 * ③ settings 레코드 없음 → 기본 true로 PUBLISH 호출 + upsert 생성
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishNotification } from "./notifications.js";
import type { NotificationEventPayload } from "@ai-jakdang/contracts";

// ── 픽스처 ────────────────────────────────────────────────────────────────────

const USER_ID = "00000000-0000-0000-0000-000000000001";

const PAYLOAD: NotificationEventPayload = {
  type: "comment.created",
  title: "새 댓글이 달렸어요",
  body: "홍길동님이 댓글을 달았습니다.",
};

const MOCK_NOTIF = {
  id: "00000000-0000-0000-0000-000000000099",
  userId: USER_ID,
  type: "comment.created",
  targetType: null,
  targetId: null,
  title: PAYLOAD.title,
  body: PAYLOAD.body,
  isRead: false,
  createdAt: new Date("2026-06-24T00:00:00.000Z"),
};

// ── DB mock 헬퍼 ──────────────────────────────────────────────────────────────

/**
 * Drizzle DB mock을 생성한다.
 * @param settingsRow null이면 레코드 없음, 객체이면 해당 settings 반환
 */
function createMockDb(settingsRow: { settings: Record<string, boolean> } | null) {
  const insertReturning = vi.fn().mockResolvedValue([MOCK_NOTIF]);
  const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });
  const insertOnConflict = vi.fn().mockResolvedValue([]);
  const insertValuesUpsert = vi.fn().mockReturnValue({ onConflictDoNothing: insertOnConflict });

  let insertCallCount = 0;

  const db = {
    insert: vi.fn().mockImplementation(() => {
      insertCallCount++;
      if (insertCallCount === 1) {
        // 1st call: notifications insert (returning)
        return { values: insertValues };
      } else {
        // 2nd call: notification_settings upsert (onConflictDoNothing)
        return { values: insertValuesUpsert };
      }
    }),
    query: {
      notificationSettings: {
        findFirst: vi.fn().mockResolvedValue(settingsRow),
      },
    },
  };

  return {
    db: db as unknown as Parameters<typeof publishNotification>[2],
    insertReturning,
    insertValues,
    insertOnConflict,
    insertValuesUpsert,
  };
}

// ── Redis mock 헬퍼 ───────────────────────────────────────────────────────────

function createMockRedis() {
  return {
    publish: vi.fn().mockResolvedValue(1),
  } as unknown as Parameters<typeof publishNotification>[3];
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("publishNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("① settings off → PUBLISH 미호출, insert는 수행", async () => {
    // settings 레코드 있음, comment.created = false
    const { db } = createMockDb({ settings: { "comment.created": false } });
    const redis = createMockRedis();

    const result = await publishNotification(USER_ID, PAYLOAD, db, redis);

    // insert는 수행됨
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(result).toEqual(MOCK_NOTIF);

    // PUBLISH 미호출
    expect(redis.publish).not.toHaveBeenCalled();
  });

  it("② settings on → PUBLISH 호출", async () => {
    // settings 레코드 있음, comment.created = true
    const { db } = createMockDb({ settings: { "comment.created": true } });
    const redis = createMockRedis();

    const result = await publishNotification(USER_ID, PAYLOAD, db, redis);

    // insert 수행
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(result).toEqual(MOCK_NOTIF);

    // PUBLISH 호출됨
    expect(redis.publish).toHaveBeenCalledTimes(1);
    expect(redis.publish).toHaveBeenCalledWith(
      `notification:${USER_ID}`,
      expect.stringContaining('"type":"comment.created"'),
    );
  });

  it("③ settings 레코드 없음 → 기본 true로 PUBLISH 호출 + upsert 생성", async () => {
    // settingsRow = null → 레코드 없음
    const { db, insertOnConflict } = createMockDb(null);
    const redis = createMockRedis();

    const result = await publishNotification(USER_ID, PAYLOAD, db, redis);

    // notifications insert 수행
    expect(result).toEqual(MOCK_NOTIF);

    // notification_settings upsert 호출됨 (onConflictDoNothing)
    expect(insertOnConflict).toHaveBeenCalledTimes(1);

    // PUBLISH 호출됨 (기본값 true)
    expect(redis.publish).toHaveBeenCalledTimes(1);
    expect(redis.publish).toHaveBeenCalledWith(
      `notification:${USER_ID}`,
      expect.stringContaining('"type":"comment.created"'),
    );
  });

  it("④ PUBLISH 페이로드에 notif.id와 createdAt이 포함된다", async () => {
    const { db } = createMockDb({ settings: { "comment.created": true } });
    const redis = createMockRedis();

    await publishNotification(USER_ID, PAYLOAD, db, redis);

    const publishedStr = (redis.publish as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
    const published = JSON.parse(publishedStr) as Record<string, unknown>;

    expect(published.id).toBe(MOCK_NOTIF.id);
    expect(published.createdAt).toBeDefined();
    expect(published.title).toBe(PAYLOAD.title);
    expect(published.body).toBe(PAYLOAD.body);
  });
});
