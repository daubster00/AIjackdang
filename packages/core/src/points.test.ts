import { describe, expect, it } from "vitest";
import { gradeForPoints, pointsForAction } from "./points";

describe("pointsForAction", () => {
  it("답변 채택은 20포인트", () => {
    expect(pointsForAction("answer-accepted")).toBe(20);
  });
});

describe("gradeForPoints", () => {
  it("누적 포인트로 등급을 계산한다", () => {
    expect(gradeForPoints(0)).toBe("seed");
    expect(gradeForPoints(50)).toBe("sprout");
    expect(gradeForPoints(300)).toBe("tree");
    expect(gradeForPoints(1500)).toBe("forest");
  });
});
