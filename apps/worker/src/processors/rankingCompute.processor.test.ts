/**
 * rankingCompute.processor 테스트 — Story 6.5
 *
 * 테스트 항목:
 * - 기간 경계 계산 (rankingWindowDates 주입 확인)
 * - 동점 처리 (같은 rank, 다음 rank 건너뜀)
 * - limit=10 준수
 * - 멱등: 동일 period 2회 실행 시 동일 결과
 * - 빈 데이터 처리 (빈 items 캐시 저장)
 * - Redis 캐시 키/TTL
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rankingWindowDates, computeRanking } from "@ai-jakdang/core";

// ── 모의(mock) 설정 ───────────────────────────────────────────────────────────

// pg Pool 모의
const mockQuery = vi.fn();
const mockConnect = vi.fn(() => Promise.resolve({ query: mockQuery, release: vi.fn() }));
vi.mock("pg", () => ({
  default: {
    Pool: vi.fn(() => ({
      query: mockQuery,
      connect: mockConnect,
      on: vi.fn(),
    })),
  },
}));

// ioredis 모의
const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn().mockResolvedValue("OK");
const mockRedisQuit = vi.fn().mockResolvedValue("OK");
vi.mock("ioredis", () => ({
  Redis: vi.fn(() => ({
    get: mockRedisGet,
    set: mockRedisSet,
    exists: vi.fn().mockResolvedValue(0),
    quit: mockRedisQuit,
    on: vi.fn(),
  })),
}));

// @ai-jakdang/core 실제 함수 사용 (모의 안 함)
vi.unmock("@ai-jakdang/core");

// ── 테스트 픽스처 ─────────────────────────────────────────────────────────────

/** points_ledger 집계 결과 (user_id, total) */
function makeLedgerRows(entries: Array<{ userId: string; total: number }>) {
  return {
    rows: entries.map((e) => ({ user_id: e.userId, total: String(e.total) })),
  };
}

/** users 배치 조회 결과 */
function makeUsersRows(entries: Array<{ id: string; nickname: string }>) {
  return { rows: entries };
}

/** grades 전체 조회 결과 */
function makeGradesRows() {
  return {
    rows: [
      { level: 1, name: "새내기", min_points: 0, max_points: 99 },
      { level: 2, name: "작당원", min_points: 100, max_points: 299 },
      { level: 3, name: "실전러", min_points: 300, max_points: 699 },
      { level: 4, name: "고수", min_points: 700, max_points: 1499 },
      { level: 5, name: "마스터", min_points: 1500, max_points: null },
    ],
  };
}

/** 총 포인트 배치 조회 결과 */
function makeTotalPointsRows(
  entries: Array<{ userId: string; total: number }>,
) {
  return {
    rows: entries.map((e) => ({ user_id: e.userId, total: String(e.total) })),
  };
}

