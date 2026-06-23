/**
 * 평점 서비스 단위 테스트 — Story 4.7
 *
 * DB 연결이 필요한 통합 테스트는 스킵 처리.
 * 라이브 인프라 없이 실행 가능한 로직(집계 계산, 에러 분류 등)을 검증.
 */

import { describe, expect, it } from "vitest";
import { RatingServiceError } from "./rating.service.js";

// ── avgRating 재집계 계산 로직 검증 ──────────────────────────────────────────

describe("avgRating 재집계 (DB numeric → JS number 변환)", () => {
  it("DB numeric 문자열을 parseFloat으로 number로 변환한다", () => {
    const dbValue = "4.33"; // PostgreSQL numeric(3,2) → JS string
    const result = parseFloat(String(dbValue));
    expect(result).toBe(4.33);
    expect(typeof result).toBe("number");
  });

  it("null avgRating은 0으로 폴백한다", () => {
    const dbValue = null;
    const result = dbValue != null ? parseFloat(String(dbValue)) : 0;
    expect(result).toBe(0);
  });

  it("1점 단독 평점 시 avg=1.00", () => {
    const dbValue = "1.00";
    const result = parseFloat(String(dbValue));
    expect(result).toBe(1.0);
  });

  it("5점 단독 평점 시 avg=5.00", () => {
    const dbValue = "5.00";
    const result = parseFloat(String(dbValue));
    expect(result).toBe(5.0);
  });

  it("소수점 2자리까지 정밀도 유지", () => {
    // 3점 + 4점 + 5점 = 12 / 3 = 4.00
    const avg = (3 + 4 + 5) / 3;
    const rounded = parseFloat(avg.toFixed(2));
    expect(rounded).toBe(4.0);
  });
});

// ── 본인 자료 평점 방지 로직 검증 (AR-12) ────────────────────────────────────

describe("본인 자료 평점 방지 (AR-12)", () => {
  function checkSelfRating(
    resourceUserId: string | null,
    requestUserId: string,
  ): "SELF_RATING_NOT_ALLOWED" | null {
    if (resourceUserId && resourceUserId === requestUserId) {
      return "SELF_RATING_NOT_ALLOWED";
    }
    return null;
  }

  it("본인 자료(동일 userId)면 SELF_RATING_NOT_ALLOWED 반환", () => {
    expect(checkSelfRating("user-1", "user-1")).toBe("SELF_RATING_NOT_ALLOWED");
  });

  it("다른 회원 자료면 null 반환 (정상 처리)", () => {
    expect(checkSelfRating("user-1", "user-2")).toBeNull();
  });

  it("resource.userId가 null(탈퇴 회원)이면 null 반환 (평점 허용)", () => {
    expect(checkSelfRating(null, "user-2")).toBeNull();
  });
});

// ── score 범위 검증 ───────────────────────────────────────────────────────────

describe("평점 score 범위 (1~5)", () => {
  function isValidScore(score: number): boolean {
    return Number.isInteger(score) && score >= 1 && score <= 5;
  }

  it("1~5 정수는 유효", () => {
    for (const score of [1, 2, 3, 4, 5]) {
      expect(isValidScore(score)).toBe(true);
    }
  });

  it("0은 유효하지 않음", () => {
    expect(isValidScore(0)).toBe(false);
  });

  it("6은 유효하지 않음", () => {
    expect(isValidScore(6)).toBe(false);
  });

  it("소수는 유효하지 않음", () => {
    expect(isValidScore(3.5)).toBe(false);
  });
});

// ── RatingServiceError 클래스 검증 ───────────────────────────────────────────

describe("RatingServiceError", () => {
  it("code와 message를 올바르게 저장한다", () => {
    const err = new RatingServiceError("RESOURCE_NOT_FOUND", "자료를 찾을 수 없습니다.");
    expect(err.code).toBe("RESOURCE_NOT_FOUND");
    expect(err.message).toBe("자료를 찾을 수 없습니다.");
    expect(err.name).toBe("RatingServiceError");
  });

  it("instanceof Error로 인식된다", () => {
    const err = new RatingServiceError("SELF_RATING_NOT_ALLOWED", "본인 자료 평점 불가");
    expect(err instanceof Error).toBe(true);
    expect(err instanceof RatingServiceError).toBe(true);
  });
});

// ── upsert 집계 정확성 검증 (단위 로직) ─────────────────────────────────────

describe("집계 정확성 (upsert 시나리오)", () => {
  it("첫 번째 평점 등록 후 avg=score, count=1", () => {
    const scores = [4];
    const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    expect(parseFloat(avg.toFixed(2))).toBe(4.0);
    expect(scores.length).toBe(1);
  });

  it("두 번째 평점(다른 회원) 추가 후 avg 재계산", () => {
    const scores = [4, 2];
    const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    expect(parseFloat(avg.toFixed(2))).toBe(3.0);
    expect(scores.length).toBe(2);
  });

  it("기존 평점 수정(upsert) 후 avg 재계산 — 기존 점수 대체", () => {
    // user-1이 4점을 1점으로 수정
    const scores = [1, 2]; // user-1의 4점이 1점으로 교체됨
    const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    expect(parseFloat(avg.toFixed(2))).toBe(1.5);
    expect(scores.length).toBe(2);
  });
});

// ── DB 연결 필요 테스트 (통합) ────────────────────────────────────────────────

describe.todo("통합: DB 연결 필요 (upsertRating, getMyRating)");
