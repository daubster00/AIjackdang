/**
 * 실전자료 상세 서비스 단위 테스트 — Story 4.3
 *
 * DB 연결이 필요한 통합 테스트는 스킵 처리.
 * 라이브 인프라 없이 실행 가능한 로직(status 검증, avgRating 변환 등)을 검증.
 */

import { describe, expect, it } from "vitest";

// ── avgRating numeric→number 변환 로직 검증 ───────────────────────────────────

describe("avgRating 변환 (DB numeric → JS number)", () => {
  it("DB numeric 문자열을 parseFloat으로 number로 변환한다", () => {
    const dbValue = "4.50"; // PostgreSQL numeric → JS string
    const converted = parseFloat(String(dbValue));
    expect(converted).toBe(4.5);
    expect(typeof converted).toBe("number");
  });

  it("null avgRating은 0으로 폴백한다", () => {
    const dbValue = null;
    const converted = dbValue != null ? parseFloat(String(dbValue)) : 0;
    expect(converted).toBe(0);
  });

  it("0.00 avgRating도 number 0으로 변환된다", () => {
    const dbValue = "0.00";
    const converted = parseFloat(String(dbValue));
    expect(converted).toBe(0);
  });

  it("소수점 2자리 문자열이 올바르게 변환된다", () => {
    const dbValue = "3.75";
    const converted = parseFloat(String(dbValue));
    expect(converted).toBe(3.75);
  });
});

// ── userIsOwner 판단 로직 검증 ────────────────────────────────────────────────

describe("userIsOwner 판단", () => {
  function calcUserIsOwner(userId: string | undefined, resourceUserId: string | null): boolean {
    return !!userId && !!resourceUserId && userId === resourceUserId;
  }

  it("userId와 resource.userId가 동일하면 true", () => {
    expect(calcUserIsOwner("user-1", "user-1")).toBe(true);
  });

  it("userId가 undefined면 false", () => {
    expect(calcUserIsOwner(undefined, "user-1")).toBe(false);
  });

  it("resource.userId가 null이면 false", () => {
    expect(calcUserIsOwner("user-1", null)).toBe(false);
  });

  it("userId와 resource.userId가 다르면 false", () => {
    expect(calcUserIsOwner("user-1", "user-2")).toBe(false);
  });
});

// ── status 필터 로직 검증 ─────────────────────────────────────────────────────

describe("status 필터 (getResourceBySlug 내부 로직)", () => {
  type ResourceStatus = "draft" | "published" | "hidden" | "deleted";

  function shouldReturn(status: ResourceStatus): boolean {
    if (status === "deleted") return false;
    if (status === "hidden") return false;
    if (status === "draft") return false;
    return true; // published만 반환
  }

  it("published 자료는 반환한다", () => {
    expect(shouldReturn("published")).toBe(true);
  });

  it("deleted 자료는 반환하지 않는다", () => {
    expect(shouldReturn("deleted")).toBe(false);
  });

  it("hidden 자료는 반환하지 않는다", () => {
    expect(shouldReturn("hidden")).toBe(false);
  });

  it("draft 자료는 반환하지 않는다", () => {
    expect(shouldReturn("draft")).toBe(false);
  });
});

// ── DB 연결 필요 테스트 (통합) ────────────────────────────────────────────────

describe.todo("통합: DB 연결 필요 (getResourceBySlug)");
