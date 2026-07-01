/**
 * 봇 게이트 헬퍼 단위 테스트 — Story 11.12 (AC: #1~#7)
 *
 * checkBotGates 7가지 시나리오:
 *  1. 킬 스위치 off → allowed: false, reason: 'master_disabled'
 *  2. 글 수 상한 초과 → allowed: false, reason: 'daily_post_limit_exceeded'
 *  3. 댓글 수 상한 초과 → allowed: false, reason: 'daily_comment_limit_exceeded'
 *  4. 비용 상한 초과 → allowed: false, reason: 'daily_cost_limit_reached'
 *  5. 관찰 모드 ON → allowed: true, observationMode: true
 *  6. 전부 통과 → allowed: true, observationMode: false
 *  7. DB 미존재(예외) → 안전 기본값(master_disabled)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── 모듈 모킹 (vi.hoisted로 호이스팅) ───────────────────────────────────────────

const { mockGetBotSetting, mockGetDb, mockDb } = vi.hoisted(() => {
  // DB 체인 목
  const db = {
    select: vi.fn(),
    insert: vi.fn(),
  };

  return {
    mockGetBotSetting: vi.fn<(key: string) => Promise<unknown>>(),
    mockGetDb: vi.fn(() => db),
    mockDb: db,
  };
});

vi.mock("@ai-jakdang/server-bot/botSettings", () => ({
  getBotSetting: mockGetBotSetting,
}));

vi.mock("@ai-jakdang/database", () => ({
  getDb: mockGetDb,
}));

vi.mock("@ai-jakdang/database/schema", () => ({
  botActivityLog: {
    eventType: "eventType",
    createdAt: "createdAt",
    payload: "payload",
    personaId: "personaId",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ op: "eq", col, val })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  gte: vi.fn((col: unknown, val: unknown) => ({ op: "gte", col, val })),
  count: vi.fn(() => ({ op: "count" })),
}));

// 테스트 대상 import (모킹 이후에 import)
import { checkBotGates, logBotSkip, getKstDayStart } from "@ai-jakdang/server-bot/gates";

// ── 공통 헬퍼 ─────────────────────────────────────────────────────────────────

/** 설정 값 맵으로 getBotSetting 목을 설정한다. */
function mockSettings(settings: Record<string, unknown>) {
  mockGetBotSetting.mockImplementation((key: string) => {
    if (key in settings) return Promise.resolve(settings[key]);
    return Promise.resolve(null);
  });
}

