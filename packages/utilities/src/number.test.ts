import { describe, expect, it } from "vitest";
import { clamp, formatCompactCount, totalPages } from "./number";

describe("formatCompactCount", () => {
  it("1000 미만은 그대로 표시한다", () => {
    expect(formatCompactCount(248)).toBe("248");
  });

  it("천 단위로 축약한다", () => {
    expect(formatCompactCount(1200)).toBe("1.2천");
  });

  it("만 단위로 축약한다", () => {
    expect(formatCompactCount(34000)).toBe("3.4만");
  });
});

describe("clamp", () => {
  it("범위를 벗어나면 경계값으로 제한한다", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-2, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});

describe("totalPages", () => {
  it("총 항목 수와 페이지 크기로 페이지 수를 계산한다", () => {
    expect(totalPages(128, 20)).toBe(7);
    expect(totalPages(0, 20)).toBe(1);
  });
});
