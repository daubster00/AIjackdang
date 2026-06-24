import { describe, expect, it } from "vitest";
import { computeRanking, rankingWindowDates } from "./ranking";

describe("rankingWindowDates", () => {
  describe("weekly", () => {
    it("월요일이면 당일이 start", () => {
      // 2026-06-22 (월요일)
      const now = new Date("2026-06-22T12:00:00Z");
      const { start, end } = rankingWindowDates("weekly", now);
      expect(start.toISOString()).toBe("2026-06-22T00:00:00.000Z");
      expect(end.toISOString()).toBe("2026-06-28T23:59:59.999Z");
    });

    it("수요일이면 해당 주 월요일이 start", () => {
      // 2026-06-24 (수요일)
      const now = new Date("2026-06-24T10:00:00Z");
      const { start, end } = rankingWindowDates("weekly", now);
      expect(start.toISOString()).toBe("2026-06-22T00:00:00.000Z");
      expect(end.toISOString()).toBe("2026-06-28T23:59:59.999Z");
    });

    it("일요일이면 6일 전 월요일이 start", () => {
      // 2026-06-28 (일요일)
      const now = new Date("2026-06-28T10:00:00Z");
      const { start, end } = rankingWindowDates("weekly", now);
      expect(start.toISOString()).toBe("2026-06-22T00:00:00.000Z");
      expect(end.toISOString()).toBe("2026-06-28T23:59:59.999Z");
    });

    it("토요일이면 해당 주 월요일이 start", () => {
      // 2026-06-27 (토요일)
      const now = new Date("2026-06-27T10:00:00Z");
      const { start, end } = rankingWindowDates("weekly", now);
      expect(start.toISOString()).toBe("2026-06-22T00:00:00.000Z");
      expect(end.toISOString()).toBe("2026-06-28T23:59:59.999Z");
    });
  });

  describe("monthly", () => {
    it("6월 중순이면 6월 1일 ~ 6월 30일", () => {
      const now = new Date("2026-06-15T10:00:00Z");
      const { start, end } = rankingWindowDates("monthly", now);
      expect(start.toISOString()).toBe("2026-06-01T00:00:00.000Z");
      expect(end.toISOString()).toBe("2026-06-30T23:59:59.999Z");
    });

    it("2월 말(비윤년)이면 2월 1일 ~ 2월 28일", () => {
      const now = new Date("2026-02-20T10:00:00Z");
      const { start, end } = rankingWindowDates("monthly", now);
      expect(start.toISOString()).toBe("2026-02-01T00:00:00.000Z");
      expect(end.toISOString()).toBe("2026-02-28T23:59:59.999Z");
    });

    it("1월이면 1월 1일 ~ 1월 31일", () => {
      const now = new Date("2026-01-10T10:00:00Z");
      const { start, end } = rankingWindowDates("monthly", now);
      expect(start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
      expect(end.toISOString()).toBe("2026-01-31T23:59:59.999Z");
    });
  });
});

describe("computeRanking", () => {
  it("빈 배열 입력 시 빈 배열 반환", () => {
    expect(computeRanking([], 10)).toEqual([]);
  });

  it("단일 사용자 → rank=1", () => {
    const rows = [{ userId: "u1", delta: 10 }, { userId: "u1", delta: 5 }];
    const result = computeRanking(rows, 10);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ rank: 1, userId: "u1", totalDelta: 15 });
  });

  it("여러 사용자 → 내림차순 정렬, rank 1부터 부여", () => {
    const rows = [
      { userId: "u1", delta: 10 },
      { userId: "u2", delta: 30 },
      { userId: "u3", delta: 20 },
    ];
    const result = computeRanking(rows, 10);
    expect(result[0]).toEqual({ rank: 1, userId: "u2", totalDelta: 30 });
    expect(result[1]).toEqual({ rank: 2, userId: "u3", totalDelta: 20 });
    expect(result[2]).toEqual({ rank: 3, userId: "u1", totalDelta: 10 });
  });

  it("동점자는 같은 rank, 다음 rank 는 건너뜀", () => {
    const rows = [
      { userId: "u1", delta: 100 },
      { userId: "u2", delta: 100 },
      { userId: "u3", delta: 50 },
    ];
    const result = computeRanking(rows, 10);
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(1); // 동점
    expect(result[2].rank).toBe(3); // 2 건너뜀
  });

  it("limit 이 결과 수를 제한한다", () => {
    const rows = [
      { userId: "u1", delta: 10 },
      { userId: "u2", delta: 20 },
      { userId: "u3", delta: 30 },
      { userId: "u4", delta: 40 },
    ];
    const result = computeRanking(rows, 2);
    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe("u4");
    expect(result[1].userId).toBe("u3");
  });

  it("limit=0 이면 빈 배열 반환", () => {
    const rows = [{ userId: "u1", delta: 10 }];
    expect(computeRanking(rows, 0)).toEqual([]);
  });

  it("userId 별 delta 를 합산한다", () => {
    const rows = [
      { userId: "u1", delta: 10 },
      { userId: "u1", delta: 5 },
      { userId: "u1", delta: -3 },
    ];
    const result = computeRanking(rows, 10);
    expect(result[0].totalDelta).toBe(12);
  });
});