/** 카운트 쿼리 결과를 목으로 설정한다. cnt, costRows 순으로 두 번 호출된다. */
function mockDbSelectCount(cntFirst: number, costRowsSecond: Array<{ payload: unknown }> = []) {
  mockDb.select
    .mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ cnt: cntFirst }]),
      }),
    })
    .mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(costRowsSecond),
      }),
    });
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("checkBotGates", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // 기본 insert 목 (logBotSkip 등 내부 호출 대비)
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    });

    // 기본 select 목 (count=0, costRows=[])
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ cnt: 0 }]),
      }),
    });
  });

  // ── 시나리오 1: 킬 스위치 off ─────────────────────────────────────────────
  it("킬 스위치 off(false) → { allowed: false, reason: 'master_disabled' }", async () => {
    mockSettings({ bot_master_enabled: false });

    const result = await checkBotGates("write");

    expect(result).toEqual({ allowed: false, reason: "master_disabled" });
    // 킬 스위치 단락 평가: DB 쿼리 미실행
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("킬 스위치 null(테이블 미존재) → { allowed: false, reason: 'master_disabled' }", async () => {
    mockSettings({ bot_master_enabled: null });

    const result = await checkBotGates("write");

    expect(result).toEqual({ allowed: false, reason: "master_disabled" });
  });

  // ── 시나리오 2: 글 수 상한 초과 ───────────────────────────────────────────
  it("write — post.published 건수 >= bot_daily_post_limit → daily_post_limit_exceeded", async () => {
    mockSettings({
      bot_master_enabled: true,
      bot_daily_post_limit: 10,
      bot_daily_comment_limit: 40,
      bot_daily_cost_limit_usd: 100,
      bot_observation_mode: false,
    });
    // 오늘 글 10건 (= 상한 10), 비용 0
    mockDbSelectCount(10, []);

    const result = await checkBotGates("write");

    expect(result).toEqual({ allowed: false, reason: "daily_post_limit_exceeded" });
  });

  it("write — post.published 건수 < bot_daily_post_limit → 통과", async () => {
    mockSettings({
      bot_master_enabled: true,
      bot_daily_post_limit: 10,
      bot_daily_comment_limit: 40,
      bot_daily_cost_limit_usd: null,
      bot_observation_mode: false,
    });
    mockDbSelectCount(9, []);

    const result = await checkBotGates("write");

    expect(result).toEqual({ allowed: true, observationMode: false });
  });

  // ── 시나리오 3: 댓글 수 상한 초과 ────────────────────────────────────────
  it("comment — comment.published 건수 >= bot_daily_comment_limit → daily_comment_limit_exceeded", async () => {
    mockSettings({
      bot_master_enabled: true,
      bot_daily_post_limit: 10,
      bot_daily_comment_limit: 40,
      bot_daily_cost_limit_usd: null,
      bot_observation_mode: false,
    });
    mockDbSelectCount(40, []);

    const result = await checkBotGates("comment");

    expect(result).toEqual({ allowed: false, reason: "daily_comment_limit_exceeded" });
  });

  // ── 시나리오 4: 비용 상한 초과 ────────────────────────────────────────────
  it("비용 합산 >= bot_daily_cost_limit_usd → daily_cost_limit_reached", async () => {
    mockSettings({
      bot_master_enabled: true,
      bot_daily_post_limit: 100,
      bot_daily_comment_limit: 100,
      bot_daily_cost_limit_usd: 5,
      bot_observation_mode: false,
    });
    // count query: 0건, cost rows: 5.5달러
    mockDbSelectCount(0, [{ payload: { costUsd: 5.5 } }]);

    const result = await checkBotGates("write");

    expect(result).toEqual({ allowed: false, reason: "daily_cost_limit_reached" });
  });

  it("비용 합산 < bot_daily_cost_limit_usd → 비용 상한 미초과(통과)", async () => {
    mockSettings({
      bot_master_enabled: true,
      bot_daily_post_limit: 100,
      bot_daily_comment_limit: 100,
      bot_daily_cost_limit_usd: 5,
      bot_observation_mode: false,
    });
    mockDbSelectCount(0, [{ payload: { costUsd: 4.9 } }]);

    const result = await checkBotGates("write");

    expect(result).toEqual({ allowed: true, observationMode: false });
  });

  // ── 시나리오 5: 관찰 모드 ON ──────────────────────────────────────────────
  it("관찰 모드 ON — 모든 상한 미초과 → { allowed: true, observationMode: true }", async () => {
    mockSettings({
      bot_master_enabled: true,
      bot_daily_post_limit: 100,
      bot_daily_comment_limit: 100,
      bot_daily_cost_limit_usd: null,
      bot_observation_mode: true,
    });
    mockDbSelectCount(0, []);

    const result = await checkBotGates("write");

    expect(result).toEqual({ allowed: true, observationMode: true });
  });

  // ── 시나리오 6: 전부 통과 ──────────────────────────────────────────────────
  it("전부 통과 — 관찰 모드 OFF → { allowed: true, observationMode: false }", async () => {
    mockSettings({
      bot_master_enabled: true,
      bot_daily_post_limit: 100,
      bot_daily_comment_limit: 100,
      bot_daily_cost_limit_usd: null,
      bot_observation_mode: false,
    });
    mockDbSelectCount(5, []);

    const result = await checkBotGates("write");

    expect(result).toEqual({ allowed: true, observationMode: false });
  });

  // ── 시나리오 7: DB 미존재(예외) → 안전 기본값 ──────────────────────────────
  it("getBotSetting 예외(테이블 미존재) → { allowed: false, reason: 'master_disabled' }", async () => {
    mockGetBotSetting.mockRejectedValue(new Error("table does not exist"));

    const result = await checkBotGates("write");

    expect(result).toEqual({ allowed: false, reason: "master_disabled" });
  });

  // ── plan/report 잡: 킬 스위치만 확인 ────────────────────────────────────
  it("plan 잡 — 킬 스위치 on → DB 카운트 쿼리 없이 통과", async () => {
    mockSettings({
      bot_master_enabled: true,
      bot_observation_mode: false,
    });

    const result = await checkBotGates("plan");

    expect(result).toEqual({ allowed: true, observationMode: false });
    // 카운트 쿼리 미호출 (킬 스위치만 확인)
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("plan 잡 — 킬 스위치 off → 차단", async () => {
    mockSettings({ bot_master_enabled: false });

    const result = await checkBotGates("plan");

    expect(result).toEqual({ allowed: false, reason: "master_disabled" });
  });
});

// ── getKstDayStart 테스트 ──────────────────────────────────────────────────────

describe("getKstDayStart", () => {
  it("KST 자정(UTC+9) 기준의 UTC Date를 반환한다", () => {
    const kstStart = getKstDayStart();

    expect(kstStart).toBeInstanceOf(Date);
    // 반환값은 항상 UTC 기준 15:00 또는 같은 날 15:00 이전 (KST 자정 = UTC -9h)
    // 실제 값은 실행 시각에 따라 다르므로 Date 타입만 검증
    expect(kstStart.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("자정 UTC 기준과 최대 9시간 차이", () => {
    const kstStart = getKstDayStart();
    const utcMidnight = new Date();
    utcMidnight.setUTCHours(0, 0, 0, 0);

    const diffHours = Math.abs(kstStart.getTime() - utcMidnight.getTime()) / (1000 * 60 * 60);
    // KST 자정과 UTC 자정은 최대 9시간(KST 앞) 차이
    expect(diffHours).toBeLessThanOrEqual(9);
  });
});

// ── logBotSkip 테스트 ─────────────────────────────────────────────────────────

describe("logBotSkip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    });
  });

  it("personaId 있음 → bot_activity_log INSERT 호출", async () => {
    await logBotSkip("persona-uuid-1", "master_disabled", "write");

    expect(mockDb.insert).toHaveBeenCalledOnce();
  });

  it("personaId null → DB INSERT 미호출 (콘솔 로그만)", async () => {
    await logBotSkip(null, "master_disabled", "plan");

    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("DB INSERT 실패 → 에러 전파하지 않음 (fail-safe)", async () => {
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error("DB 오류")),
    });

    await expect(logBotSkip("persona-uuid-1", "master_disabled", "write")).resolves.toBeUndefined();
  });
});
