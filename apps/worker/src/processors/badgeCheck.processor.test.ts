/**
 * badgeCheck.processor 단위 테스트 — Story 6.4
 *
 * 집계 → shouldAwardBadge → user_badges insert 경계 테스트:
 * - downloadCount=49 → popular-resource 미수여
 * - downloadCount=50 → popular-resource 수여 (신규)
 * - likeReceivedCount=19 → popular-post 미수여
 * - likeReceivedCount=20 → popular-post 수여
 * - answerCount=4 → answer-pro 미수여
 * - answerCount=5 → answer-pro 수여
 *
 * 멱등 테스트:
 * - 이미 보유한 뱃지 → ON CONFLICT DO NOTHING (rowCount=0 → 알림 미발행)
 *
 * 단방향 테스트 (AC#6):
 * - badge-check processor에 회수 로직 없음 확인
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import type { BadgeCheckJobPayload } from "@ai-jakdang/contracts";

// ── pg 모킹 ───────────────────────────────────────────────────────────────────

// 집계 쿼리 결과를 시나리오별로 제어하는 전역 상태
interface AggregateScenario {
  postCount: number;
  resourceCount: number;
  downloadCount: number;
  likeReceivedCount: number;
  answerCount: number;
  weeklyActiveCount: number;
}

let currentScenario: AggregateScenario = {
  postCount: 0,
  resourceCount: 0,
  downloadCount: 0,
  likeReceivedCount: 0,
  answerCount: 0,
  weeklyActiveCount: 0,
};

// badges 테이블 매핑 (slug → {id, name})
const BADGE_MAP: Record<string, { id: string; name: string }> = {
  "first-post": { id: "badge-id-1", name: "첫 글 작성" },
  "resource-contributor": { id: "badge-id-2", name: "자료 기여자" },
  "popular-resource": { id: "badge-id-3", name: "인기 자료" },
  "popular-post": { id: "badge-id-4", name: "인기 게시글" },
  "answer-pro": { id: "badge-id-5", name: "답변 고수" },
  "consistent": { id: "badge-id-6", name: "꾸준러" },
};

// insert 이력 추적
interface InsertRecord {
  userId: string;
  badgeId: string;
  rowCount: number;
}
let insertHistory: InsertRecord[] = [];

// insert 시나리오 제어 (이미 존재하는 뱃지 ID 목록 → rowCount=0)
let existingBadgeIds: Set<string> = new Set();

const mockClientQuery = vi.fn(async (sql: string, params: unknown[]) => {
  // postCount 쿼리
  if (sql.includes("FROM posts")) {
    return { rows: [{ count: String(currentScenario.postCount) }] };
  }
  // resourceCount 쿼리
  if (sql.includes("FROM resources") && sql.includes("COUNT(*)")) {
    return { rows: [{ count: String(currentScenario.resourceCount) }] };
  }
  // downloadCount 쿼리 (SUM)
  if (sql.includes("FROM resources") && sql.includes("SUM(download_count)")) {
    return { rows: [{ total: String(currentScenario.downloadCount) }] };
  }
  // likeReceivedCount 쿼리
  if (sql.includes("FROM points_ledger") && sql.includes("reaction.received")) {
    return { rows: [{ count: String(currentScenario.likeReceivedCount) }] };
  }
  // answerCount 쿼리
  if (sql.includes("FROM answers")) {
    return { rows: [{ count: String(currentScenario.answerCount) }] };
  }
  // weeklyActiveCount 쿼리
  if (sql.includes("FROM points_ledger") && sql.includes("EXTRACT(WEEK")) {
    return { rows: [{ week_count: String(currentScenario.weeklyActiveCount) }] };
  }
  // badges 조회 (slug IN ...)
  if (sql.includes("FROM badges") && sql.includes("is_auto = true")) {
    const slugs = (params as string[]);
    const rows = slugs
      .filter((s) => BADGE_MAP[s])
      .map((s) => ({ id: BADGE_MAP[s]!.id, slug: s, name: BADGE_MAP[s]!.name }));
    return { rows };
  }
  // user_badges INSERT ON CONFLICT DO NOTHING
  if (sql.includes("INSERT INTO user_badges")) {
    const badgeId = params[1] as string;
    const userId = params[0] as string;
    const rowCount = existingBadgeIds.has(badgeId) ? 0 : 1;
    insertHistory.push({ userId, badgeId, rowCount });
    return { rowCount };
  }
  return { rows: [], rowCount: 0 };
});

const mockRelease = vi.fn();
const mockClient = { query: mockClientQuery, release: mockRelease };

vi.mock("pg", () => ({
  default: {
    Pool: vi.fn().mockImplementation(() => ({
      connect: vi.fn(async () => mockClient),
      on: vi.fn(),
    })),
  },
}));

// ── BullMQ Queue 모킹 ────────────────────────────────────────────────────────
const mockQueueAdd = vi.fn();
vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mockQueueAdd,
  })),
}));

// ── Redis 모킹 ───────────────────────────────────────────────────────────────
vi.mock("ioredis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
  })),
}));

// ── @ai-jakdang/core: 실제 구현 사용 ─────────────────────────────────────────
// shouldAwardBadge는 순수 함수이므로 모킹 없이 사용

// ── @ai-jakdang/contracts 모킹 ───────────────────────────────────────────────
vi.mock("@ai-jakdang/contracts", () => ({
  // 타입만 사용하므로 빈 구현
}));

// ── 테스트 대상 import ────────────────────────────────────────────────────────
import { badgeCheckProcessor } from "./badgeCheck.processor.js";

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

function makeJob(userId: string): Job<BadgeCheckJobPayload> {
  return {
    id: "test-job-001",
    name: "gamification.badge-check",
    data: { userId },
  } as unknown as Job<BadgeCheckJobPayload>;
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("badgeCheckProcessor — 경계값 집계 테스트 (AC#1, AC#2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertHistory = [];
    existingBadgeIds = new Set();
    currentScenario = {
      postCount: 0,
      resourceCount: 0,
      downloadCount: 0,
      likeReceivedCount: 0,
      answerCount: 0,
      weeklyActiveCount: 0,
    };
  });

  // ── downloadCount 경계 ─────────────────────────────────────────────────────

  it("downloadCount=49 → popular-resource INSERT 없음", async () => {
    currentScenario = { ...currentScenario, downloadCount: 49 };
    await badgeCheckProcessor(makeJob("user-1"));

    const popularResourceInsert = insertHistory.find((r) => r.badgeId === BADGE_MAP["popular-resource"]!.id);
    expect(popularResourceInsert).toBeUndefined();
  });

  it("downloadCount=50 → popular-resource INSERT 발생 (신규 수여)", async () => {
    currentScenario = { ...currentScenario, downloadCount: 50 };
    await badgeCheckProcessor(makeJob("user-2"));

    const popularResourceInsert = insertHistory.find((r) => r.badgeId === BADGE_MAP["popular-resource"]!.id);
    expect(popularResourceInsert).toBeDefined();
    expect(popularResourceInsert?.rowCount).toBe(1);
    // badge.awarded 이벤트 발행 확인
    expect(mockQueueAdd).toHaveBeenCalledWith("badge.awarded", expect.objectContaining({
      badgeSlug: "popular-resource",
    }));
  });

  // ── likeReceivedCount 경계 ────────────────────────────────────────────────

  it("likeReceivedCount=19 → popular-post INSERT 없음", async () => {
    currentScenario = { ...currentScenario, likeReceivedCount: 19 };
    await badgeCheckProcessor(makeJob("user-3"));

    const popularPostInsert = insertHistory.find((r) => r.badgeId === BADGE_MAP["popular-post"]!.id);
    expect(popularPostInsert).toBeUndefined();
  });

  it("likeReceivedCount=20 → popular-post INSERT 발생 (신규 수여)", async () => {
    currentScenario = { ...currentScenario, likeReceivedCount: 20 };
    await badgeCheckProcessor(makeJob("user-4"));

    const popularPostInsert = insertHistory.find((r) => r.badgeId === BADGE_MAP["popular-post"]!.id);
    expect(popularPostInsert).toBeDefined();
    expect(popularPostInsert?.rowCount).toBe(1);
    expect(mockQueueAdd).toHaveBeenCalledWith("badge.awarded", expect.objectContaining({
      badgeSlug: "popular-post",
    }));
  });

  // ── answerCount 경계 ──────────────────────────────────────────────────────

  it("answerCount=4 → answer-pro INSERT 없음", async () => {
    currentScenario = { ...currentScenario, answerCount: 4 };
    await badgeCheckProcessor(makeJob("user-5"));

    const answerProInsert = insertHistory.find((r) => r.badgeId === BADGE_MAP["answer-pro"]!.id);
    expect(answerProInsert).toBeUndefined();
  });

  it("answerCount=5 → answer-pro INSERT 발생 (신규 수여)", async () => {
    currentScenario = { ...currentScenario, answerCount: 5 };
    await badgeCheckProcessor(makeJob("user-6"));

    const answerProInsert = insertHistory.find((r) => r.badgeId === BADGE_MAP["answer-pro"]!.id);
    expect(answerProInsert).toBeDefined();
    expect(answerProInsert?.rowCount).toBe(1);
  });
});

describe("badgeCheckProcessor — 멱등 테스트", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertHistory = [];
    existingBadgeIds = new Set();
    currentScenario = {
      postCount: 0,
      resourceCount: 0,
      downloadCount: 50, // popular-resource 조건 충족
      likeReceivedCount: 0,
      answerCount: 0,
      weeklyActiveCount: 0,
    };
  });

  it("이미 보유한 뱃지는 rowCount=0 → badge.awarded 이벤트 미발행 (멱등)", async () => {
    // popular-resource 뱃지를 이미 보유 중인 시나리오
    existingBadgeIds.add(BADGE_MAP["popular-resource"]!.id);

    await badgeCheckProcessor(makeJob("user-idempotent"));

    // INSERT는 호출됐지만 rowCount=0
    const insert = insertHistory.find((r) => r.badgeId === BADGE_MAP["popular-resource"]!.id);
    expect(insert).toBeDefined();
    expect(insert?.rowCount).toBe(0);

    // badge.awarded 이벤트 미발행
    expect(mockQueueAdd).not.toHaveBeenCalledWith("badge.awarded", expect.anything());
  });

  it("신규 수여인 경우에만 badge.awarded 이벤트 발행 (일부 신규 + 일부 중복)", async () => {
    currentScenario = {
      ...currentScenario,
      postCount: 1, // first-post 조건 충족
      downloadCount: 50, // popular-resource 조건 충족
    };

    // first-post는 이미 보유, popular-resource는 신규
    existingBadgeIds.add(BADGE_MAP["first-post"]!.id);

    await badgeCheckProcessor(makeJob("user-partial-new"));

    // popular-resource는 신규 수여 → 알림 발행
    expect(mockQueueAdd).toHaveBeenCalledWith("badge.awarded", expect.objectContaining({
      badgeSlug: "popular-resource",
    }));

    // first-post는 이미 보유 → 알림 미발행
    const firstPostAlertCalls = (mockQueueAdd.mock.calls as [string, { badgeSlug: string }][])
      .filter((c) => c[1]?.badgeSlug === "first-post");
    expect(firstPostAlertCalls).toHaveLength(0);
  });
});

describe("badgeCheckProcessor — 단방향 원칙 확인 (AC#6)", () => {
  it("processor에 user_badges DELETE 쿼리가 없음 (코드 검증)", () => {
    // badgeCheckProcessor의 소스 코드에 DELETE가 없음을 문자열 검사로 확인
    const processorSrc = badgeCheckProcessor.toString();
    expect(processorSrc).not.toContain("DELETE FROM user_badges");
    expect(processorSrc).not.toContain("delete");
  });
});