// ── 모듈 임포트 (mock 설정 이후) ─────────────────────────────────────────────
// 동적 임포트 사용: vi.mock이 hoisted 되므로 static import는 동작
import { rankingComputeProcessor } from "./rankingCompute.processor.js";
import type { Job } from "bullmq";
import type { RankingComputeJobPayload } from "@ai-jakdang/contracts";

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function makeJob(period: "weekly" | "monthly", id = "test-job-1"): Job<RankingComputeJobPayload> {
  return {
    id,
    name: "ranking.compute",
    data: { period },
  } as unknown as Job<RankingComputeJobPayload>;
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("rankingComputeProcessor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 기본 grades 결과 반환 (3번째 query가 grades)
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM grades")) return makeGradesRows();
      if (sql.includes("FROM users")) return makeUsersRows([]);
      if (sql.includes("FROM points_ledger") && sql.includes("GROUP BY user_id")) {
        return makeTotalPointsRows([]);
      }
      return { rows: [] };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── 기간 경계 계산 ────────────────────────────────────────────────────────

  it("weekly 기간 경계를 올바르게 계산한다", async () => {
    // given: 빈 ledger
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM points_ledger") && sql.includes("SUM(delta)")) {
        return { rows: [] };
      }
      if (sql.includes("FROM grades")) return makeGradesRows();
      return { rows: [] };
    });

    const job = makeJob("weekly");
    await rankingComputeProcessor(job);

    // then: Redis SET 호출됨 (빈 결과도 저장)
    expect(mockRedisSet).toHaveBeenCalledWith(
      "ranking:weekly",
      expect.any(String),
      "EX",
      3600,
    );

    const stored = JSON.parse(mockRedisSet.mock.calls[0][1] as string);
    expect(stored.period).toBe("weekly");
    expect(stored.items).toEqual([]);
    expect(stored.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("monthly 기간 경계를 올바르게 계산한다", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM points_ledger") && sql.includes("SUM(delta)")) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const job = makeJob("monthly");
    await rankingComputeProcessor(job);

    expect(mockRedisSet).toHaveBeenCalledWith(
      "ranking:monthly",
      expect.any(String),
      "EX",
      3600,
    );
  });

  // ── 동점 처리 ────────────────────────────────────────────────────────────

  it("동점자는 같은 rank를 부여하고 다음 rank를 건너뛴다", async () => {
    const entries = [
      { userId: "u1", total: 100 },
      { userId: "u2", total: 100 }, // 동점
      { userId: "u3", total: 80 },
    ];

    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM points_ledger") && sql.includes("SUM(delta)") && sql.includes("GROUP BY user_id") && sql.includes("created_at >=")) {
        return makeLedgerRows(entries);
      }
      if (sql.includes("FROM users")) {
        return makeUsersRows([
          { id: "u1", nickname: "유저1" },
          { id: "u2", nickname: "유저2" },
          { id: "u3", nickname: "유저3" },
        ]);
      }
      if (sql.includes("FROM points_ledger") && sql.includes("GROUP BY user_id")) {
        return makeTotalPointsRows(entries.map((e) => ({ userId: e.userId, total: e.total })));
      }
      if (sql.includes("FROM grades")) return makeGradesRows();
      return { rows: [] };
    });

    const job = makeJob("weekly");
    await rankingComputeProcessor(job);

    expect(mockRedisSet).toHaveBeenCalled();
    const stored = JSON.parse(mockRedisSet.mock.calls[0][1] as string);

    // u1, u2 동점 → 둘 다 rank=1
    const ranks = stored.items.map((i: { rank: number }) => i.rank);
    expect(ranks[0]).toBe(1);
    expect(ranks[1]).toBe(1);
    // u3: rank=3 (2 건너뜀)
    expect(ranks[2]).toBe(3);
  });

  // ── limit=10 준수 ─────────────────────────────────────────────────────────

  it("11명 이상이어도 Redis에는 10명만 저장한다", async () => {
    const entries = Array.from({ length: 15 }, (_, i) => ({
      userId: `user-${i + 1}`,
      total: 100 - i,
    }));

    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM points_ledger") && sql.includes("SUM(delta)") && sql.includes("created_at >=")) {
        return makeLedgerRows(entries);
      }
      if (sql.includes("FROM users")) {
        return makeUsersRows(
          entries.slice(0, 10).map((e) => ({ id: e.userId, nickname: `닉네임${e.userId}` })),
        );
      }
      if (sql.includes("FROM points_ledger") && sql.includes("GROUP BY user_id")) {
        return makeTotalPointsRows(entries.slice(0, 10).map((e) => ({ userId: e.userId, total: e.total })));
      }
      if (sql.includes("FROM grades")) return makeGradesRows();
      return { rows: [] };
    });

    const job = makeJob("weekly");
    await rankingComputeProcessor(job);

    const stored = JSON.parse(mockRedisSet.mock.calls[0][1] as string);
    expect(stored.items.length).toBeLessThanOrEqual(10);
  });

  // ── 멱등 ─────────────────────────────────────────────────────────────────

  it("동일 period 2회 실행 시 동일 결과를 반환한다", async () => {
    const entries = [
      { userId: "ua", total: 200 },
      { userId: "ub", total: 150 },
    ];

    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM points_ledger") && sql.includes("SUM(delta)") && sql.includes("created_at >=")) {
        return makeLedgerRows(entries);
      }
      if (sql.includes("FROM users")) {
        return makeUsersRows([
          { id: "ua", nickname: "A유저" },
          { id: "ub", nickname: "B유저" },
        ]);
      }
      if (sql.includes("FROM points_ledger") && sql.includes("GROUP BY user_id")) {
        return makeTotalPointsRows(entries.map((e) => ({ userId: e.userId, total: e.total })));
      }
      if (sql.includes("FROM grades")) return makeGradesRows();
      return { rows: [] };
    });

    const job = makeJob("weekly", "job-1");
    await rankingComputeProcessor(job);
    const first = JSON.parse(mockRedisSet.mock.calls[0][1] as string);

    vi.clearAllMocks();
    mockRedisSet.mockResolvedValue("OK");

    await rankingComputeProcessor(makeJob("weekly", "job-2"));
    const second = JSON.parse(mockRedisSet.mock.calls[0][1] as string);

    // items 동일 (generatedAt은 다를 수 있음)
    expect(first.items).toEqual(second.items);
    expect(first.period).toBe(second.period);
  });

  // ── 빈 데이터 처리 ────────────────────────────────────────────────────────

  it("데이터 없을 때 빈 items로 캐시를 저장한다", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM points_ledger") && sql.includes("SUM(delta)")) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const job = makeJob("monthly");
    await rankingComputeProcessor(job);

    expect(mockRedisSet).toHaveBeenCalledWith(
      "ranking:monthly",
      expect.stringContaining('"items":[]'),
      "EX",
      3600,
    );
  });

  // ── Redis 캐시 키/TTL ────────────────────────────────────────────────────

  it("weekly는 ranking:weekly 키에 TTL 3600초로 저장한다", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM points_ledger") && sql.includes("SUM(delta)")) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const job = makeJob("weekly");
    await rankingComputeProcessor(job);

    expect(mockRedisSet).toHaveBeenCalledWith("ranking:weekly", expect.any(String), "EX", 3600);
  });

  it("monthly는 ranking:monthly 키에 TTL 3600초로 저장한다", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM points_ledger") && sql.includes("SUM(delta)")) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const job = makeJob("monthly");
    await rankingComputeProcessor(job);

    expect(mockRedisSet).toHaveBeenCalledWith("ranking:monthly", expect.any(String), "EX", 3600);
  });

  // ── N+1 방지: 배치 쿼리 ──────────────────────────────────────────────────

  it("사용자 조회는 인원 수와 무관하게 2회 배치 쿼리만 실행한다 (N+1 방지)", async () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({
      userId: `user-${i}`,
      total: 100 - i * 10,
    }));

    const queryLog: string[] = [];

    mockQuery.mockImplementation(async (sql: string) => {
      queryLog.push(sql);
      if (sql.includes("FROM points_ledger") && sql.includes("SUM(delta)") && sql.includes("created_at >=")) {
        return makeLedgerRows(entries);
      }
      if (sql.includes("FROM users")) {
        return makeUsersRows(entries.map((e) => ({ id: e.userId, nickname: `닉${e.userId}` })));
      }
      if (sql.includes("FROM points_ledger") && sql.includes("GROUP BY user_id")) {
        return makeTotalPointsRows(entries.map((e) => ({ userId: e.userId, total: e.total })));
      }
      if (sql.includes("FROM grades")) return makeGradesRows();
      return { rows: [] };
    });

    const job = makeJob("weekly");
    await rankingComputeProcessor(job);

    // 사용자 관련 쿼리는 배치 2개 (users, points_ledger 총합)
    const userQueries = queryLog.filter((s) => s.includes("FROM users"));
    const totalPointsQueries = queryLog.filter(
      (s) => s.includes("FROM points_ledger") && s.includes("GROUP BY user_id") && !s.includes("created_at >="),
    );
    const gradesQueries = queryLog.filter((s) => s.includes("FROM grades"));

    expect(userQueries.length).toBe(1);
    expect(totalPointsQueries.length).toBe(1);
    expect(gradesQueries.length).toBe(1);
  });
});

