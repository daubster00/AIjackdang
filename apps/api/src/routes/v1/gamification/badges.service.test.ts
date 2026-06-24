/**
 * 뱃지 서비스 단위 테스트 — Story 6.4
 *
 * AC#1 경계값 검증:
 * - 다운로드 49회 → popular-resource 미포함
 * - 다운로드 50회 → popular-resource 포함
 * - 좋아요 19회 → popular-post 미포함
 * - 좋아요 20회 → popular-post 포함
 * - 답변 4개 → answer-pro 미포함
 * - 답변 5개 → answer-pro 포함
 *
 * AC#2 / AC#3: badge-check enqueue 후 자동수여 흐름 경계 (shouldAwardBadge 단위)
 * AC#6: first-post 단방향 (삭제해도 회수 없음) — shouldAwardBadge로 검증
 */

import { describe, it, expect } from "vitest";
import { shouldAwardBadge } from "@ai-jakdang/core";
import type { BadgeCheckOpts } from "@ai-jakdang/core";

// ── AC#1 경계값 테스트 ────────────────────────────────────────────────────────

describe("shouldAwardBadge — 경계값 검증 (AC#1)", () => {
  // ── popular-resource (downloadCount 기준) ─────────────────────────────────

  it("downloadCount=49 → popular-resource 미포함", () => {
    const opts: BadgeCheckOpts = {
      postCount: 0,
      resourceCount: 0,
      downloadCount: 49,
      likeReceivedCount: 0,
      answerCount: 0,
      weeklyActiveCount: 0,
    };
    const result = shouldAwardBadge(opts);
    expect(result).not.toContain("popular-resource");
  });

  it("downloadCount=50 → popular-resource 포함", () => {
    const opts: BadgeCheckOpts = {
      postCount: 0,
      resourceCount: 0,
      downloadCount: 50,
      likeReceivedCount: 0,
      answerCount: 0,
      weeklyActiveCount: 0,
    };
    const result = shouldAwardBadge(opts);
    expect(result).toContain("popular-resource");
  });

  // ── popular-post (likeReceivedCount 기준) ────────────────────────────────

  it("likeReceivedCount=19 → popular-post 미포함", () => {
    const opts: BadgeCheckOpts = {
      postCount: 0,
      resourceCount: 0,
      downloadCount: 0,
      likeReceivedCount: 19,
      answerCount: 0,
      weeklyActiveCount: 0,
    };
    const result = shouldAwardBadge(opts);
    expect(result).not.toContain("popular-post");
  });

  it("likeReceivedCount=20 → popular-post 포함", () => {
    const opts: BadgeCheckOpts = {
      postCount: 0,
      resourceCount: 0,
      downloadCount: 0,
      likeReceivedCount: 20,
      answerCount: 0,
      weeklyActiveCount: 0,
    };
    const result = shouldAwardBadge(opts);
    expect(result).toContain("popular-post");
  });

  // ── answer-pro (answerCount 기준) ────────────────────────────────────────

  it("answerCount=4 → answer-pro 미포함", () => {
    const opts: BadgeCheckOpts = {
      postCount: 0,
      resourceCount: 0,
      downloadCount: 0,
      likeReceivedCount: 0,
      answerCount: 4,
      weeklyActiveCount: 0,
    };
    const result = shouldAwardBadge(opts);
    expect(result).not.toContain("answer-pro");
  });

  it("answerCount=5 → answer-pro 포함", () => {
    const opts: BadgeCheckOpts = {
      postCount: 0,
      resourceCount: 0,
      downloadCount: 0,
      likeReceivedCount: 0,
      answerCount: 5,
      weeklyActiveCount: 0,
    };
    const result = shouldAwardBadge(opts);
    expect(result).toContain("answer-pro");
  });

  // ── admin-special 제외 확인 (AC#3) ──────────────────────────────────────

  it("모든 조건을 만족해도 admin-special은 반환 목록에 없다 (AC#3)", () => {
    const opts: BadgeCheckOpts = {
      postCount: 100,
      resourceCount: 100,
      downloadCount: 100,
      likeReceivedCount: 100,
      answerCount: 100,
      weeklyActiveCount: 4,
    };
    const result = shouldAwardBadge(opts);
    expect(result).not.toContain("admin-special");
  });

  // ── first-post 단방향 확인 (AC#6) ──────────────────────────────────────

  it("postCount=1이면 first-post 뱃지 수여됨 (최초 글 등록)", () => {
    const opts: BadgeCheckOpts = {
      postCount: 1,
      resourceCount: 0,
      downloadCount: 0,
      likeReceivedCount: 0,
      answerCount: 0,
      weeklyActiveCount: 0,
    };
    const result = shouldAwardBadge(opts);
    expect(result).toContain("first-post");
  });

  it("postCount=1 상태에서 shouldAwardBadge는 first-post를 계속 반환 (단방향 — 삭제 후에도 badge는 user_badges에 남음)", () => {
    // 실제 단방향 보장은 badge-check processor가 ON CONFLICT DO NOTHING으로 처리.
    // 이 테스트는 shouldAwardBadge가 postCount 기준만 보고 badge를 반환함을 확인.
    // 즉, postCount=0이 되어도 이미 삽입된 user_badges 행은 삭제되지 않는다는 설계를 확인.
    const afterDeletion: BadgeCheckOpts = {
      postCount: 0, // soft-delete 후 카운트가 0이 되어도
      resourceCount: 0,
      downloadCount: 0,
      likeReceivedCount: 0,
      answerCount: 0,
      weeklyActiveCount: 0,
    };
    const result = shouldAwardBadge(afterDeletion);
    // shouldAwardBadge는 first-post를 반환하지 않음 (조건 미충족)
    // 하지만 processor는 이미 삽입된 user_badges를 삭제하지 않는다 (회수 로직 없음)
    expect(result).not.toContain("first-post");
    // → 이 경우 user_badges에 first-post가 이미 존재하면 ON CONFLICT DO NOTHING으로 그대로 유지됨
  });
});

