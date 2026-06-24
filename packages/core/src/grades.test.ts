import { describe, expect, it } from "vitest";
import { gradeForPoints, nextGrade, pointsToNextGrade } from "./grades";
import type { GradeRow } from "./grades";

// 테스트용 등급 데이터 (AC #2 기반)
const GRADES: GradeRow[] = [
  { id: "1", level: 1, name: "새내기", minPoints: 0,    maxPoints: 99   },
  { id: "2", level: 2, name: "작당원", minPoints: 100,  maxPoints: 499  },
  { id: "3", level: 3, name: "실전러", minPoints: 500,  maxPoints: 1499 },
  { id: "4", level: 4, name: "고수",   minPoints: 1500, maxPoints: 2999 },
  { id: "5", level: 5, name: "마스터", minPoints: 3000, maxPoints: null },
];

describe("gradeForPoints", () => {
  it("0포인트 → Lv1 새내기", () => {
    expect(gradeForPoints(0, GRADES).name).toBe("새내기");
  });

  it("99포인트 → Lv1 새내기 (경계 하한)", () => {
    expect(gradeForPoints(99, GRADES).name).toBe("새내기");
  });

  it("100포인트 → Lv2 작당원 (경계 전환)", () => {
    expect(gradeForPoints(100, GRADES).name).toBe("작당원");
  });

  it("499포인트 → Lv2 작당원 (경계 상한)", () => {
    expect(gradeForPoints(499, GRADES).name).toBe("작당원");
  });

  it("500포인트 → Lv3 실전러 (경계 전환)", () => {
    expect(gradeForPoints(500, GRADES).name).toBe("실전러");
  });

  it("1499포인트 → Lv3 실전러 (경계 상한)", () => {
    expect(gradeForPoints(1499, GRADES).name).toBe("실전러");
  });

  it("1500포인트 → Lv4 고수 (경계 전환)", () => {
    expect(gradeForPoints(1500, GRADES).name).toBe("고수");
  });

  it("2999포인트 → Lv4 고수 (경계 상한)", () => {
    expect(gradeForPoints(2999, GRADES).name).toBe("고수");
  });

  it("3000포인트 → Lv5 마스터 (경계 전환)", () => {
    expect(gradeForPoints(3000, GRADES).name).toBe("마스터");
  });

  it("9999포인트 → Lv5 마스터 (최고 등급 유지)", () => {
    expect(gradeForPoints(9999, GRADES).name).toBe("마스터");
  });

  it("grades 배열 순서가 무작위여도 올바르게 동작한다", () => {
    const shuffled = [...GRADES].sort(() => Math.random() - 0.5);
    expect(gradeForPoints(500, shuffled).name).toBe("실전러");
  });

  it("grades 가 비어 있으면 에러를 던진다", () => {
    expect(() => gradeForPoints(100, [])).toThrow();
  });
});

describe("nextGrade", () => {
  it("Lv1 → Lv2 반환", () => {
    const current = GRADES.find((g) => g.level === 1)!;
    expect(nextGrade(current, GRADES)?.level).toBe(2);
  });

  it("Lv4 → Lv5 반환", () => {
    const current = GRADES.find((g) => g.level === 4)!;
    expect(nextGrade(current, GRADES)?.name).toBe("마스터");
  });

  it("Lv5(최고 등급) → null 반환", () => {
    const current = GRADES.find((g) => g.level === 5)!;
    expect(nextGrade(current, GRADES)).toBeNull();
  });
});

describe("pointsToNextGrade", () => {
  it("0포인트: 다음 등급(작당원)까지 100포인트 필요", () => {
    expect(pointsToNextGrade(0, GRADES)).toBe(100);
  });

  it("99포인트: 다음 등급(작당원)까지 1포인트 필요", () => {
    expect(pointsToNextGrade(99, GRADES)).toBe(1);
  });

  it("100포인트: 다음 등급(실전러)까지 400포인트 필요", () => {
    expect(pointsToNextGrade(100, GRADES)).toBe(400);
  });

  it("499포인트: 다음 등급(실전러)까지 1포인트 필요", () => {
    expect(pointsToNextGrade(499, GRADES)).toBe(1);
  });

  it("1500포인트: 다음 등급(마스터)까지 1500포인트 필요", () => {
    expect(pointsToNextGrade(1500, GRADES)).toBe(1500);
  });

  it("3000포인트(마스터): null 반환", () => {
    expect(pointsToNextGrade(3000, GRADES)).toBeNull();
  });

  it("9999포인트(마스터): null 반환", () => {
    expect(pointsToNextGrade(9999, GRADES)).toBeNull();
  });
});