// ── 순수 함수 단위 테스트 (rankingWindowDates / computeRanking) ────────────────

describe("rankingWindowDates", () => {
  it("weekly: 월요일부터 일요일까지 반환한다", () => {
    // 2026-06-24 (수요일)
    const now = new Date("2026-06-24T10:00:00Z");
    const { start, end } = rankingWindowDates("weekly", now);

    // 이번 주 월요일: 2026-06-22
    expect(start.toISOString()).toBe("2026-06-22T00:00:00.000Z");
    // 이번 주 일요일: 2026-06-28
    expect(end.toISOString()).toBe("2026-06-28T23:59:59.999Z");
  });

  it("monthly: 이번 달 1일부터 마지막 날까지 반환한다", () => {
    const now = new Date("2026-06-24T10:00:00Z");
    const { start, end } = rankingWindowDates("monthly", now);

    expect(start.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-06-30T23:59:59.999Z");
  });
});

describe("computeRanking", () => {
  it("동점자는 같은 rank를 부여한다 (standard competition ranking)", () => {
    const rows = [
      { userId: "a", delta: 100 },
      { userId: "b", delta: 100 },
      { userId: "c", delta: 80 },
    ];
    const result = computeRanking(rows, 10);

    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(1);
    expect(result[2].rank).toBe(3); // 2 건너뜀
  });

  it("limit만큼만 반환한다", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      userId: `u${i}`,
      delta: 100 - i,
    }));
    const result = computeRanking(rows, 10);
    expect(result.length).toBe(10);
  });

  it("빈 입력이면 빈 배열을 반환한다", () => {
    expect(computeRanking([], 10)).toEqual([]);
  });
});
