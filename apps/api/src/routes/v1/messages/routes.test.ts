/**
 * Story 7.4 — 쪽지 서비스 단위 테스트.
 *
 * DB/Redis 의존 없이 실행 가능한 순수 서비스 로직 테스트.
 * sendMessage의 핵심 검증 케이스를 covers한다:
 * - 자기 자신에게 발송 → 400 SELF_MESSAGE_NOT_ALLOWED
 * - 수신자가 차단한 경우 → 403 BLOCKED_BY_RECEIVER
 * - contracts 스키마 유효성 검증
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMessageSchema, messageSchema, conversationSchema } from "@ai-jakdang/contracts";
import { sendMessage, MSG_ERROR } from "./service.js";

// ── DB Mock ────────────────────────────────────────────────────────────────────

const SENDER_ID = "550e8400-e29b-41d4-a716-446655440001";
const RECEIVER_ID = "550e8400-e29b-41d4-a716-446655440002";
const MSG_ID = "550e8400-e29b-41d4-a716-446655440003";

function makeDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: MSG_ID }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    query: {
      blocks: { findFirst: vi.fn().mockResolvedValue(null) },
      users: { findFirst: vi.fn().mockResolvedValue(null) },
    },
  };
}

// ── contracts 스키마 단위 테스트 ──────────────────────────────────────────────

describe("message contracts 스키마", () => {
  it("createMessageSchema: 유효한 입력을 통과한다", () => {
    const valid = { receiverId: RECEIVER_ID, body: "안녕하세요." };
    expect(createMessageSchema.safeParse(valid).success).toBe(true);
  });

  it("createMessageSchema: body가 빈 문자열이면 실패한다", () => {
    const invalid = { receiverId: RECEIVER_ID, body: "" };
    expect(createMessageSchema.safeParse(invalid).success).toBe(false);
  });

  it("createMessageSchema: body가 500자를 초과하면 실패한다", () => {
    const invalid = { receiverId: RECEIVER_ID, body: "가".repeat(501) };
    expect(createMessageSchema.safeParse(invalid).success).toBe(false);
  });

  it("createMessageSchema: body 500자는 통과한다", () => {
    const valid = { receiverId: RECEIVER_ID, body: "가".repeat(500) };
    expect(createMessageSchema.safeParse(valid).success).toBe(true);
  });

  it("createMessageSchema: receiverId가 UUID 형식이 아니면 실패한다", () => {
    const invalid = { receiverId: "not-a-uuid", body: "hello" };
    expect(createMessageSchema.safeParse(invalid).success).toBe(false);
  });

  it("messageSchema: 유효한 메시지 객체를 통과한다", () => {
    const valid = {
      id: MSG_ID,
      senderId: SENDER_ID,
      receiverId: RECEIVER_ID,
      body: "안녕하세요",
      isRead: false,
      deletedBySender: false,
      deletedByReceiver: false,
      createdAt: "2026-06-24T04:00:00.000+00:00",
    };
    expect(messageSchema.safeParse(valid).success).toBe(true);
  });

  it("conversationSchema: 유효한 대화 목록 아이템을 통과한다", () => {
    const valid = {
      partnerId: RECEIVER_ID,
      partnerNickname: "작당탐험가",
      partnerRank: null,
      partnerAvatarUrl: null,
      lastMessage: {
        id: MSG_ID,
        body: "안녕하세요",
        createdAt: "2026-06-24T04:00:00.000+00:00",
        isRead: false,
      },
      unreadCount: 1,
    };
    expect(conversationSchema.safeParse(valid).success).toBe(true);
  });
});

// ── sendMessage 서비스 단위 테스트 ────────────────────────────────────────────

describe("sendMessage 서비스", () => {
  const mockPublishNotification = vi.fn().mockResolvedValue(undefined);
  const mockRedis = {} as import("ioredis").Redis;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("자기 자신에게 쪽지 발송 시 400 SELF_MESSAGE_NOT_ALLOWED를 던진다", async () => {
    const db = makeDb();
    await expect(
      sendMessage(
        db as unknown as import("@ai-jakdang/database").Database,
        SENDER_ID,
        SENDER_ID, // 동일한 ID
        "자기 자신에게",
        mockPublishNotification,
        mockRedis,
      ),
    ).rejects.toMatchObject({
      code: MSG_ERROR.SELF_MESSAGE_NOT_ALLOWED,
      httpStatus: 400,
    });
  });

  it("수신자가 발신자를 차단한 경우 403 BLOCKED_BY_RECEIVER를 던진다", async () => {
    // DB 메서드를 순서 기반으로 모킹
    let callCount = 0;
    const db = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // sender 조회 → active 상태
          return Promise.resolve([{ status: "active", suspendedUntil: null }]);
        }
        if (callCount === 2) {
          // receiver 조회 → 존재함
          return Promise.resolve([{ id: RECEIVER_ID, nickname: "수신자" }]);
        }
        // blocks 조회 → 차단 레코드 존재
        return Promise.resolve([{ id: "block-id-001" }]);
      }),
    };

    await expect(
      sendMessage(
        db as unknown as import("@ai-jakdang/database").Database,
        SENDER_ID,
        RECEIVER_ID,
        "차단된 상대에게",
        mockPublishNotification,
        mockRedis,
      ),
    ).rejects.toMatchObject({
      code: MSG_ERROR.BLOCKED_BY_RECEIVER,
      httpStatus: 403,
    });
  });

  it("수신자를 찾을 수 없으면 404를 던진다", async () => {
    let callCount = 0;
    const db = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve([{ status: "active", suspendedUntil: null }]);
        }
        // receiver 없음
        return Promise.resolve([]);
      }),
    };

    await expect(
      sendMessage(
        db as unknown as import("@ai-jakdang/database").Database,
        SENDER_ID,
        RECEIVER_ID,
        "존재하지 않는 사람에게",
        mockPublishNotification,
        mockRedis,
      ),
    ).rejects.toMatchObject({
      code: MSG_ERROR.RECEIVER_NOT_FOUND,
      httpStatus: 404,
    });
  });

  it("제재(suspended) 발신자는 403 ACCOUNT_SUSPENDED를 받는다", async () => {
    let callCount = 0;
    const suspendedUntil = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24시간 후
    const db = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve([{ status: "suspended", suspendedUntil }]);
        }
        return Promise.resolve([]);
      }),
    };

    await expect(
      sendMessage(
        db as unknown as import("@ai-jakdang/database").Database,
        SENDER_ID,
        RECEIVER_ID,
        "제재 중 발송",
        mockPublishNotification,
        mockRedis,
      ),
    ).rejects.toMatchObject({
      code: MSG_ERROR.ACCOUNT_SUSPENDED,
      httpStatus: 403,
    });
  });

  it("정상 발송 시 message id를 반환한다", async () => {
    let callCount = 0;
    const db = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve([{ status: "active", suspendedUntil: null }]);
        }
        if (callCount === 2) {
          return Promise.resolve([{ id: RECEIVER_ID, nickname: "수신자" }]);
        }
        // blocks → 비어있음
        return Promise.resolve([]);
      }),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: MSG_ID }]),
    };

    const result = await sendMessage(
      db as unknown as import("@ai-jakdang/database").Database,
      SENDER_ID,
      RECEIVER_ID,
      "정상 발송",
      mockPublishNotification,
      mockRedis,
    );

    expect(result).toEqual({ id: MSG_ID });
    expect(mockPublishNotification).toHaveBeenCalledWith(
      RECEIVER_ID,
      expect.objectContaining({ type: "message.received" }),
      expect.anything(),
      mockRedis,
    );
  });
});

// ── Rate Limit 통합 테스트 (라이브 미실행) ────────────────────────────────────

describe.todo("rate limit 통합 테스트 (라이브 실행 필요)");
