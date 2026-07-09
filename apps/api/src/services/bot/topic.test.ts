/**
 * 봇 주제 선정 서비스 vitest 단위 테스트 — Story 11.9
 *
 * DB를 직접 주입(mock)하여 selectTopic·markTopicUsed를 검증한다.
 * refillTopicsIfNeeded는 callModel 의존으로 통합 시나리오만 smoke-test.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BotTopicRow } from "./topic.js";

// ── 모듈 모킹 ──────────────────────────────────────────────────────────────────

// @ai-jakdang/server-bot/ai mock
vi.mock("@ai-jakdang/server-bot/ai", () => ({
  callModel: vi.fn().mockResolvedValue({
    text: '["새 주제 1", "새 주제 2"]',
    usage: { inputTokens: 100, outputTokens: 50 },
    costUsd: 0.001,
  }),
  getModelAssignment: vi.fn().mockResolvedValue({
    id: "assign-1",
    provider: "anthropic",
    model: "claude-haiku-4-5",
    purpose: "generation",
    isActive: true,
  }),
}));

// @ai-jakdang/bot-core mock
vi.mock("@ai-jakdang/bot-core", () => ({
  buildTopicRefillPrompt: vi.fn().mockReturnValue("mock refill prompt"),
  extractTextFromTiptap: vi.fn().mockReturnValue("mock text"),
}));

// drizzle-orm mock (eq/and/asc/count/sql을 stub으로)
// sql은 @ai-jakdang/database 스키마 파일이 모듈 로드 시 사용하므로 반드시 포함
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ op: "eq", col, val })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  asc: vi.fn((col: unknown) => ({ op: "asc", col })),
  count: vi.fn(() => ({ op: "count" })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ op: "inArray", col, vals })),
  sql: vi.fn((...args: unknown[]) => ({ op: "sql", args })),
}));

// 테스트 대상 import (모킹 이후)
import { selectTopic, markTopicUsed } from "./topic.js";

// ── 공통 픽스처 ──────────────────────────────────────────────────────────────

const PERSONA_ID = "persona-uuid-1";
const BOARD = "talk";

const mockTopic: BotTopicRow = {
  id: "topic-uuid-1",
  personaId: PERSONA_ID,
  board: BOARD,
  titleSeed: "Claude Code 실전 팁",
  topicKind: "fixed",
  status: "unused",
  usedAt: null,
  seriesGroup: null,
  postId: null,
  createdAt: new Date("2026-01-01"),
};

// ── DB mock 헬퍼 ──────────────────────────────────────────────────────────────

function makeSelectDb(rows: BotTopicRow[]) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(rows),
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

// ── selectTopic 테스트 ────────────────────────────────────────────────────────

describe("selectTopic", () => {
  it("unused 주제가 있으면 해당 주제를 반환하고 wasRealtime=false", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = makeSelectDb([mockTopic]) as any;
    const result = await selectTopic(db, PERSONA_ID, BOARD);

    expect(result).not.toBeNull();
    expect(result?.topic.titleSeed).toBe("Claude Code 실전 팁");
    expect(result?.wasRealtime).toBe(false);
  });

  it("unused 없고 realtimeTopic 있으면 임시 객체를 반환하고 wasRealtime=true", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = makeSelectDb([]) as any;
    const result = await selectTopic(db, PERSONA_ID, BOARD, "실시간 주제 텍스트");

    expect(result).not.toBeNull();
    expect(result?.topic.titleSeed).toBe("실시간 주제 텍스트");
    expect(result?.topic.topicKind).toBe("realtime");
    expect(result?.wasRealtime).toBe(true);
  });

  it("unused 없고 realtimeTopic 없으면 null 반환", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = makeSelectDb([]) as any;
    const result = await selectTopic(db, PERSONA_ID, BOARD);

    expect(result).toBeNull();
  });
});

// ── markTopicUsed 테스트 ──────────────────────────────────────────────────────

describe("markTopicUsed", () => {
  let mockSet: ReturnType<typeof vi.fn>;
  let mockWhere: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockWhere = vi.fn().mockResolvedValue(undefined);
    mockSet = vi.fn().mockReturnValue({ where: mockWhere });
  });

  it("UPDATE 쿼리가 호출된다 (status=used, usedAt 설정)", async () => {
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = { update: mockUpdate } as any;

    await markTopicUsed(db, "topic-uuid-1");

    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "used" }),
    );
    expect(mockWhere).toHaveBeenCalledOnce();
  });
});
