import { describe, expect, it } from "vitest";
import { BADGE_CONDITIONS, shouldAwardBadge } from "./badges";
import type { BadgeCheckOpts } from "./badges";

const BASE_OPTS: BadgeCheckOpts = {
  postCount: 0,
  resourceCount: 0,
  downloadCount: 0,
  likeReceivedCount: 0,
  answerCount: 0,
  weeklyActiveCount: 0,
};

describe("BADGE_CONDITIONS", () => {
  it("admin-special 조건은 항상 false", () => {
    expect(BADGE_CONDITIONS["admin-special"]({ ...BASE_OPTS, isAdminGrant: true })).toBe(false);
    expect(BADGE_CONDITIONS["admin-special"](BASE_OPTS)).toBe(false);
  });

  it("first-post: postCount >= 1 이어야 true", () => {
    expect(BADGE_CONDITIONS["first-post"]({ ...BASE_OPTS, postCount: 0 })).toBe(false);
    expect(BADGE_CONDITIONS["first-post"]({ ...BASE_OPTS, postCount: 1 })).toBe(true);
  });

  it("resource-contributor: resourceCount >= 1 이어야 true", () => {
    expect(BADGE_CONDITIONS["resource-contributor"]({ ...BASE_OPTS, resourceCount: 0 })).toBe(false);
    expect(BADGE_CONDITIONS["resource-contributor"]({ ...BASE_OPTS, resourceCount: 1 })).toBe(true);
  });

  it("popular-resource: downloadCount 49 → false, 50 → true (경계)", () => {
    expect(BADGE_CONDITIONS["popular-resource"]({ ...BASE_OPTS, downloadCount: 49 })).toBe(false);
    expect(BADGE_CONDITIONS["popular-resource"]({ ...BASE_OPTS, downloadCount: 50 })).toBe(true);
  });

  it("popular-post: likeReceivedCount 19 → false, 20 → true (경계)", () => {
    expect(BADGE_CONDITIONS["popular-post"]({ ...BASE_OPTS, likeReceivedCount: 19 })).toBe(false);
    expect(BADGE_CONDITIONS["popular-post"]({ ...BASE_OPTS, likeReceivedCount: 20 })).toBe(true);
  });

  it("answer-pro: answerCount 4 → false, 5 → true (경계)", () => {
    expect(BADGE_CONDITIONS["answer-pro"]({ ...BASE_OPTS, answerCount: 4 })).toBe(false);
    expect(BADGE_CONDITIONS["answer-pro"]({ ...BASE_OPTS, answerCount: 5 })).toBe(true);
  });

  it("consistent: weeklyActiveCount 3 → false, 4 → true (경계)", () => {
    expect(BADGE_CONDITIONS["consistent"]({ ...BASE_OPTS, weeklyActiveCount: 3 })).toBe(false);
    expect(BADGE_CONDITIONS["consistent"]({ ...BASE_OPTS, weeklyActiveCount: 4 })).toBe(true);
  });
});

describe("shouldAwardBadge", () => {
  it("모든 조건 미충족 시 빈 배열 반환", () => {
    expect(shouldAwardBadge(BASE_OPTS)).toEqual([]);
  });

  it("admin-special 은 항상 결과에 포함되지 않는다", () => {
    const result = shouldAwardBadge({ ...BASE_OPTS, isAdminGrant: true });
    expect(result).not.toContain("admin-special");
  });

  it("first-post 조건 충족 시 결과에 포함", () => {
    const result = shouldAwardBadge({ ...BASE_OPTS, postCount: 1 });
    expect(result).toContain("first-post");
  });

  it("popular-resource 경계(downloadCount=50) 충족 시 포함", () => {
    const result = shouldAwardBadge({ ...BASE_OPTS, downloadCount: 50 });
    expect(result).toContain("popular-resource");
  });

  it("popular-resource 경계(downloadCount=49) 미충족 시 미포함", () => {
    const result = shouldAwardBadge({ ...BASE_OPTS, downloadCount: 49 });
    expect(result).not.toContain("popular-resource");
  });

  it("popular-post 경계(likeReceivedCount=20) 충족 시 포함", () => {
    const result = shouldAwardBadge({ ...BASE_OPTS, likeReceivedCount: 20 });
    expect(result).toContain("popular-post");
  });

  it("popular-post 경계(likeReceivedCount=19) 미충족 시 미포함", () => {
    const result = shouldAwardBadge({ ...BASE_OPTS, likeReceivedCount: 19 });
    expect(result).not.toContain("popular-post");
  });

  it("answer-pro 경계(answerCount=5) 충족 시 포함", () => {
    const result = shouldAwardBadge({ ...BASE_OPTS, answerCount: 5 });
    expect(result).toContain("answer-pro");
  });

  it("answer-pro 경계(answerCount=4) 미충족 시 미포함", () => {
    const result = shouldAwardBadge({ ...BASE_OPTS, answerCount: 4 });
    expect(result).not.toContain("answer-pro");
  });

  it("여러 조건 동시 충족 시 모두 반환", () => {
    const result = shouldAwardBadge({
      postCount: 1,
      resourceCount: 1,
      downloadCount: 50,
      likeReceivedCount: 20,
      answerCount: 5,
      weeklyActiveCount: 4,
    });
    expect(result).toContain("first-post");
    expect(result).toContain("resource-contributor");
    expect(result).toContain("popular-resource");
    expect(result).toContain("popular-post");
    expect(result).toContain("answer-pro");
    expect(result).toContain("consistent");
    expect(result).not.toContain("admin-special");
    expect(result).toHaveLength(6);
  });
});
