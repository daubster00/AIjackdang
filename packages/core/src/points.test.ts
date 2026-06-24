import { describe, expect, it } from "vitest";
import {
  DAILY_CAPS,
  POINT_RULES,
  canEarnPoint,
  pointsForAction,
} from "./points";
import type { PointReason } from "./points";

describe("POINT_RULES", () => {
  it("post.created 는 10포인트", () => {
    expect(POINT_RULES["post.created"]).toBe(10);
  });

  it("answer.created 는 5포인트", () => {
    expect(POINT_RULES["answer.created"]).toBe(5);
  });

  it("comment.created 는 1포인트", () => {
    expect(POINT_RULES["comment.created"]).toBe(1);
  });

  it("resource.created 는 20포인트", () => {
    expect(POINT_RULES["resource.created"]).toBe(20);
  });

  it("reaction.received 는 2포인트", () => {
    expect(POINT_RULES["reaction.received"]).toBe(2);
  });

  it("download.given 는 1포인트", () => {
    expect(POINT_RULES["download.given"]).toBe(1);
  });
});

describe("pointsForAction", () => {
  it("post.created 액션의 포인트를 반환한다", () => {
    expect(pointsForAction("post.created")).toBe(10);
  });

  it("resource.created 액션의 포인트를 반환한다", () => {
    expect(pointsForAction("resource.created")).toBe(20);
  });

  it("모든 PointReason 에 대해 양수 포인트를 반환한다", () => {
    const reasons: PointReason[] = [
      "post.created",
      "answer.created",
      "comment.created",
      "resource.created",
      "reaction.received",
      "download.given",
    ];
    for (const reason of reasons) {
      expect(pointsForAction(reason)).toBeGreaterThan(0);
    }
  });
});

describe("DAILY_CAPS", () => {
  it("comment.created 일일 상한은 20", () => {
    expect(DAILY_CAPS["comment.created"]).toBe(20);
  });

  it("reaction.received 일일 상한은 50", () => {
    expect(DAILY_CAPS["reaction.received"]).toBe(50);
  });

  it("모든 PointReason 에 대해 상한이 정의되어 있다", () => {
    const reasons: PointReason[] = [
      "post.created",
      "answer.created",
      "comment.created",
      "resource.created",
      "reaction.received",
      "download.given",
    ];
    for (const reason of reasons) {
      expect(typeof DAILY_CAPS[reason]).toBe("number");
      expect(DAILY_CAPS[reason]).toBeGreaterThan(0);
    }
  });
});

describe("canEarnPoint", () => {
  it("todayCount 가 상한 미만이면 true 반환", () => {
    expect(
      canEarnPoint({ reason: "post.created", userId: "user-1", todayCount: 1 }),
    ).toBe(true);
  });

  it("todayCount 가 상한과 같으면 false 반환", () => {
    expect(
      canEarnPoint({ reason: "post.created", userId: "user-1", todayCount: 10 }),
    ).toBe(false);
  });

  it("todayCount 가 상한 초과이면 false 반환", () => {
    expect(
      canEarnPoint({ reason: "comment.created", userId: "user-1", todayCount: 21 }),
    ).toBe(false);
  });

  it("todayCount 가 0이면 항상 true 반환", () => {
    const reasons: PointReason[] = [
      "post.created",
      "answer.created",
      "comment.created",
      "resource.created",
      "reaction.received",
      "download.given",
    ];
    for (const reason of reasons) {
      expect(canEarnPoint({ reason, userId: "user-1", todayCount: 0 })).toBe(true);
    }
  });

  it("reaction.received: todayCount=49 → true, todayCount=50 → false", () => {
    expect(
      canEarnPoint({ reason: "reaction.received", userId: "u1", todayCount: 49 }),
    ).toBe(true);
    expect(
      canEarnPoint({ reason: "reaction.received", userId: "u1", todayCount: 50 }),
    ).toBe(false);
  });

  it("download.given: todayCount=29 → true, todayCount=30 → false", () => {
    expect(
      canEarnPoint({ reason: "download.given", userId: "u1", todayCount: 29 }),
    ).toBe(true);
    expect(
      canEarnPoint({ reason: "download.given", userId: "u1", todayCount: 30 }),
    ).toBe(false);
  });
});