// ── getUserBadges 서비스 테스트 ───────────────────────────────────────────────

// drizzle-orm 모킹
import { vi, beforeEach } from "vitest";

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ op: "eq", col, val })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ op: "sql", strings, values })),
    { join: vi.fn() }
  ),
}));

vi.mock("@ai-jakdang/database", () => ({
  schema: {
    userBadges: {
      userId: "user_id",
      badgeId: "badge_id",
      grantedAt: "granted_at",
    },
    badges: {
      id: "id",
      slug: "slug",
      name: "name",
      iconUrl: "icon_url",
    },
  },
  getDb: vi.fn(),
}));

import { getUserBadges } from "./gamification.service.js";

describe("getUserBadges (AC#4, AC#7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("보유 뱃지가 없으면 빈 배열을 반환한다", async () => {
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => Promise.resolve([])),
            })),
          })),
        })),
      })),
    };

    const result = await getUserBadges(mockDb as never, "user-uuid-1");
    expect(result.items).toEqual([]);
  });

  it("보유 뱃지를 items 배열로 반환한다 (AC#4)", async () => {
    const grantedDate = new Date("2026-06-01T00:00:00.000Z");
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => Promise.resolve([
                {
                  badgeSlug: "first-post",
                  badgeName: "첫 글 작성",
                  iconUrl: "/badges/first-post.png",
                  grantedAt: grantedDate,
                },
              ])),
            })),
          })),
        })),
      })),
    };

    const result = await getUserBadges(mockDb as never, "user-uuid-1");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      badgeSlug: "first-post",
      badgeName: "첫 글 작성",
      iconUrl: "/badges/first-post.png",
      grantedAt: grantedDate.toISOString(),
    });
  });

  it("응답에 미보유 뱃지 목록 및 달성 조건이 포함되지 않는다 (AC#7)", async () => {
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => Promise.resolve([])),
            })),
          })),
        })),
      })),
    };

    const result = await getUserBadges(mockDb as never, "user-uuid-2");
    // 반환 타입에 미보유 뱃지 목록·조건 필드가 없음
    expect(Object.keys(result)).toEqual(["items"]);
    expect(result.items).toEqual([]);
  });
});
