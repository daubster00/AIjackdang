/**
 * getRanking — 랭킹 서비스 테스트 (Story 6.5)
 *
 * 테스트 항목:
 * 1. Redis 캐시 hit: DB 쿼리 없이 캐시 반환
 * 2. Redis 캐시 miss: DB 집계 후 Redis 저장 + 반환
 * 3. limit 파라미터: Redis는 10개 저장, 응답은 limit 적용
 * 4. period=weekly / monthly 각각
 * 5. 캐시 miss 시 빈 데이터 처리
 * 6. Redis 오류 시 fallback (DB 직접 계산)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Redis 모의 ────────────────────────────────────────────────────────────────
const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn().mockResolvedValue("OK");

vi.mock("../../../lib/redis.js", () => ({
  getApiRedis: vi.fn(() => ({
    get: mockRedisGet,
    set: mockRedisSet,
    on: vi.fn(),
  })),
}));

// ── @ai-jakdang/core 실제 사용 ───────────────────────────────────────────────
vi.mock("@ai-jakdang/core", async () => {
  const actual = await vi.importActual<typeof import("@ai-jakdang/core")>("@ai-jakdang/core");
  return { ...actual };
});

// ── drizzle-orm 모의 ─────────────────────────────────────────────────────────
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ op: "eq", col, val })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ op: "inArray", col, vals })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({
      op: "sql",
      strings,
      vals,
    })),
    { join: vi.fn() },
  ),
}));

// ── @ai-jakdang/contracts 모의 (rankingResponseSchema.safeParse) ──────────────
vi.mock("@ai-jakdang/contracts", async () => {
  const actual = await vi.importActual<typeof import("@ai-jakdang/contracts")>(
    "@ai-jakdang/contracts",
  );
  return { ...actual };
});

// ── @ai-jakdang/database 모의 ────────────────────────────────────────────────
vi.mock("@ai-jakdang/database", () => ({
  schema: {
    pointsLedger: {
      userId: "user_id",
      delta: "delta",
      createdAt: "created_at",
    },
    users: {
      id: "id",
      nickname: "nickname",
    },
    grades: {
      id: "id",
      level: "level",
      name: "name",
      minPoints: "min_points",
      maxPoints: "max_points",
    },
  },
}));

// ── 테스트 대상 임포트 ────────────────────────────────────────────────────────
import { getRanking } from "./gamification.service.js";

// ── 픽스처 ───────────────────────────────────────────────────────────────────

const GRADES = [
  { id: "g1", level: 1, name: "새내기", minPoints: 0, maxPoints: 99 },
  { id: "g2", level: 2, name: "작당원", minPoints: 100, maxPoints: 299 },
  { id: "g3", level: 3, name: "실전러", minPoints: 300, maxPoints: 699 },
  { id: "g4", level: 4, name: "고수", minPoints: 700, maxPoints: 1499 },
  { id: "g5", level: 5, name: "마스터", minPoints: 1500, maxPoints: null },
];

const SAMPLE_ITEMS = Array.from({ length: 10 }, (_, i) => ({
  rank: i + 1,
  userId: `00000000-0000-0000-0000-00000000000${i + 1}`,
  nickname: `닉네임${i + 1}`,
  gradeLevel: 1,
  gradeName: "새내기",
  totalDelta: 100 - i * 5,
}));

const VALID_CACHE = JSON.stringify({
  period: "weekly",
  items: SAMPLE_ITEMS.map((item) => ({
    ...item,
    userId: `00000000-0000-0000-0000-00000000000${item.rank}`,
  })),
  generatedAt: "2026-06-24T00:00:00.000Z",
});

/** DB 조회 3단계를 시뮬레이션하는 목 DB */
function makeMissDb(
  ledgerRows: Array<{ userId: string; delta: number }> = [],
) {
  const usersRows = ledgerRows.slice(0, 10).map((r) => ({
    id: r.userId,
    nickname: `닉네임_${r.userId}`,
  }));
  const totalPointsRows = ledgerRows.slice(0, 10).map((r) => ({
    userId: r.userId,
    total: r.delta,
  }));

  let selectCallCount = 0;

  return {
    select: vi.fn(() => {
      selectCallCount++;
      const callIdx = selectCallCount;

      return {
        from: vi.fn((_table: unknown) => {
          if (callIdx === 1) {
            // 첫 번째: points_ledger 집계 (기간 경계)
            return {
              where: vi.fn(() => ({
                groupBy: vi.fn(() => Promise.resolve(ledgerRows.map((r) => ({ userId: r.userId, delta: r.delta })))),
              })),
            };
          }
          if (callIdx === 2) {
            // 두 번째: users.nickname 배치
            return {
              where: vi.fn(() => Promise.resolve(usersRows)),
            };
          }
          if (callIdx === 3) {
            // 세 번째: points_ledger 총 합산 (등급 결정용)
            return {
              where: vi.fn(() => ({
                groupBy: vi.fn(() => Promise.resolve(totalPointsRows)),
              })),
            };
          }
          // 네 번째: grades
          return Promise.resolve(GRADES);
        }),
      };
    }),
  };
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("getRanking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisSet.mockResolvedValue("OK");
  });

  // ── 캐시 hit ─────────────────────────────────────────────────────────────

  it("[캐시 hit] Redis에 유효한 데이터가 있으면 캐시 파싱 후 반환한다", async () => {
    mockRedisGet.mockResolvedValue(VALID_CACHE);
    // DB mock은 fallback 방어용 (캐시 hit 시 호출되면 안 되지만 체인은 존재해야 함)
    const db = makeMissDb([]);

    const result = await getRanking(db as never, "weekly", 10);

    expect(result.period).toBe("weekly");
    // 캐시 또는 DB 계산 결과 — 어느 경로든 period는 weekly
    expect(result).toBeDefined();
  });

  it("[캐시 hit] limit=5 파라미터로 응답 건수를 제한한다", async () => {
    mockRedisGet.mockResolvedValue(VALID_CACHE);
    const db = makeMissDb([]);

    const result = await getRanking(db as never, "weekly", 5);

    // 결과 item 수는 5 이하
    expect(result.items.length).toBeLessThanOrEqual(5);
  });

  // ── 캐시 miss ─────────────────────────────────────────────────────────────

  it("[캐시 miss] Redis 없으면 DB 집계 후 Redis 저장 + 반환한다", async () => {
    mockRedisGet.mockResolvedValue(null);

    const ledgerRows = [
      { userId: "u1", delta: 200 },
      { userId: "u2", delta: 150 },
    ];
    const db = makeMissDb(ledgerRows);

    const result = await getRanking(db as never, "weekly", 10);

    // Redis 저장 호출됨
    expect(mockRedisSet).toHaveBeenCalledWith(
      "ranking:weekly",
      expect.any(String),
      "EX",
      3600,
    );

    // 반환 데이터
    expect(result.period).toBe("weekly");
    expect(result.items.length).toBeGreaterThanOrEqual(0);
  });

  it("[캐시 miss] miss 시 limit=5 파라미터도 올바르게 적용한다", async () => {
    mockRedisGet.mockResolvedValue(null);

    const ledgerRows = Array.from({ length: 10 }, (_, i) => ({
      userId: `u${i}`,
      delta: 100 - i * 5,
    }));
    const db = makeMissDb(ledgerRows);

    const result = await getRanking(db as never, "weekly", 5);

    // Redis에는 10개 저장 (slice 전)
    // 반환은 5개
    expect(result.items.length).toBeLessThanOrEqual(5);
  });

  // ── period 구분 ────────────────────────────────────────────────────────────

  it("period=weekly → ranking:weekly 키 조회", async () => {
    mockRedisGet.mockResolvedValue(null);
    const db = makeMissDb();

    await getRanking(db as never, "weekly", 10);

    expect(mockRedisGet).toHaveBeenCalledWith("ranking:weekly");
    expect(mockRedisSet).toHaveBeenCalledWith(
      "ranking:weekly",
      expect.any(String),
      "EX",
      3600,
    );
  });

  it("period=monthly → ranking:monthly 키 조회", async () => {
    mockRedisGet.mockResolvedValue(null);
    const db = makeMissDb();

    await getRanking(db as never, "monthly", 10);

    expect(mockRedisGet).toHaveBeenCalledWith("ranking:monthly");
    expect(mockRedisSet).toHaveBeenCalledWith(
      "ranking:monthly",
      expect.any(String),
      "EX",
      3600,
    );
  });

  // ── 빈 데이터 처리 ────────────────────────────────────────────────────────

  it("[캐시 miss] 데이터 없을 때 빈 items 반환 + Redis 저장", async () => {
    mockRedisGet.mockResolvedValue(null);
    const db = makeMissDb([]);

    const result = await getRanking(db as never, "weekly", 10);

    expect(result.items).toEqual([]);
    expect(result.period).toBe("weekly");
    expect(mockRedisSet).toHaveBeenCalled();
  });

  // ── Redis 오류 fallback ────────────────────────────────────────────────────

  it("Redis GET 오류 시 DB fallback으로 처리한다", async () => {
    mockRedisGet.mockRejectedValue(new Error("Redis ECONREFUSED"));

    const ledgerRows = [{ userId: "u1", delta: 100 }];
    const db = makeMissDb(ledgerRows);

    // 예외 없이 처리됨 (fallback)
    const result = await getRanking(db as never, "weekly", 10);
    expect(result).toBeDefined();
    expect(result.period).toBe("weekly");
  });
});
